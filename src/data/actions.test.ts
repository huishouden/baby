import { describe, expect, test } from 'bun:test';
import { memoryStore } from '@huishouden/pwa-kit/store';
import { DEMO_NOW, demoData, type BabyData } from '../lib/demo';
import { createActions, type Backend, type Op } from './actions';

/** The actions over the sample's memory backend, recording every write as the live batches would. */
function harness(me = 'sam@example.com') {
  const store = memoryStore<BabyData>(demoData('after'), () => {});
  const writes: Op[][] = [];
  const backend: Backend = {
    newId: store.backend.newId,
    write: (ops) => {
      writes.push(ops);
      store.backend.write(ops);
    },
    saveProfile: (profile) => store.patch((d) => ({ ...d, profile })),
    saveSettings: (contractionSettings) => store.patch((d) => ({ ...d, contractionSettings })),
    saveKickSettings: (kickSettings) => store.patch((d) => ({ ...d, kickSettings })),
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  };
  return { actions: createActions(backend, store.read, me, () => DEMO_NOW), read: store.read, writes };
}

describe('the log', () => {
  test('a logged feed is stamped with who and when; delete and restore put it back as it was', () => {
    const h = harness();
    const e = h.actions.logEvent({ kind: 'feed', method: 'breast', side: 'left' });
    expect(e).toMatchObject({ kind: 'feed', side: 'left', at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW });
    expect(h.read().events.find((x) => x.id === e.id)).toEqual(e);
    h.actions.deleteEvent(e.id);
    expect(h.read().events.some((x) => x.id === e.id)).toBe(false);
    h.actions.restoreEvent(e);
    expect(h.read().events.find((x) => x.id === e.id)).toEqual(e);
  });

  test('ending someone else’s sleep keeps who started it', () => {
    const h = harness('jo@example.com');
    const sleep = h.read().events.find((e) => e.kind === 'sleep')!;
    h.actions.updateEvent(sleep, { ...sleep, endAt: DEMO_NOW });
    expect(h.read().events.find((e) => e.id === sleep.id)).toMatchObject({ by: sleep.by, createdAt: sleep.createdAt, endAt: DEMO_NOW, updatedAt: DEMO_NOW });
  });
});

describe('checklists', () => {
  test('a tick and a reorder write only their field', () => {
    const h = harness();
    const [a, b] = h.read().checklists;
    h.actions.setChecklistDone(a.id, !a.done);
    h.actions.reorderChecklist([{ id: b.id, order: 99 }]);
    expect(h.writes.slice(-2)).toEqual([[{ col: 'checklists', id: a.id, data: { done: !a.done }, merge: true }], [{ col: 'checklists', id: b.id, data: { order: 99 }, merge: true }]]);
    expect(h.read().checklists.find((c) => c.id === a.id)).toEqual({ ...a, done: !a.done });
  });

  test('skipping stamps when and writes only the skip fields; un-skipping puts it back on the list', () => {
    const h = harness();
    const item = h.read().checklists.find((c) => !c.done && !c.skipped)!;
    h.actions.setChecklistSkipped(item.id, true);
    expect(h.writes.at(-1)).toEqual([{ col: 'checklists', id: item.id, data: { skipped: true, skippedAt: DEMO_NOW }, merge: true }]);
    expect(h.read().checklists.find((c) => c.id === item.id)).toEqual({ ...item, skipped: true, skippedAt: DEMO_NOW });
    h.actions.setChecklistSkipped(item.id, false);
    expect(h.writes.at(-1)).toEqual([{ col: 'checklists', id: item.id, data: { skipped: false }, merge: true }]);
    expect(h.read().checklists.find((c) => c.id === item.id)).toMatchObject({ skipped: false, done: false });
  });

  test('a new item goes last in its list; blank text adds nothing', () => {
    const h = harness();
    const list = h.read().checklists[0].list;
    const last = Math.max(...h.read().checklists.filter((c) => c.list === list).map((c) => c.order));
    h.actions.addChecklistItem(` ${list} `, ' Nappies ');
    expect(h.read().checklists.at(-1)).toMatchObject({ list, text: 'Nappies', done: false, order: last + 10 });
    const count = h.writes.length;
    h.actions.addChecklistItem(list, '   ');
    expect(h.writes).toHaveLength(count);
  });
});

test('an edited appointment keeps its author and creation time', () => {
  const h = harness('alex@example.com');
  const a = h.read().appointments[0];
  h.actions.saveAppointment(a.id, { title: 'Check-up, moved', at: a.at + 3600_000 });
  expect(h.read().appointments.find((x) => x.id === a.id)).toMatchObject({ title: 'Check-up, moved', by: a.by, createdAt: a.createdAt, private: false });
});

describe('the contraction timer', () => {
  test('start records who and when; stop sets only the end, so a helper may stop another’s', () => {
    const h = harness('sam@example.com');
    const id = h.actions.startContraction();
    expect(h.read().contractions.find((c) => c.id === id)).toEqual({ id, start: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW });
    h.actions.stopContraction(id);
    expect(h.writes.at(-1)).toEqual([{ col: 'contractions', id, data: { end: DEMO_NOW, updatedAt: DEMO_NOW }, merge: true }]);
    expect(h.read().contractions.find((c) => c.id === id)).toMatchObject({ end: DEMO_NOW, by: 'sam@example.com' });
  });

  test('delete and restore put a mistaken tap back as it was', () => {
    const h = harness();
    const id = h.actions.startContraction();
    const c = h.read().contractions.find((x) => x.id === id)!;
    h.actions.deleteContraction(id);
    expect(h.read().contractions.some((x) => x.id === id)).toBe(false);
    h.actions.restoreContraction(c);
    expect(h.read().contractions.find((x) => x.id === id)).toEqual(c);
  });
});

test('the contraction instructions are trimmed, capped and signed', () => {
  const h = harness();
  h.actions.saveContractionNote('  Call if 6 in an hour ');
  expect(h.read().contractionSettings).toEqual({ note: 'Call if 6 in an hour', updatedAt: DEMO_NOW, updatedBy: 'sam@example.com' });
  h.actions.saveContractionNote('x'.repeat(400));
  expect(h.read().contractionSettings?.note).toHaveLength(300);
});

describe('the kick counter', () => {
  const TODAY = '2031-05-14';

  test('a day’s first session is the day, with the household’s target; a second is numbered', () => {
    const h = harness();
    h.actions.saveKickSettings({ target: 8 });
    const id = h.actions.startKicks();
    expect(id).toBe(TODAY);
    expect(h.read().kickSessions.find((s) => s.id === id)).toEqual({ id, start: DEMO_NOW, taps: [], target: 8, by: 'sam@example.com', createdAt: DEMO_NOW });
    h.actions.stopKicks(id);
    expect(h.writes.at(-1)).toEqual([{ col: 'kickSessions', id, data: { end: DEMO_NOW, updatedAt: DEMO_NOW }, merge: true }]);
    expect(h.actions.startKicks()).toBe(`${TODAY}-2`);
  });

  test('movements are counted, the target ends the session, undo reopens it', () => {
    const h = harness();
    h.actions.saveKickSettings({ target: 2 });
    const id = h.actions.startKicks();
    h.actions.tapKick(id);
    expect(h.read().kickSessions.find((s) => s.id === id)).toMatchObject({ taps: [DEMO_NOW] });
    expect(h.read().kickSessions.find((s) => s.id === id)?.end).toBeUndefined();
    h.actions.tapKick(id);
    expect(h.read().kickSessions.find((s) => s.id === id)).toMatchObject({ taps: [DEMO_NOW, DEMO_NOW], end: DEMO_NOW });
    h.actions.tapKick(id);
    expect(h.read().kickSessions.find((s) => s.id === id)?.taps).toHaveLength(2);
    h.actions.undoKick(id);
    const back = h.read().kickSessions.find((s) => s.id === id)!;
    expect(back.taps).toHaveLength(1);
    expect(back.end).toBeNull();
    // Only the fields that changed are written, never the whole session.
    expect(h.writes.at(-1)).toEqual([{ col: 'kickSessions', id, data: { taps: [DEMO_NOW], updatedAt: DEMO_NOW, end: null }, merge: true }]);
  });

  test('a tap writes only taps, end and updatedAt, so a note saved on another device is kept', () => {
    const h = harness();
    const id = h.actions.startKicks();
    h.actions.saveKickNote(id, 'after lunch');
    h.actions.tapKick(id);
    expect(h.writes.at(-1)).toEqual([{ col: 'kickSessions', id, data: { taps: [DEMO_NOW], updatedAt: DEMO_NOW }, merge: true }]);
    expect(h.read().kickSessions.find((s) => s.id === id)).toMatchObject({ note: 'after lunch', taps: [DEMO_NOW] });
  });

  test('settings are clamped, signed and keep only a valid reminder time', () => {
    const h = harness();
    h.actions.saveKickSettings({ target: 400, remindAt: '19:30' });
    expect(h.read().kickSettings).toEqual({ target: 50, remindAt: '19:30', updatedAt: DEMO_NOW, updatedBy: 'sam@example.com' });
    h.actions.saveKickSettings({ target: 10, remindAt: '7pm' });
    expect(h.read().kickSettings).toEqual({ target: 10, updatedAt: DEMO_NOW, updatedBy: 'sam@example.com' });
  });

  test('a note is trimmed and capped; delete and restore put a session back as it was', () => {
    const h = harness();
    const id = h.actions.startKicks();
    h.actions.saveKickNote(id, `  after dinner ${'x'.repeat(400)}`);
    expect(h.read().kickSessions.find((s) => s.id === id)?.note).toHaveLength(300);
    const s = h.read().kickSessions.find((x) => x.id === id)!;
    h.actions.deleteKickSession(id);
    expect(h.read().kickSessions.some((x) => x.id === id)).toBe(false);
    h.actions.restoreKickSession(s);
    expect(h.read().kickSessions.find((x) => x.id === id)).toEqual(s);
  });
});
