import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimeLayout from './layout';

vi.mock('@/components/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-guard">{children}</div>
  ),
}));

vi.mock('@/components/navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}));

describe('TimeLayout', () => {
  it('renders the navigation and the page behind the auth guard', () => {
    render(
      <TimeLayout>
        <div>time page content</div>
      </TimeLayout>
    );

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('auth-guard')).toBeInTheDocument();
    expect(screen.getByText('time page content')).toBeInTheDocument();
  });
});
