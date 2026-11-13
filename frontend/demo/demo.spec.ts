import { test, expect, type Locator, type Page } from '@playwright/test';
import { registerUser } from '../e2e/helpers';

/**
 * Demo video: "a real day with Life Tracker".
 *
 * One continuous take → demo/output/demo.mp4. Not a test — pauses are the
 * point (they let transitions play on camera), so page.waitForTimeout is
 * used deliberately here despite being an anti-pattern in real e2e specs.
 *
 * Narrative (each scene ends the moment its toast/effect lands):
 *   login → skip onboarding →
 *   1. create "Drink a water bottle" (morning, daily) → complete it →
 *   2. build a "Healthy day" routine (Walk / Stretch / Gym), left pending →
 *   3. live meditation timer: Start → few seconds → Stop → Save →
 *   4. dev note "Backend e-commerce app" with markdown → Preview →
 *   5. sticky notes for later (agents.md / AI agents) →
 *   6. close back on the activities page: habit done, routine pending.
 */

// ---------------------------------------------------------------------------
// Synthetic cursor. Headless Chromium draws no pointer, so a watchable demo
// needs one. We render a dot fixed in the viewport and let it follow the
// real mousemove events Playwright dispatches, then move to each target
// with `steps` so the motion is animated instead of a teleport.
// Init scripts run before the document has content — documentElement/head
// are not ready yet — so installation is deferred to DOMContentLoaded.
// addInitScript resolves with a Disposable; await discards it.
// ---------------------------------------------------------------------------
async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const install = () => {
      if (document.getElementById('demo-cursor')) return;

      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      Object.assign(cursor.style, {
        position: 'fixed',
        zIndex: '2147483647',
        pointerEvents: 'none',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: '2px solid #0f172a',
        background: 'rgba(255, 255, 255, 0.35)',
        left: '630px',
        top: '350px',
        transition: 'left 80ms linear, top 80ms linear',
      });
      document.documentElement.appendChild(cursor);

      // The cursor follows the real mousemove events Playwright dispatches.
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX - 10 + 'px';
        cursor.style.top = e.clientY - 10 + 'px';
      });

      // Hide the Next.js dev-tools badge — it must not appear in a frame.
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      (document.head || document.documentElement).appendChild(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install);
    } else {
      install();
    }
  });
}

/** Animate the cursor onto the target, then click it. */
async function demoClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 12,
    });
    await page.waitForTimeout(200);
  }
  await locator.click();
}

/** Hold a scene for `ms` so the viewer can read it. */
async function hold(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Single mouse click at the element's center — no Playwright retry. Use for
 * buttons whose click mutates the layout around them: when a click shifts
 * the page (e.g. a session card appears above the button), Playwright's
 * retry logic can fire the action a second time against the new state.
 */
async function rawClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 12,
    });
    await page.waitForTimeout(200);
  }
  await page.mouse.down();
  await page.mouse.up();
}

/**
 * Open the nth Radix select inside `scope` (triggers have no ids in the
 * activity form; field order is fixed: Time of Day, Frequency, Privacy)
 * and pick an option by its visible label.
 */
async function pickSelect(
  page: Page,
  scope: Locator,
  index: number,
  optionLabel: string
): Promise<void> {
  await demoClick(page, scope.getByRole('combobox').nth(index));
  // Let the Radix listbox zoom animation settle — clicking an option while
  // it is still animating commits the wrong (highlighted) option.
  await hold(page, 400);
  await page.getByRole('option', { name: optionLabel }).click();
  // The committed value must show in the trigger before we move on.
  // NOTE: the activity form's SelectValue renders the raw enum ("morning",
  // "anyMoment") rather than the translated label — assert case-insensitively.
  await expect(scope.getByRole('combobox').nth(index)).toContainText(
    new RegExp(optionLabel, 'i')
  );
  await hold(page, 300);
}

// Stable i18n strings from packages/shared/src/messages/en.json (language
// initialises to 'en'). Keep in sync with the source if labels change.
const SIDEBAR = (page: Page) => page.getByRole('complementary');
const navLink = (page: Page, name: string) =>
  SIDEBAR(page).getByRole('link', { name, exact: true });

test('record the life-tracker "real day" demo', async ({ page, request }) => {
  const user = await registerUser(request, 'demo', {
    firstName: 'Alex',
    lastName: 'Morgan',
  });
  await installCursor(page);

  // --- Scene 1: login, skip onboarding ------------------------------------
  await page.goto('/login');
  await hold(page, 1500);

  const usernameInput = page.getByLabel(/username or email/i);
  const passwordInput = page.getByLabel('Password', { exact: true });
  await demoClick(page, usernameInput);
  await usernameInput.fill(user.username);
  await demoClick(page, passwordInput);
  await passwordInput.fill(user.password);
  await hold(page, 600);
  await demoClick(page, page.getByRole('button', { name: 'Sign in' }));

  await page.waitForURL(/\/onboarding/);
  await expect(page.getByText(/set yourself up in a minute/i)).toBeVisible();
  await hold(page, 1500);
  await demoClick(
    page,
    page.getByRole('button', { name: 'Skip for now', exact: true })
  );
  await page.waitForURL(/\/activities/);
  await expect(
    page.getByText("Today's Activities", { exact: true })
  ).toBeVisible();
  await hold(page, 2500);

  // --- Scene 2: create "Drink a water bottle" and complete it -------------
  await demoClick(page, page.getByRole('button', { name: 'New Activity' }));
  await expect(page.getByText('Create New Activity')).toBeVisible();
  await hold(page, 1200);

  const titleInput = page.locator('#entity-title');
  await demoClick(page, titleInput);
  await titleInput.pressSequentially('Drink a water bottle', { delay: 55 });
  await hold(page, 500);
  // Field order in the modal: Time of Day (0), Frequency (1), Privacy (2).
  await pickSelect(page, page.getByRole('dialog'), 0, 'Morning');
  await hold(page, 500);
  await demoClick(page, page.getByRole('button', { name: 'Create Activity' }));
  await expect(page.getByText('Activity created')).toBeVisible();
  await hold(page, 1500);

  // Completing = clicking the whole card (instant optimistic UI).
  const waterCard = page
    .locator('.cursor-pointer')
    .filter({ hasText: 'Drink a water bottle' })
    .first();
  await demoClick(page, waterCard);
  await expect(page.getByText('Activity Completed!')).toBeVisible();
  await hold(page, 3000);

  // --- Scene 3: "Healthy day" routine, left pending -----------------------
  await demoClick(page, page.getByRole('button', { name: 'Routines' }));
  await expect(
    page.getByText('Group your activities into routines')
  ).toBeVisible();
  await hold(page, 1500);
  await demoClick(page, page.getByRole('button', { name: 'New Routine' }));
  await expect(page.locator('#routine-title')).toBeVisible();
  await hold(page, 800);

  await page.locator('#routine-title').pressSequentially('Healthy day', {
    delay: 55,
  });
  await page
    .locator('#routine-description')
    .pressSequentially('Move a little every day.', { delay: 40 });

  // Nested "New Activity" inside the routine modal; the topmost dialog is
  // the activity form (later in the DOM than the routine dialog).
  const topDialog = () => page.getByRole('dialog').last();
  for (const name of ['Walk', 'Stretch', 'Gym']) {
    await demoClick(
      page,
      page.getByRole('button', { name: 'New Activity' }).last()
    );
    const nestedTitle = page.locator('#entity-title').last();
    await expect(nestedTitle).toBeVisible();
    await demoClick(page, nestedTitle);
    await nestedTitle.pressSequentially(name, { delay: 60 });
    await demoClick(
      page,
      page.getByRole('button', { name: 'Create Activity' })
    );
    // The nested modal closes and the activity joins the routine's list.
    await expect(topDialog().getByText(name, { exact: true })).toBeVisible();
    await hold(page, 800);
  }

  await demoClick(page, page.getByRole('button', { name: 'Create Routine' }));
  await expect(page.getByText('Routine created')).toBeVisible();
  await hold(page, 2000);
  // shadcn dialogs close via the X button (sr-only "Close").
  await demoClick(page, page.getByRole('button', { name: 'Close' }));
  await expect(
    page.getByText("Today's Activities", { exact: true })
  ).toBeVisible();
  await hold(page, 3000);

  // --- Scene 4: live meditation timer --------------------------------------
  await demoClick(page, navLink(page, 'Time tracker'));
  await page.waitForURL(/\/time/);
  await hold(page, 2000);

  await demoClick(page, page.locator('#timer-category'));
  await hold(page, 400); // listbox animation
  await page.getByRole('option', { name: 'Meditation' }).click();
  await expect(page.locator('#timer-category')).toContainText('Meditation');
  await hold(page, 400);
  // The description must be typed BEFORE Start — the session carries it and
  // Save rejects an empty description.
  const timerDescription = page.locator('#timer-description');
  await timerDescription.pressSequentially('Morning meditation', { delay: 60 });
  await expect(timerDescription).toHaveValue('Morning meditation');
  // rawClick: the click inserts a session card above the button (layout
  // shift); a retried click would hit the now-cleared form.
  await rawClick(
    page,
    page.getByRole('button', { name: 'Start', exact: true })
  );
  await expect(page.getByText('Active Recordings')).toBeVisible();
  // The session card must carry the full description.
  await expect(page.getByText('Morning meditation')).toBeVisible();
  await hold(page, 5000); // the ticking HH:MM:SS + particles is the beat
  await rawClick(page, page.getByRole('button', { name: 'Stop', exact: true }));
  await hold(page, 1000);
  // Durations round to whole minutes: this saves as "1 min" — app behavior.
  await rawClick(page, page.getByRole('button', { name: 'Save', exact: true }));
  await expect(page.getByText(/Saved 1 min for Meditation/)).toBeVisible();
  await hold(page, 3500);

  // --- Scene 5: real dev note with markdown --------------------------------
  await demoClick(page, navLink(page, 'Notes'));
  await page.waitForURL(/\/notes/);
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await hold(page, 2000);

  await demoClick(page, page.getByRole('button', { name: 'New Note' }));
  const noteTitle = page.getByPlaceholder('Note title');
  await expect(page.getByPlaceholder('Start writing...')).toBeVisible();
  await demoClick(page, noteTitle);
  // The editor pre-fills "Untitled" — clear it, then type the real title.
  await noteTitle.fill('');
  await noteTitle.pressSequentially('Backend e-commerce app', { delay: 55 });
  await demoClick(page, page.getByPlaceholder('Start writing...'));
  await page
    .getByPlaceholder('Start writing...')
    .pressSequentially(
      '## Goal\nBuild the e-commerce backend.\n\n- Improve response times\n- Add caching + DB indexes\n- Profile slow queries',
      { delay: 25 }
    );
  await demoClick(
    page,
    page.getByRole('button', { name: 'Save', exact: true })
  );
  await expect(page.getByText('Your changes have been saved.')).toBeVisible();
  // Save exits edit mode — the rendered markdown is already on screen.
  await hold(page, 3500);

  // --- Scene 6: sticky notes for later (closing idea capture) --------------
  await demoClick(page, page.getByRole('tab', { name: 'Sticky Notes' }));
  await hold(page, 1500);

  const stickies = [
    {
      title: 'Improve agents.md in dotfiles',
      body: 'Read and try to improve agents.md files from my dotfiles/',
    },
    {
      title: 'Automate daily work',
      body: 'Think how can I automate my daily work with AI Agents',
    },
  ];
  for (const sticky of stickies) {
    await demoClick(page, page.getByRole('button', { name: 'New Note' }));
    // NOTE: /notes tabs stay mounted once visited — the hidden notes editor
    // keeps its "Note title" input in the DOM, so attribute locators must be
    // exact (getByPlaceholder('Title') would also match "Note title").
    const stickyTitle = page.getByRole('textbox', {
      name: 'Title',
      exact: true,
    });
    const stickyBody = page.getByPlaceholder('Write something...', {
      exact: true,
    });
    await expect(stickyBody).toBeVisible();
    await demoClick(page, stickyTitle);
    await stickyTitle.pressSequentially(sticky.title, { delay: 50 });
    await demoClick(page, stickyBody);
    await stickyBody.pressSequentially(sticky.body, { delay: 30 });
    await demoClick(
      page,
      page.getByRole('button', { name: 'Save', exact: true })
    );
    // Saved card renders the title as text instead of the input.
    await expect(page.getByText(sticky.title, { exact: true })).toBeVisible();
    await hold(page, 1500);
  }
  await hold(page, 2500);

  // --- Scene 7: closing shot — back where the day started ------------------
  await demoClick(page, navLink(page, 'Activities'));
  await page.waitForURL(/\/activities/);
  await expect(
    page.getByText("Today's Activities", { exact: true })
  ).toBeVisible();
  // Completed habit (green) + pending Walk/Stretch/Gym cards on screen.
  await expect(page.getByText('Drink a water bottle').first()).toBeVisible();
  await hold(page, 4500);
});
