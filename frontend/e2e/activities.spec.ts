import { test, expect } from '@playwright/test';
import { registerUser, seedAuth } from './helpers';

/**
 * Activities page core flows (app/activities/page.tsx + its modals):
 * - "New Activity" opens the unified activity form modal (#entity-title /
 *   #entity-description); the card lands on today's view grouped by time of
 *   day, with a "current/target" progress line.
 * - Tapping an incomplete card records a completion (optimistic + POST);
 *   a completed card shows the "Complete" badge and stops being clickable.
 * - Templates modal: routine templates create their child activities and then
 *   bundle them into a routine (activityService.createActivity +
 *   routineService.createRoutine).
 */
const UNIQUE =
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

test('create an activity and record a completion by tapping its card', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/activities/');
  await expect(
    page.getByRole('heading', { name: "Today's Activities" })
  ).toBeVisible();

  const title = `e2e activity ${UNIQUE}`;
  await page.getByRole('button', { name: 'New Activity' }).click();
  await page.locator('#entity-title').fill(title);
  await page
    .locator('#entity-description')
    .fill('created by activities.spec.ts');
  await page.getByRole('button', { name: 'Create Activity' }).click();

  const card = page.locator('[data-slot="card"]', { hasText: title }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('0/1')).toBeVisible();

  // Tap the card body (not the menu) to record today's completion.
  await card.getByText(title).click();
  await expect(card.getByText('1/1')).toBeVisible();
  await expect(card.getByText('Complete', { exact: true })).toBeVisible();
});

test('create a routine from a template through the templates modal', async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await seedAuth(page, user);

  await page.goto('/activities/');
  await expect(
    page.getByRole('heading', { name: "Today's Activities" })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Templates' }).click();
  const templates = page.getByRole('dialog');
  await expect(templates.getByText('Templates')).toBeVisible();

  // Switch the template kind to routines; the category resets to the first
  // routine category (Home), where "Morning reset" lives.
  await templates.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Routines' }).click();
  await templates.getByRole('checkbox', { name: 'Morning reset' }).click();
  await templates.getByRole('button', { name: 'Create 1 selected' }).click();

  // Creation is sequential (child activities, then the routine); the modal
  // closes and the page reloads once everything was created.
  await expect(templates).toBeHidden({ timeout: 20000 });

  // The routine appears in the routines modal with its bundled activities.
  await page.getByRole('button', { name: 'Routines' }).click();
  const routines = page.getByRole('dialog');
  await routines.getByRole('button', { name: /Morning reset/ }).click();
  await expect(routines.getByText('4 activities').first()).toBeVisible();
  await expect(
    routines.getByText('Drink 8 glasses of water').first()
  ).toBeVisible();
});
