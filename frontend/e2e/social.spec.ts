import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { registerUser, seedAuth, type E2EUser } from './helpers';

/**
 * Social flows (app/social/page.tsx + app/users/page.tsx):
 * - Search: debounced username search returns the unique target; the result
 *   card offers Follow. Fresh users have profilePrivacyStatus='public'
 *   (backend default), so the follow is accepted instantly ("Following").
 * - Public profile: /users?username=... renders the public profile (name,
 *   @handle, empty public lists) for other users; own profiles show "This is
 *   you" — asserted absent here.
 * - Private profile: after flipping the target to private through the API
 *   (the same PUT /users/me the profile page issues), the content is locked.
 * - Follow requests: a request created through the API (POST /follows/{user})
 *   appears in the Requests tab and can be accepted from the UI.
 */
const UNIQUE =
  Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/**
 * API root, mirroring e2e/helpers.ts: same-origin nginx proxy by default, or
 * the dev lane's PLAYWRIGHT_API_URL. Not exported by the helpers yet.
 */
function apiRoot(request: APIRequestContext): string {
  const origin = (request as unknown as { _origin?: string })._origin;
  const base =
    origin || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const root = process.env.PLAYWRIGHT_API_URL || '/api';
  return root.startsWith('http') ? root : `${base}${root}`;
}

/** Authenticated PUT against the API as the given user. */
async function updateUserPrivacy(
  request: APIRequestContext,
  user: E2EUser,
  profilePrivacyStatus: 'public' | 'private'
): Promise<void> {
  const response = await request.put(`${apiRoot(request)}/users/me`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { profilePrivacyStatus },
  });
  expect(
    response.ok(),
    `updating privacy failed: ${response.status()} ${await response.text()}`
  ).toBeTruthy();
}

test('search a user and follow them (public profile auto-accepts)', async ({
  page,
  request,
}) => {
  const actor = await registerUser(request, 'e2esfa');
  const target = await registerUser(request, 'e2esft', {
    firstName: 'Social',
    lastName: 'Target',
  });
  await seedAuth(page, actor);

  await page.goto('/social/');
  await expect(page.getByRole('heading', { name: 'Social' })).toBeVisible();

  // Search is debounced (300ms); the unique username matches exactly once.
  await page.getByPlaceholder('Search by username...').fill(target.username);
  await expect(page.getByText('Found 1 users')).toBeVisible({
    timeout: 10000,
  });

  const targetCard = page
    .locator('[data-slot="card"]', { hasText: target.username })
    .first();
  await expect(targetCard.getByText(`@${target.username}`)).toBeVisible();
  await targetCard.getByRole('button', { name: 'Follow', exact: true }).click();

  // Public target: the request is accepted immediately.
  await expect(
    targetCard.getByRole('button', { name: 'Following' })
  ).toBeVisible();
  await expect(page.getByText('You are now following Social')).toBeVisible();
});

test('view a public profile through /users', async ({ page, request }) => {
  const viewer = await registerUser(request, 'e2espv');
  const target = await registerUser(request, 'e2espt', {
    firstName: 'Public',
    lastName: 'Person',
  });
  await seedAuth(page, viewer);

  await page.goto(`/users?username=${target.username}`);
  await expect(
    page.getByRole('heading', { name: 'Public Person' })
  ).toBeVisible();
  await expect(page.getByText(`@${target.username}`)).toBeVisible();

  // Empty public content sections on a fresh account.
  await expect(page.getByText('No public routines yet')).toBeVisible();
  await expect(page.getByText('No public activities yet')).toBeVisible();

  // It is someone else's profile, so no self marker and no content lock.
  await expect(page.getByText('This is you')).toBeHidden();
  await expect(page.getByText('This profile is private')).toBeHidden();
});

test('a private profile locks its content for other users', async ({
  page,
  request,
}) => {
  const viewer = await registerUser(request, 'e2eslv');
  const target = await registerUser(request, 'e2eslt', {
    firstName: 'Secret',
    lastName: 'Person',
  });
  await updateUserPrivacy(request, target, 'private');
  await seedAuth(page, viewer);

  await page.goto(`/users?username=${target.username}`);
  await expect(
    page.getByRole('heading', { name: 'Secret Person' })
  ).toBeVisible();
  // Locked message names the owner; the public lists are replaced.
  await expect(page.getByText('This profile is private')).toBeVisible();
  await expect(page.getByText('No public activities yet')).toBeHidden();
});

test('accept a pending follow request from the Requests tab', async ({
  page,
  request,
}) => {
  const actor = await registerUser(request, 'e2esra');
  const target = await registerUser(request, 'e2esrb');

  // Follows to a PUBLIC profile auto-accept (the default privacy is public),
  // so make the actor private first to generate a pending request.
  await updateUserPrivacy(request, actor, 'private');

  // The target requests to follow the actor through the API (doing it through
  // the UI would need a second browser session in the same spec).
  const followResponse = await request.post(
    `${apiRoot(request)}/follows/${actor.username}`,
    {
      headers: { Authorization: `Bearer ${target.accessToken}` },
      data: {},
    }
  );
  expect(
    followResponse.ok(),
    `follow request failed: ${followResponse.status()} ${await followResponse.text()}`
  ).toBeTruthy();

  await seedAuth(page, actor);
  await page.goto('/social/');
  await page.getByRole('tab', { name: 'Requests' }).click();
  await expect(page.getByText('Pending requests (1)')).toBeVisible();
  await expect(page.getByText(/wants to follow you/)).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();

  // Accepted requests leave the pending list.
  await expect(page.getByText('No pending requests')).toBeVisible();
});
