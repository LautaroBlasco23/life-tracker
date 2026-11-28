import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Finance flows (app/finance/page.tsx: Transactions + Dashboard tabs):
 * - "Add transaction" opens the create modal (#amount / #category /
 *   #description); variable transactions land in the movements feed grouped
 *   by day with a "-$amount" (expense) label.
 * - Movements are edited through the card's dropdown menu into the edit modal
 *   (#edit-amount); the feed silently refetches after the update.
 * - Recurring bills ("Recurring bill" switch) appear in the Bills section as
 *   fixed transactions; recording a payment marks them paid for the period
 *   ("{paid}/{total} paid").
 * - The Dashboard tab renders summary cards and the monthly trend (the USD
 *   rate cards hit an external API that may be unreachable — not asserted).
 */
const UNIQUE =
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

test('create and edit a variable transaction from the transactions tab', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/finance/');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();

  const description = `e2e expense ${UNIQUE}`;
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Add transaction' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#description').fill(description);
  await dialog.locator('#amount').fill('42');
  await dialog.locator('#category').click();
  // Pick the first available expense category (backend catalog decides the
  // exact list); the description is what identifies the movement.
  await page.getByRole('option').first().click();
  await dialog.getByRole('button', { name: 'Create Transaction' }).click();

  const card = page
    .locator('[data-slot="card"]', {
      hasText: description,
      has: page.getByRole('button', { name: 'Open menu' }),
    })
    .first();
  await expect(card).toBeVisible();
  await expect(card.getByText('-$42')).toBeVisible();

  // Edit the amount through the card's dropdown menu.
  await card.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByText('Edit Transaction')).toBeVisible();
  await editDialog.locator('#edit-amount').fill('55');
  await editDialog.getByRole('button', { name: 'Update Transaction' }).click();
  await expect(card.getByText('-$55')).toBeVisible({ timeout: 15000 });
});

test('create a recurring bill and mark a payment for it', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/finance/');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();

  const billDescription = `e2e bill ${UNIQUE}`;
  await page
    .getByRole('banner')
    .getByRole('button', { name: 'Add transaction' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#description').fill(billDescription);
  // Recurring on: the amount input is disabled (paid per period instead).
  await dialog.locator('#recurring').click();
  await dialog.locator('#category').click();
  await page.getByRole('option').first().click();
  await dialog
    .getByRole('button', { name: 'Create Fixed Transaction' })
    .click();

  // BillsSection loads its list on mount only (the page-level create modal
  // refreshes the movements feed, not the bills), so reload to see the bill.
  await page.reload();
  const billCard = page
    .locator('[data-slot="card"]', {
      hasText: billDescription,
      has: page.getByRole('button', { name: 'Open menu' }),
    })
    .first();
  await expect(billCard).toBeVisible();
  await expect(page.getByText('0/1 paid')).toBeVisible();

  // Record a payment through the card's dropdown menu.
  await billCard.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Record payment' }).click();
  const paymentDialog = page.getByRole('dialog', { name: 'Record Payment' });
  await expect(paymentDialog).toBeVisible();
  await paymentDialog.locator('#payment-amount').fill('99');
  await paymentDialog.getByRole('button', { name: 'Record Payment' }).click();

  await expect(page.getByText('Payment recorded')).toBeVisible();
  // The Bills section refetches: the bill is now paid for the period.
  await expect(page.getByText('1/1 paid')).toBeVisible();
});

test('dashboard tab renders the summary cards', async ({ page, request }) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/finance/');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();

  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await expect(page.getByText('Total income')).toBeVisible();
  await expect(page.getByText('Total expenses')).toBeVisible();
  await expect(page.getByText('Balance')).toBeVisible();

  // Fresh account: no data behind the monthly trend chart.
  await expect(page.getByText('Monthly trend')).toBeVisible();
  await expect(page.getByText('No income recorded this month.')).toBeVisible();
  await expect(
    page.getByText('No expenses recorded this month.')
  ).toBeVisible();
  await expect(page.getByText('All bills paid. Nice!')).toBeVisible();
});
