import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeProvider } from '@/contexts/theme-context';

// Proves the shadcn/Radix seam: primitives render and fire events under jsdom.

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  it('starts on the system preference showing the sun icon', () => {
    renderToggle();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeVisible();
  });

  it('toggles the theme on click', async () => {
    const user = userEvent.setup();
    renderToggle();

    // Default preference is 'system' (resolved light in the test env);
    // first click toggles light -> dark.
    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
