import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Auth seeding for the essential E2E suite.
 *
 * Facts verified from source (do not guess — re-check if auth changes):
 * - `packages/shared/src/lib/storage.ts`: on web the storage facade IS
 *   localStorage — no adapter indirection keys.
 * - `packages/shared/src/services/auth-service.ts` persists exactly three
 *   keys and hydrates them in the service constructor (at module import):
 *     - accessToken (raw string)
 *     - refreshToken (raw string)
 *     - currentUser (JSON-serialized user object)
 * - `authService.isAuthenticated()` = currentUser && accessToken both set.
 *
 * Therefore seeding MUST use page.addInitScript: it runs before the app's
 * bundle is evaluated, so the singleton constructor picks the tokens up —
 * and it survives page.reload() (each new document re-runs the script).
 */
export const E2E_PASSWORD = 'e2e-pass-123';

export interface E2EUser {
  id?: number | string;
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken: string;
}

/** Base URL of the test target (same origin that serves the app). */
function baseUrl(ctx: APIRequestContext): string {
  const origin = (ctx as unknown as { _origin?: string })._origin;
  return origin || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
}

/**
 * Register a fresh user via the API (payload mirrors loadtest/common.js
 * userPayload; backend rules: username 3-30 chars, password min 6).
 * Unique per run, so reruns never hit "user already exists".
 */
export async function registerUser(
  request: APIRequestContext,
  prefix = 'e2e'
): Promise<E2EUser> {
  const seq =
    Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const username = `${prefix}_${seq}`.slice(0, 30);
  const user: E2EUser = {
    email: `${username}@e2e.local`,
    username,
    password: E2E_PASSWORD,
    firstName: 'E2E',
    lastName: 'Runner',
    accessToken: '',
    refreshToken: '',
  };

  const response = await request.post(`${baseUrl(request)}/api/auth/register`, {
    data: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password,
      username: user.username,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `e2e register failed (${response.status()}): ${await response.text()}`
    );
  }

  const body = (await response.json()) as {
    data: {
      tokens: { accessToken: string; refreshToken: string };
      user: { id: number | string };
    };
  };
  user.accessToken = body.data.tokens.accessToken;
  user.refreshToken = body.data.tokens.refreshToken;
  user.id = body.data.user.id;
  return user;
}

/**
 * Seed the three localStorage keys the shared auth-service reads, before any
 * app script runs. Survives reloads (addInitScript runs per navigation).
 */
export async function seedAuth(page: Page, user: E2EUser): Promise<void> {
  await page.addInitScript(
    ({ accessToken, refreshToken, currentUser }) => {
      window.localStorage.setItem('accessToken', accessToken);
      window.localStorage.setItem('refreshToken', refreshToken);
      window.localStorage.setItem('currentUser', JSON.stringify(currentUser));
    },
    {
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      currentUser: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    }
  );
}
