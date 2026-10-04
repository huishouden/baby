import { describe, expect, test } from 'bun:test';
import { localizeTodos, resolveOps, todoDoc, todoOpsAllowed } from '@huishouden/pwa-kit/todos';
import { applyOps, memoryStore } from '@huishouden/pwa-kit/store';
import { createActions, type Backend } from '../data/actions';
import { DEMO_NOW, demoData, type BabyData } from './demo';
import type { ChecklistItem } from './model';
import { isOpen } from './checklist';
import { checklistRef, todoItems } from './todos';
import { localizeAgenda } from '@huishouden/pwa-kit/agenda';
import { agendaItems } from './agenda';
import { SUITE_ORIGIN } from '@huishouden/pwa-kit/site';

const ORIGIN = SUITE_ORIGIN;
const SAM = 'sam@example.com';

const item = (over: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'c1',
  list: 'Hospital bag',
  text: 'Phone charger with a long cable',
  done: false,
  order: 1000,
  createdAt: 1_900_000_000_000,
  by: 'alex@example.com',
  ...over,
});

describe('checklist items on the to-do list', () => {
  test('an open item is one to-do on its list, added when the item was, linking to Checklists', () => {
    const [todo] = todoItems([item()], ORIGIN);
    expect(todo).toEqual({
      ref: 'check:c1',
      title: 'Phone charger with a long cable',
      detail: 'Hospital bag',
      createdAt: 1_900_000_000_000,
      url: `${SUITE_ORIGIN}/baby/#checklists`,
      private: false,
      owner: 'alex@example.com',
      done: { label: 'Done', ops: [{ col: 'babyChecklists', id: 'c1', data: { done: true }, merge: true }], roles: ['admin', 'member', 'helper', 'kid'] },
      cancel: {
        label: 'Skip',
        ops: [{ col: 'babyChecklists', id: 'c1', data: { skipped: true, skippedAt: '$now' }, merge: true }],
        roles: ['admin', 'member'],
        owner: true,
      },
    });
    expect(todo.due).toBeUndefined();
  });

  test('done, skipped and blank items are left out', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', done: true }), item({ id: 'c', skipped: true }), item({ id: 'd', text: '  ' }), item({ id: 'e', skipped: false })];
    expect(todoItems(items, ORIGIN).map((t) => t.ref)).toEqual([checklistRef('a'), checklistRef('e')]);
    expect(isOpen(item({ skipped: true }))).toBe(false);
  });

  test('every to-do is one the kit stores and the portal may run', () => {
    const todos = todoItems(demoData('before').checklists, ORIGIN);
    expect(todos.length).toBeGreaterThan(0);
    for (const t of todos) {
      expect(() => todoDoc('baby', t, SAM, DEMO_NOW)).not.toThrow();
      expect(todoOpsAllowed('baby', t.done!.ops)).toBe(true);
      expect(todoOpsAllowed('baby', t.cancel!.ops)).toBe(true);
    }
  });
});

describe("the portal's actions do what Baby's own do", () => {
  const key = (col: string) => (col === 'babyChecklists' ? 'checklists' : (col as keyof BabyData));
  const fresh = () => {
    const store = memoryStore<BabyData>(demoData('before'), () => {});
    const backend: Backend = { ...store.backend, saveProfile: () => {}, contacts: { save: () => {}, remove: () => {}, restore: () => {} } };
    return { read: store.read, actions: createActions(backend, store.read, SAM, () => DEMO_NOW) };
  };

  for (const which of ['done', 'cancel'] as const) {
    test(which === 'done' ? 'Done ticks the item' : 'Skip skips it, stamped when it ran', () => {
      const app = fresh();
      const target = app.read().checklists.find(isOpen)!;
      const todo = todoItems(app.read().checklists, ORIGIN).find((t) => t.ref === checklistRef(target.id))!;
      const viaPortal = applyOps(app.read(), resolveOps(todo[which]!.ops, { now: DEMO_NOW, me: SAM }), key);
      if (which === 'done') app.actions.setChecklistDone(target.id, true);
      else app.actions.setChecklistSkipped(target.id, true);
      expect(viaPortal.checklists).toEqual(app.read().checklists);
      // No longer published once done or skipped.
      expect(todoItems(viaPortal.checklists, ORIGIN).some((t) => t.ref === todo.ref)).toBe(false);
    });
  }
});

test('to-dos and the due date carry their words in every language; the household\'s own text stays as entered', async () => {
  const data = demoData('before');
  const todos = await localizeTodos(() => todoItems(data.checklists, ORIGIN));
  const first = todos[0];
  expect(first.texts.en).toMatchObject({ done: 'Done', cancel: 'Skip' });
  expect(first.texts.es).toMatchObject({ title: first.title, done: 'Listo', cancel: 'Omitir' });
  expect(first.texts.nl).toMatchObject({ title: first.title, done: 'Klaar', cancel: 'Overslaan' });
  const agenda = await localizeAgenda(() => agendaItems(data, ORIGIN));
  const due = agenda.find((i) => i.ref === 'profile:dueDate')!;
  expect([due.texts.en?.title, due.texts.es?.title, due.texts.nl?.title]).toEqual(['Due date', 'Fecha prevista de parto', 'Uitgerekende datum']);
});
