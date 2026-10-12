import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { testHousehold } from '@huishouden/pwa-kit/staging';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening Baby costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), each in a
// fresh browser context (a first open, nothing cached). A change that raises a ceiling says why in
// its PR. An invented household expecting a baby in ten weeks: three appointments ahead and one
// private, three checklist items, two contractions and two kick counts this week (and one of each
// two months ago, past what the timer and the counter read), the kick settings, two contacts.
const NOW = Date.now();
const DAY = 86_400_000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const { admin } = testHousehold('reads').users;
const by = admin.email;

const appt = (id: string, title: string, at: number, extra: Record<string, unknown> = {}) => ({ [`babyAppointments/${id}`]: { title, at, private: false, createdAt: NOW - 30 * DAY, by, ...extra } });
const check = (id: string, text: string, order: number) => ({ [`babyChecklists/${id}`]: { list: 'Hospital bag', text, done: false, order, createdAt: NOW - 30 * DAY, by } });
const contraction = (id: string, start: number) => ({ [`babyContractions/${id}`]: { start, end: start + 60_000, by, createdAt: start } });
const kicks = (id: string, start: number) => ({ [`babyKickSessions/${id}`]: { start, end: start + 600_000, taps: Array.from({ length: 10 }, (_, i) => start + i * 60_000), target: 10, by, createdAt: start } });
const contact = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ [`contacts/${id}`]: { name, role: 'Midwife', phone: '555-0100', apps: ['baby'], private: false, createdAt: NOW - DAY, by, ...extra } });

const hh = useTestHousehold(test, {
  scope: 'reads',
  docs: {
    'babyProfile/main': { dueDate: ymd(NOW + 70 * DAY), updatedAt: NOW - 30 * DAY, updatedBy: by },
    ...appt('a1', 'Test checkup', NOW + 3 * DAY),
    ...appt('a2', 'Test scan', NOW + 17 * DAY),
    ...appt('a3', 'Test class', NOW + 30 * DAY),
    ...appt('a4', 'Test private visit', NOW + 5 * DAY, { private: true }),
    ...check('c1', 'Test pack the bag', 1),
    ...check('c2', 'Test car seat', 2),
    ...check('c3', 'Test snacks', 3),
    ...contraction('k1', NOW - 2 * DAY),
    ...contraction('k2', NOW - DAY),
    ...contraction('k-old', NOW - 60 * DAY),
    ...kicks(ymd(NOW - 2 * DAY), NOW - 2 * DAY),
    ...kicks(ymd(NOW - DAY), NOW - DAY),
    ...kicks(ymd(NOW - 60 * DAY), NOW - 60 * DAY),
    'babyKickSettings/main': { target: 10, remindAt: '20:00', updatedAt: NOW - DAY, updatedBy: by },
    ...contact('midwife', 'Test Midwife'),
    ...contact('doula', 'Test Doula', { private: true }),
  },
});

// One open at a time: another open's writes (a sign-in's profile, its publish) would reach this
// page's listeners and be counted as its reads.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

const loaded = (page: Page) => expect(page.getByText('Test checkup').first()).toBeVisible({ timeout: 30_000 });

// Each person has used Baby before on another device: a first sign-in's own writes are done, so
// they don't land in a measured open as changes its listeners bill, early or late.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  for (const as of ['admin', 'member', 'helper', 'kid'] as const) {
    const page = await hh.open(browser, as);
    await loaded(page);
    await page.waitForTimeout(3000);
    await page.close();
  }
});

async function firstOpen(browser: Browser, as: 'admin' | 'member' | 'helper' | 'kid', path: string, ready: (page: Page) => Promise<unknown>, max: number, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    // Past the to-do list, agenda and reminders an open publishes once the server has answered.
    return await expectPageReads(page, async () => {
      await hh.signIn(page, as, path);
      await ready(page);
    }, { max, min: max, label, settleMs: 3000 });
  } finally {
    await context.close();
  }
}

// An admin: the household, the baby's profile, two weeks of the log, the checklists, the
// appointments, a month of contractions and kick counts (not the counts of two months ago) with
// their settings, the contacts and their pay details: 19. The publish's queries don't run on the local preview, whose links are http;
// e2e/reads.sdk.ts budgets them. Every tab mounts the same listeners, so each costs the same.
// Appointments and the kick counter also show this member's notification settings (one more).
for (const [tab, ready, max] of [
  ['', loaded, 19],
  ['#appointments', (p: Page) => expect(p.getByText('Test scan').first()).toBeVisible({ timeout: 30_000 }), 20],
  ['#checklists', (p: Page) => expect(p.getByText('Test car seat').first()).toBeVisible({ timeout: 30_000 }), 19],
  ['#contacts', (p: Page) => expect(p.getByText('Test Midwife').first()).toBeVisible({ timeout: 30_000 }), 19],
  ['#contractions', (p: Page) => expect(p.getByRole('button', { name: 'Contractions', exact: true }).first()).toBeVisible({ timeout: 30_000 }), 19],
  ['#kicks', (p: Page) => expect(p.getByRole('button', { name: 'Start counting' })).toBeVisible({ timeout: 30_000 }), 20],
] as const) {
  test(`opening Baby${tab ? ` at ${tab.slice(1)}` : ' (Overview)'}, signed in as an admin`, async ({ browser }) => {
    await firstOpen(browser, 'admin', `./${tab}`, ready, max, `Baby ${tab || 'Overview'}, admin`);
  });
}

// A member reads what an admin does.
test('opening Baby (Overview), signed in as a member', async ({ browser }) => {
  await firstOpen(browser, 'member', './', loaded, 19, 'Baby Overview, member');
});

// A helper: only the appointments and contacts not marked private.
test('opening Baby (Overview), signed in as a helper: nothing private read', async ({ browser }) => {
  await firstOpen(browser, 'helper', './', loaded, 16, 'Baby Overview, helper');
});

// A kid: as a helper, without the contraction timer and the kick counter.
test('opening Baby (Overview), signed in as a kid: no timer or kick counts read', async ({ browser }) => {
  await firstOpen(browser, 'kid', './', loaded, 10, 'Baby Overview, kid');
});
