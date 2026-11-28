import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Time tracking flows (app/time/page.tsx: Records + Calendar tabs):
 * - Session timer: category is required to start; the active session card
 *   offers Stop (pause) and then Save, which POSTs at least one minute and
 *   removes the card from "Active Recordings".
 * - Manual records: "Log Time" modal (#category / #description + two number
 *   inputs for hours:minutes) and the edit modal reuse the same fields.
 * - Calendar: "New event" opens the event modal (#event-title) pre-filled for
 *   today 09:00-10:00; the created event is a button whose accessible name is
 *   "{title}, {time range}" in the week grid; clicking it opens "Edit event".
 */
const UNIQUE =
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

test('start a timer session, stop it and save it as a time record', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/time/');
  await expect(
    page.getByRole('heading', { name: 'Time Tracking' })
  ).toBeVisible();

  const description = `e2e session ${UNIQUE}`;
  await page.locator('#timer-category').click();
  await page.getByRole('option', { name: 'Work' }).click();
  await page.locator('#timer-description').fill(description);
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  // The active session card appears under "Active Recordings".
  const activeHeading = page.getByText('Active Recordings');
  await expect(activeHeading).toBeVisible();
  const sessionCard = page
    .locator('[data-slot="card"]', { hasText: description })
    .first();
  await sessionCard.getByRole('button', { name: 'Stop' }).click();

  // Paused: Save (and Resume) replace Stop; saving persists the record.
  await sessionCard.getByRole('button', { name: 'Save' }).click();
  await expect(activeHeading).toBeHidden();
  await expect(page.getByText(description).first()).toBeVisible();
});

test('log a time record manually and edit it', async ({ page, request }) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/time/');
  await expect(
    page.getByRole('heading', { name: 'Time Tracking' })
  ).toBeVisible();

  const description = `e2e manual ${UNIQUE}`;
  await page.getByRole('button', { name: 'Log Time' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox')
    .filter({ hasText: 'Select category' })
    .click();
  await page.getByRole('option', { name: 'Study' }).click();
  await dialog.locator('#description').fill(description);
  // Hours : minutes are two unnamed number inputs in a fixed order.
  const duration = dialog.locator('input[type="number"]');
  await duration.nth(0).fill('1');
  await duration.nth(1).fill('30');
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page
    .locator('[data-slot="card"]', { hasText: description })
    .first();
  await expect(card).toBeVisible();
  await expect(card.getByText('1h 30m')).toBeVisible();

  // Edit through the card's dropdown menu.
  await card.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByText('Edit Time Entry')).toBeVisible();
  const editDuration = editDialog.locator('input[type="number"]');
  await editDuration.nth(0).fill('0');
  await editDuration.nth(1).fill('45');
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText('45 min')).toBeVisible();
});

test('create a calendar event and edit it', async ({ page, request }) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/time/');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'New event' }).click();

  const title = `e2e event ${UNIQUE}`;
  const dialog = page.getByRole('dialog');
  await dialog.locator('#event-title').fill(title);
  // Date/time defaults come from the toolbar (today, 09:00-10:00).
  await dialog.getByRole('button', { name: 'Save' }).click();

  // The event renders in the week grid as a button "{title}, {time range}".
  const eventBlock = page.getByRole('button', { name: title });
  await expect(eventBlock).toBeVisible();

  // Clicking the block opens the edit modal with the title pre-filled.
  await eventBlock.click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByText('Edit event')).toBeVisible();
  const newTitle = `e2e event edited ${UNIQUE}`;
  await editDialog.locator('#event-title').fill(newTitle);
  await editDialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: newTitle })).toBeVisible();
  await expect(page.getByRole('button', { name: title })).toHaveCount(0);
});
