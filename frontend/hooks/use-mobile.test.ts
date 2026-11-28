import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsMobile } from './use-mobile';

// matchMedia is stubbed globally in test/setup.ts; the hook registers its
// change listener through window.__matchMediaListeners, so a resize is
// simulated by mutating window.innerWidth and broadcasting to those
// listeners (the stub ignores the query itself, the hook reads innerWidth).

const REAL_INNER_WIDTH = window.innerWidth;

afterEach(() => {
  window.innerWidth = REAL_INNER_WIDTH;
});

describe('useIsMobile', () => {
  it('is false for desktop viewport widths', async () => {
    window.innerWidth = 1280;

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('is true for viewport widths below the 768px breakpoint', async () => {
    window.innerWidth = 500;

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reacts to resize events while mounted', async () => {
    window.innerWidth = 1280;
    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => expect(result.current).toBe(false));

    act(() => {
      window.innerWidth = 400;
      window.__matchMediaListeners!.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 1200;
      window.__matchMediaListeners!.forEach((cb) => cb());
    });

    expect(result.current).toBe(false);
  });

  it('removes its listener on unmount', async () => {
    const listenersBefore = window.__matchMediaListeners?.size ?? 0;
    const { unmount } = renderHook(() => useIsMobile());
    await waitFor(() =>
      expect((window.__matchMediaListeners?.size ?? 0) > listenersBefore).toBe(
        true
      )
    );

    unmount();

    expect(window.__matchMediaListeners?.size).toBe(listenersBefore);
  });
});
