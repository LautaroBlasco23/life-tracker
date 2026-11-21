import { act, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast, ToastProvider } from './toast';

// CookieToast keeps the queue in module state, so each test mounts its own
// provider. Fake timers drive the auto-dismiss timers; interactions use
// fireEvent because userEvent's async waiting stalls under fake timers.

beforeEach(async () => {
  vi.useFakeTimers();
  // Drain any toasts a failed previous test left in the module queue.
  const guard = render(<ToastProvider />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  guard.unmount();
});

afterEach(() => {
  vi.useRealTimers();
});

async function drainToasts() {
  // Full auto-dismiss cycle (4s + 300ms clear delay) per queued toast.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
}

describe('ToastProvider / showToast', () => {
  it('renders the toast title and description', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'Saved', description: 'All good' });
    });

    expect(screen.getByText('Saved')).toBeVisible();
    expect(screen.getByText('All good')).toBeVisible();
    await drainToasts();
  });

  it('shows a queue badge for toasts behind the visible one', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'First' });
      showToast({ title: 'Second' });
    });

    expect(screen.getByText('First')).toBeVisible();
    expect(screen.getByText('+1')).toBeVisible();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.getByText('Second')).toBeVisible();
    await drainToasts();
  });

  it('applies destructive styling to destructive toasts', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'Boom', variant: 'destructive' });
    });

    const toastRoot = screen.getByText('Boom').closest('div.relative'); // the styled card inside the fixed wrapper
    expect(toastRoot?.className).toContain('bg-destructive');
    await drainToasts();
  });

  it('does not apply destructive styling to default toasts', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'Calm' });
    });

    const toastRoot = screen.getByText('Calm').closest('div.relative'); // the styled card inside the fixed wrapper
    expect(toastRoot?.className).not.toContain('bg-destructive');
    await drainToasts();
  });

  it('auto-dismisses after the visible duration and advances the queue', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'Gone soon' });
      showToast({ title: 'Next up' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_400);
    });

    expect(screen.queryByText('Gone soon')).not.toBeInTheDocument();
    expect(screen.getByText('Next up')).toBeVisible();

    await drainToasts();
    expect(screen.queryByText('Next up')).not.toBeInTheDocument();
  });

  it('clears the toast immediately from the dismiss button', async () => {
    render(<ToastProvider />);

    act(() => {
      showToast({ title: 'Dismiss me', description: 'with the button' });
    });

    fireEvent.click(screen.getByRole('button'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });
});
