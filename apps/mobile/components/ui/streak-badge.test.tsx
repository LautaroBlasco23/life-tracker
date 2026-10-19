import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StreakBadge } from './streak-badge';

// StreakBadge resolves its ink colors through useColors() (theme context);
// the badge unit tests don't mount ThemeProvider, so stub the palette hook.
jest.mock('../../lib/use-colors', () => ({
  useColors: () => ({
    secondary: '#D6A36D',
    secondaryForeground: '#30372F',
    warning: '#96642A',
    textMuted: '#6A6C61',
  }),
}));

// RNTL v14 render is async — always await it before querying.

describe('StreakBadge', () => {
  it('renders the streak count', async () => {
    await render(<StreakBadge current={5} />);
    expect(screen.getByText('×5')).toBeTruthy();
  });

  it('is hidden at zero streaks by default', async () => {
    await render(<StreakBadge current={0} />);
    expect(screen.queryByText('×0')).toBeNull();
  });

  it('renders at zero when showZero is set', async () => {
    await render(<StreakBadge current={0} showZero />);
    expect(screen.getByText('×0')).toBeTruthy();
  });

  it('renders across tier boundaries without crashing', async () => {
    for (const current of [1, 3, 7, 30]) {
      const { unmount } = await render(<StreakBadge current={current} />);
      expect(screen.getByText(`×${current}`)).toBeTruthy();
      await unmount();
    }
  });
});
