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
  it('starts in dark mode showing the moon icon', () => {
    renderToggle();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeVisible();
  });

  it('toggles the theme on click', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button'));
    // After toggling dark -> light, localStorage reflects the new mode.
    expect(localStorage.getItem('theme')).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
