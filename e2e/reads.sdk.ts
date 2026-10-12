// Read budgets of Baby's own sync paths (pwa-kit STANDARD.md "Read budgets"), on the emulators with
// the household's rules (`bun run e2e:emulator`, which `hh dev evidence` runs inside
// `firebase emulators:exec`): what an open publishes, the agenda, the to-do list and the reminders
// (appointments and the daily kick count). Reads are counted from the SDK's own results as
// Firestore bills them (`readCounter().sdk`); the interleaving test lands another member's write
// before each read. Its own `bun test` process: it replaces firebase/firestore with the counted
// module for the process. The sample household before the birth (src/lib/demo.ts, invented) on its
// sample day. A change that raises a ceiling says why in its PR.
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { expectReads, readCounter, writeBeforeEachRead } from '@huishouden/pwa-kit/read-test';
import { e2eProject, e2eTarget, seedTestHousehold, testHousehold, writeTestDocs, type TestHousehold } from '@huishouden/pwa-kit/staging';
import { agendaDoc } from '@huishouden/pwa-kit/agenda';
import { todoDoc } from '@huishouden/pwa-kit/todos';
import { reminderDoc } from '@huishouden/pwa-kit/reminders';
import { DEMO_NOW, demoData } from '../src/lib/demo';
import type { KickSettings } from '../src/lib/model';

const real = await import('firebase/firestore');
const counter = readCounter();
mock.module('firebase/firestore', () => counter.sdk(real));
const { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, terminate } = await import('firebase/firestore');
const { publishAgenda, publishReminders, publishTodos } = await import('../src/data/publish');

const emulator = e2eTarget() === 'emulator';
const NOW = DEMO_NOW;
const DAY = 86_400_000;
// The rules take only the suite's own addresses.
const ORIGIN = 'https://huishouden-staging.web.app';
const URL = `${ORIGIN}/baby/`;

let hh: TestHousehold;
let app: FirebaseApp;
let db: ReturnType<typeof real.getFirestore>;
let admin: string;
const kickSettings: KickSettings = { target: 10, remindAt: '20:00', updatedAt: NOW - DAY, updatedBy: 'seed@example.com' };
const data = { ...demoData('before'), kickSettings };

const strip = ({ id: _id, ...doc }: { id: string }) => doc;

beforeAll(async () => {
  if (!emulator) return;
  const household = testHousehold('baby-reads-sdk');
  admin = household.users.admin.email;
  // The documents the reminders' sources name: the rules check them.
  const docs: Record<string, Record<string, unknown>> = { 'babyProfile/main': { ...data.profile! }, 'babyKickSettings/main': { ...kickSettings } };
  for (const a of data.appointments) docs[`babyAppointments/${a.id}`] = strip(a);
  for (const c of data.checklists) docs[`babyChecklists/${c.id}`] = strip(c);
  hh = await seedTestHousehold({ household, docs });
  app = initializeApp({ apiKey: 'demo-key', projectId: e2eProject(), appId: 'demo' }, `reads-${hh.id}`);
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, process.env.HH_EMULATOR_HOST || '127.0.0.1', Number(process.env.HH_EMULATOR_FIRESTORE_PORT || 8080), {
    mockUserToken: { sub: hh.users.admin.uid, email: admin, email_verified: true },
  });
});

afterAll(async () => {
  if (!emulator) return;
  await terminate(db);
  await deleteApp(app);
});

type Store = Parameters<typeof publishAgenda>[4]['published'];
/** What an open publishes, as the app does once the server has answered: three queries at once. */
const open = (published: Store = null) =>
  Promise.all([
    publishAgenda(db, hh.id, admin, data, { origin: ORIGIN, now: NOW, published }),
    publishTodos(db, hh.id, admin, data.checklists, { origin: ORIGIN, now: NOW, published }),
    publishReminders(db, hh.id, admin, data, { origin: ORIGIN, now: NOW, published }),
  ]);

describe.skipIf(!emulator)('what an open publishes (agenda, to-dos, reminders): one query each, none when this device already published the same', () => {
  test('first, again, and again with this device\'s note', async () => {
    // Nothing published yet: three queries that find nothing, billed one read each.
    await expectReads(() => open(), { max: 3, min: 3, counter, label: 'Baby publish, first' });
    // Again without the note: each query returns what the first wrote: 6 agenda items, 12 to-dos
    // and 15 reminders.
    const { value, reads } = await expectReads(() => open(), { max: 33, min: 33, counter, label: 'Baby publish, again' });
    expect(reads).toBe(value.reduce((n, r) => n + r.unchanged, 0));
    // With the note of what this device published: nothing read.
    const notes = new Map<string, string>();
    const store = { getItem: (k: string) => notes.get(k) ?? null, setItem: (k: string, v: string) => void notes.set(k, v), removeItem: (k: string) => void notes.delete(k), key: (i: number) => [...notes.keys()][i] ?? null, clear: () => notes.clear(), get length() { return notes.size; } };
    await open(store);
    await expectReads(() => open(store), { max: 0, counter, label: 'Baby publish, published' });
  });

  test('interleaving: another member\'s stray item lands in each list before each of the three reads; each list read once', async () => {
    let n = 0;
    const stray = (i: number) => ({
      [`agenda/baby_stray${i}`]: agendaDoc('baby', { ref: `appointment:stray${i}`, kind: 'appointment', title: `Old ${i}`, start: NOW + DAY, allDay: true, url: URL }, admin, NOW),
      [`todos/baby:stray${i}`]: todoDoc('baby', { ref: `check:stray${i}`, title: `Old ${i}`, createdAt: NOW - DAY, url: URL }, admin, NOW),
      [`reminders/baby-stray${i}`]: reminderDoc({ app: 'baby', ref: `appointment:stray${i}:day`, title: `Old ${i}`, at: NOW + DAY, url: URL }, admin, NOW),
    });
    const { value } = await expectReads(() => open(), { max: 42, min: 42, counter, label: 'Baby publish with a write before each read', beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(++n))) });
    // The three reads go out together, so each list's one query saw all three strays (33 + 9 reads)
    // and removed them.
    expect(n).toBe(3);
    expect(value.map((r) => r.deleted)).toEqual([3, 3, 3]);
  });
});
