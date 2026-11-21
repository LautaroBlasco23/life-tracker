import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard } from './onboarding-wizard';
import { activityService } from '@shared/services/activity-service';
import { financeService } from '@shared/services/finance-service';
import { userService } from '@shared/services/user-service';
import { authService } from '@shared/services/auth-service';

// Onboarding wizard: every service is mocked; the shared template catalogs
// are real (pure data, no IO). Steps are driven through the UI.

vi.mock('@shared/services/activity-service', () => ({
  activityService: {
    createActivity: vi.fn(),
  },
}));

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    createTransaction: vi.fn(),
  },
}));

vi.mock('@shared/services/user-service', () => ({
  userService: {
    completeOnboarding: vi.fn(),
  },
}));

vi.mock('@shared/services/auth-service', () => ({
  authService: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Shared context consumed from source resolves its own react copy; every
// component test mocks it (see active-session-card.test.tsx for the pattern).
vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    onboarding: {
      step: 'Step {current} of {total}',
      skip: 'Skip for now',
      back: 'Back',
      next: 'Next',
      finish: 'Finish and start',
      welcome_title: 'Welcome to Life Tracker, {name}!',
      welcome_title_generic: 'Welcome to Life Tracker!',
      activities_title: 'Pick starter activities',
      persona_fit: 'Fit & Healthy',
      persona_fit_description: 'Water, stretching, walking, home training',
      persona_organized: 'Household',
      persona_organized_description: 'Chores and home upkeep',
      persona_productive: 'Productive',
      persona_productive_description: 'Focus blocks, planning, weekly reviews',
      persona_clear: 'Clear',
      finance_title: 'Recurring bills',
      finance_amount: 'Amount',
      finance_amountHint: 'Suggested: {amount}',
      creating_done: 'All set!',
      creating_done_description:
        '{activities} activities and {bills} bills created.',
      creating_partial: 'Created with warnings',
      creating_partial_description:
        '{created} items created, {failed} failed. You can retry later from your profile or the templates.',
    },
    activityTemplates: {
      category_health: 'Health',
      category_homeTraining: 'Home Training',
      category_productivity: 'Productivity',
      template_drinkWater: 'Drink 8 glasses of water',
      template_deepWork90: 'Deep work block 90 min',
    },
    activities: {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      notSpecified: 'Not specified',
    },
    financeTemplates: {
      template_electricity: 'Electricity bill',
      template_salary: 'Salary',
    },
  };
  return {
    useTranslations: (namespace: string) => {
      const dictionary = dictionaries[namespace] ?? {};
      return (key: string, vars?: Record<string, string | number>): string => {
        let str = dictionary[key] ?? key;
        if (vars) {
          for (const [name, value] of Object.entries(vars)) {
            str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
          }
        }
        return str;
      };
    },
    useLanguage: () => ({ locale: 'en' as const, setLocale: () => undefined }),
  };
});

const mockRouter = vi.mocked(useRouter);
const mockAuthService = vi.mocked(authService);
const mockUserService = vi.mocked(userService);
const mockActivityService = vi.mocked(activityService);
const mockFinanceService = vi.mocked(financeService);

// Activity template rows are div[role="checkbox"][tabindex="0"] and carry
// the translated title as text; the Radix Checkbox inside them is also
// role="checkbox" but unlabeled, hence the tabindex discriminator.
function templateRows(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[role="checkbox"][tabindex="0"]')
  );
}

function rowByTitle(container: HTMLElement, title: string) {
  const row = templateRows(container).find((element) =>
    element.textContent?.includes(title)
  );
  if (!row) throw new Error(`Template row not found: ${title}`);
  return row;
}

function billCheckbox(title: string) {
  const row = screen.getByText(title).closest('div');
  const button = row?.querySelector('button');
  if (!button) throw new Error(`Bill checkbox not found: ${title}`);
  return button;
}

function seedUser() {
  mockAuthService.getCurrentUser.mockReturnValue({
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRouter.mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    // Required by the AppRouterInstance type introduced in Next 16.
    bfcacheId: 'mock-bfcache-id',
  } as ReturnType<typeof useRouter>);
  mockUserService.completeOnboarding.mockResolvedValue({} as never);
});

describe('OnboardingWizard — welcome step', () => {
  it('greets the signed-in user by name', () => {
    seedUser();

    render(<OnboardingWizard />);

    expect(
      screen.getByRole('heading', { name: 'Welcome to Life Tracker, Ada!' })
    ).toBeVisible();
    expect(screen.getByText('Step 1 of 3')).toBeVisible();
  });

  it('falls back to a generic greeting without a session user', () => {
    mockAuthService.getCurrentUser.mockReturnValue(null);

    render(<OnboardingWizard />);

    expect(
      screen.getByRole('heading', { name: 'Welcome to Life Tracker!' })
    ).toBeVisible();
  });

  it('disables Back on the first step and moves to activities on Next', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByRole('heading', { name: 'Pick starter activities' })
    ).toBeVisible();
    expect(screen.getByText('Step 2 of 3')).toBeVisible();
  });

  it('skips the guide: marks onboarding done and routes to activities', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() =>
      expect(mockUserService.completeOnboarding).toHaveBeenCalledTimes(1)
    );
    expect(mockRouter().push).toHaveBeenCalledWith('/activities');
  });
});

describe('OnboardingWizard — activities step', () => {
  async function gotoActivities(user: ReturnType<typeof userEvent.setup>) {
    seedUser();
    const view = render(<OnboardingWizard />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    return view.container;
  }

  it('shows the health templates by default', async () => {
    const user = userEvent.setup();
    await gotoActivities(user);

    expect(screen.getByText('Drink 8 glasses of water')).toBeVisible();
    expect(
      screen.queryByText('Deep work block 90 min')
    ).not.toBeInTheDocument();
  });

  it('applies a persona: preselects its categories and switches the tab', async () => {
    const user = userEvent.setup();
    const container = await gotoActivities(user);

    await user.click(screen.getByRole('button', { name: /Fit & Healthy/ }));

    expect(
      screen.getByRole('button', { name: /Fit & Healthy/ })
    ).toHaveAttribute('aria-pressed', 'true');
    // All 7 health template rows (the active tab) are preselected.
    const healthRows = templateRows(container);
    expect(healthRows).toHaveLength(7);
    expect(
      healthRows.every((row) => row.getAttribute('aria-checked') === 'true')
    ).toBe(true);

    // The second persona category is reachable through its tab.
    await user.click(screen.getByRole('button', { name: 'Home Training' }));
    const homeTrainingRows = templateRows(container);
    expect(homeTrainingRows).toHaveLength(6);
    expect(
      homeTrainingRows.every(
        (row) => row.getAttribute('aria-checked') === 'true'
      )
    ).toBe(true);
  });

  it('toggles the persona off and clears the selection', async () => {
    const user = userEvent.setup();
    const container = await gotoActivities(user);

    await user.click(screen.getByRole('button', { name: /Fit & Healthy/ }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      screen.getByRole('button', { name: /Fit & Healthy/ })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      templateRows(container).every(
        (row) => row.getAttribute('aria-checked') === 'false'
      )
    ).toBe(true);
  });

  it('switches category tabs', async () => {
    const user = userEvent.setup();
    const container = await gotoActivities(user);

    await user.click(screen.getByRole('button', { name: 'Productivity' }));

    expect(templateRows(container)).toHaveLength(4);
    expect(screen.getByText('Deep work block 90 min')).toBeVisible();
    expect(
      screen.queryByText('Drink 8 glasses of water')
    ).not.toBeInTheDocument();
  });

  it('toggles a single template through its row and the keyboard', async () => {
    const user = userEvent.setup();
    const container = await gotoActivities(user);

    const row = rowByTitle(container, 'Drink 8 glasses of water');
    expect(row).toHaveAttribute('aria-checked', 'false');

    await user.click(row);
    expect(rowByTitle(container, 'Drink 8 glasses of water')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    rowByTitle(container, 'Drink 8 glasses of water').focus();
    await user.keyboard('{Enter}');
    expect(rowByTitle(container, 'Drink 8 glasses of water')).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('goes back to the welcome step', async () => {
    const user = userEvent.setup();
    await gotoActivities(user);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(
      screen.getByRole('heading', { name: /Welcome to Life Tracker/ })
    ).toBeVisible();
  });

  it('moves to the finance step on Next', async () => {
    const user = userEvent.setup();
    await gotoActivities(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByRole('heading', { name: 'Recurring bills' })
    ).toBeVisible();
    expect(screen.getByText('Step 3 of 3')).toBeVisible();
  });
});

describe('OnboardingWizard — finance step', () => {
  // Renders, walks to finance, selecting the given templates along the way.
  async function gotoFinance(
    user: ReturnType<typeof userEvent.setup>,
    selectActivities: (container: HTMLElement) => Promise<void> = async () => {}
  ) {
    seedUser();
    const view = render(<OnboardingWizard />);
    const container = view.container;
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await selectActivities(container);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    return container;
  }

  it('disables amount inputs until the bill is selected', async () => {
    const user = userEvent.setup();
    await gotoFinance(user);

    const electricityAmount = screen.getByLabelText(
      'Amount — Electricity bill'
    );
    expect(electricityAmount).toBeDisabled();
    expect(electricityAmount).toHaveAttribute('placeholder', 'Suggested: 50');

    await user.click(billCheckbox('Electricity bill'));
    expect(screen.getByLabelText('Amount — Electricity bill')).toBeEnabled();
  });

  it('creates selected activities and bills, then shows the summary', async () => {
    const user = userEvent.setup();
    mockActivityService.createActivity.mockResolvedValue({} as never);
    mockFinanceService.createTransaction.mockResolvedValue({} as never);
    await gotoFinance(user, async (container) => {
      // Category tabs only filter; toggle the single template manually.
      await user.click(screen.getByRole('button', { name: 'Productivity' }));
      await user.click(rowByTitle(container, 'Deep work block 90 min'));
    });

    await user.click(billCheckbox('Electricity bill'));
    await user.type(screen.getByLabelText('Amount — Electricity bill'), '49.9');
    await user.click(billCheckbox('Salary'));

    await user.click(screen.getByRole('button', { name: 'Finish and start' }));

    await waitFor(() =>
      expect(mockUserService.completeOnboarding).toHaveBeenCalled()
    );
    expect(mockActivityService.createActivity).toHaveBeenCalledTimes(1);
    expect(mockActivityService.createActivity).toHaveBeenCalledWith({
      title: 'Deep work block 90 min',
      description: '',
      completionAmount: 1,
      frequency: 'weekly',
      dayFrequency: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      dayTime: 'morning',
      privacyStatus: 'private',
    });
    expect(mockFinanceService.createTransaction).toHaveBeenCalledTimes(2);
    expect(mockFinanceService.createTransaction).toHaveBeenCalledWith({
      type: 'outcome',
      frequency: 'fixed',
      paymentFrequency: 'monthly',
      category: 'Housing & Utilities',
      description: 'Electricity bill',
      amount: 49.9,
    });
    // No amount entered: the parsed NaN is coerced to 0, not rejected.
    expect(mockFinanceService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Salary', amount: 0 })
    );

    expect(screen.getByRole('heading', { name: 'All set!' })).toBeVisible();
    expect(screen.getByText('1 activities and 2 bills created.')).toBeVisible();
  });

  it('routes to activities from the done step', async () => {
    const user = userEvent.setup();
    mockActivityService.createActivity.mockResolvedValue({} as never);
    mockFinanceService.createTransaction.mockResolvedValue({} as never);
    await gotoFinance(user);
    await user.click(billCheckbox('Electricity bill'));
    await user.click(screen.getByRole('button', { name: 'Finish and start' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'All set!' })).toBeVisible()
    );

    await user.click(screen.getByRole('button', { name: 'Finish and start' }));

    expect(mockRouter().push).toHaveBeenCalledWith('/activities');
  });

  it('keeps the wizard usable when only some items fail', async () => {
    const user = userEvent.setup();
    mockActivityService.createActivity.mockRejectedValue(new Error('offline'));
    mockFinanceService.createTransaction
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('offline'));
    await gotoFinance(user);

    await user.click(billCheckbox('Electricity bill'));
    await user.click(billCheckbox('Salary'));
    await user.click(screen.getByRole('button', { name: 'Finish and start' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Created with warnings' })
      ).toBeVisible()
    );
    expect(
      screen.getByText(
        '1 items created, 1 failed. You can retry later from your profile or the templates.'
      )
    ).toBeVisible();
  });

  it('still finishes when marking onboarding complete fails', async () => {
    const user = userEvent.setup();
    mockUserService.completeOnboarding.mockRejectedValue(
      new Error('network down')
    );
    mockActivityService.createActivity.mockResolvedValue({} as never);
    mockFinanceService.createTransaction.mockResolvedValue({} as never);
    await gotoFinance(user);

    await user.click(billCheckbox('Electricity bill'));
    await user.click(screen.getByRole('button', { name: 'Finish and start' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'All set!' })).toBeVisible()
    );
    expect(mockUserService.completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it('returns from finance to the activities step with Back', async () => {
    const user = userEvent.setup();
    await gotoFinance(user);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(
      screen.getByRole('heading', { name: 'Pick starter activities' })
    ).toBeVisible();
  });

  it('hides the skip and step header on the done step', async () => {
    const user = userEvent.setup();
    mockActivityService.createActivity.mockResolvedValue({} as never);
    mockFinanceService.createTransaction.mockResolvedValue({} as never);
    await gotoFinance(user);
    await user.click(screen.getByRole('button', { name: 'Finish and start' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'All set!' })).toBeVisible()
    );

    expect(
      screen.queryByRole('button', { name: 'Skip for now' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 3/)).not.toBeInTheDocument();
  });

  it('keeps a bill selected when its amount is edited', async () => {
    const user = userEvent.setup();
    await gotoFinance(user);

    await user.click(billCheckbox('Electricity bill'));
    const amount = screen.getByLabelText('Amount — Electricity bill');
    await user.type(amount, '100');

    expect(amount).toHaveValue(100);
    expect(billCheckbox('Electricity bill')).toBeChecked();
  });
});
