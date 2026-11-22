import { test, expect } from '@playwright/test';

/**
 * UI registration → first-run onboarding wizard → authenticated landing.
 *
 * Facts from app/register/page.tsx + app/onboarding/onboarding-wizard.tsx:
 * - Successful UI registration routes to /onboarding (fresh users have
 *   onboardingCompleted=false, like the login path in auth-login.spec.ts).
 * - The wizard has three steps (welcome → activities → finance) plus a done
 *   screen. The finance step's Next button and the final button share the
 *   label "Finish and start", but never at the same time.
 * - Checked templates are created through the real services (activities first,
 *   then bills), then the final button routes to /activities.
 * - The UI enforces 8+ character passwords (backend accepts 6+); the register
 *   form is driven directly through the UI instead of e2e/helpers because the
 *   flow under test IS the registration page.
 */
/** Unique per registration, so reruns never hit "user already exists". */
function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

test('register through the UI and finish the wizard to land on /activities', async ({
  page,
}) => {
  const username = `onb_${uniqueSuffix()}`.slice(0, 30);
  const password = 'e2e-pass-123';

  await page.goto('/register');
  await page.getByLabel('First name').fill('Wizard');
  await page.getByLabel('Last name').fill('Runner');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@e2e.local`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // First run: the wizard welcome step greets the user by first name.
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/Welcome to Life Tracker/)).toBeVisible();

  // Step 2: pick one activity template (row divs are role=checkbox with the
  // template name as accessible name).
  await page.getByRole('button', { name: 'Next' }).click();
  const water = page.getByRole('checkbox', {
    name: 'Drink 8 glasses of water',
  });
  await water.click();
  await expect(water).toHaveAttribute('aria-checked', 'true');

  // Step 3: pick one recurring bill and set its amount.
  await page.getByRole('button', { name: 'Next' }).click();
  // The bill checkboxes are unnamed Radix checkboxes; reach the one in the
  // "Electricity bill" row (the first template in FINANCE_TEMPLATES order).
  const electricity = page
    .getByText('Electricity bill')
    .locator('xpath=preceding-sibling::button[@role="checkbox"]');
  await electricity.click();
  await expect(electricity).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Amount — Electricity bill').fill('99.9');

  // Finish: templates are created through the real API, then the done step.
  await page.getByRole('button', { name: 'Finish and start' }).click();
  await expect(page.getByText('All set!')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Finish and start' }).click();

  await page.waitForURL(/\/activities/);
  await expect(
    page.getByRole('heading', { name: "Today's Activities" })
  ).toBeVisible();
  await expect(
    page.getByText('Drink 8 glasses of water').first()
  ).toBeVisible();
});

test('register through the UI and skip the wizard to land on /activities', async ({
  page,
}) => {
  const username = `onb_${uniqueSuffix()}`.slice(0, 30);
  const password = 'e2e-pass-123';

  await page.goto('/register');
  await page.getByLabel('First name').fill('Skipper');
  await page.getByLabel('Last name').fill('Runner');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@e2e.local`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL(/\/onboarding/);
  // Skip marks onboarding complete best-effort and routes to the app.
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await page.waitForURL(/\/activities/);
  // Authenticated shell: the sidebar only renders for logged-in users.
  await expect(page.getByRole('complementary')).toBeVisible();
});
