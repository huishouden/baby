import { describe, expect, test } from 'bun:test';
import { DEFAULT_CHECKLISTS, defaultChecklistDocs, groupChecklist, moveItem, nextOrder } from './checklist';
import type { ChecklistItem } from './model';

const BY = 'pat@example.com';
const items = (): ChecklistItem[] => defaultChecklistDocs(1, BY).map(({ id, data }) => ({ id, ...data }));

describe('defaults', () => {
  test('cover the hospital bag, car seat, nursery and paperwork', () => {
    expect(DEFAULT_CHECKLISTS.map((l) => l.list)).toEqual(['Hospital bag', 'Car seat', 'Nursery', 'Paperwork']);
    const carSeat = DEFAULT_CHECKLISTS.find((l) => l.list === 'Car seat')!.items;
    expect(carSeat).toContain('Install the car seat');
    expect(carSeat).toContain('Get the installation inspected');
  });

  test('stable ids and valid documents', () => {
    const docs = defaultChecklistDocs(1, BY);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    expect(defaultChecklistDocs(2, BY).map((d) => d.id)).toEqual(docs.map((d) => d.id));
    for (const { data } of docs) {
      expect(Object.keys(data).sort()).toEqual(['by', 'createdAt', 'done', 'list', 'order', 'text']);
      expect(data.text.length).toBeGreaterThan(0);
      expect(data.text.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('grouping and order', () => {
  test('groups keep list order and count done items', () => {
    const all = items();
    all[1].done = true;
    const groups = groupChecklist(all.reverse());
    expect(groups.map((g) => g.list)).toEqual(['Hospital bag', 'Car seat', 'Nursery', 'Paperwork']);
    expect(groups[0].done).toBe(1);
    expect(groups[1].items[1].text).toBe('Install the car seat');
  });

  test('a skipped item stays in its list but counts neither as done nor as to do', () => {
    const all = items();
    all[0].done = true;
    all[1].skipped = true;
    all[2].done = true;
    all[2].skipped = true;
    const bag = groupChecklist(all)[0];
    expect(bag.items).toHaveLength(6);
    expect(bag).toMatchObject({ done: 2, skipped: 1, total: 5 });
  });

  test('moving swaps with the neighbour and stops at the ends', () => {
    const bag = groupChecklist(items())[0].items;
    expect(moveItem(bag, bag[1].id, -1)).toEqual([
      { id: bag[1].id, order: bag[0].order },
      { id: bag[0].id, order: bag[1].order },
    ]);
    expect(moveItem(bag, bag[0].id, -1)).toEqual([]);
    expect(moveItem(bag, bag[bag.length - 1].id, 1)).toEqual([]);
  });

  test('moving between equal orders separates them', () => {
    const [a, b] = items();
    const same = [a, { ...b, order: a.order }];
    expect(moveItem(same, b.id, -1)).toEqual([{ id: b.id, order: a.order - 1 }]);
  });

  test('new items go to the end of their list; new lists after every list', () => {
    const all = items();
    expect(nextOrder(all, 'Car seat')).toBe(2040);
    expect(nextOrder(all, 'Freezer meals')).toBe(5050);
    expect(nextOrder([], 'Anything')).toBe(1000);
  });
});
