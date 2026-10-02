import type { ChecklistItem, ChecklistItemData } from './model';

/** Lists and items a household starts with; everything is editable afterwards. */
export const DEFAULT_CHECKLISTS: { list: string; items: string[] }[] = [
  {
    list: 'Hospital bag',
    items: [
      'ID, insurance card and birth plan',
      'Phone charger with a long cable',
      'Comfortable clothes and slippers',
      'Toiletries and lip balm',
      'Going-home outfit for the baby',
      'Snacks and a water bottle',
    ],
  },
  {
    list: 'Car seat',
    items: ['Buy a rear-facing infant car seat', 'Install the car seat', 'Get the installation inspected', 'Practise buckling the harness'],
  },
  {
    list: 'Nursery',
    items: ['Crib or bassinet with a firm, flat mattress', 'Fitted sheets', 'Diapers and wipes', 'Changing pad', 'Swaddles and sleep sacks', 'Night light'],
  },
  {
    list: 'Paperwork',
    items: [
      'Choose a pediatrician',
      'Check what the insurance plan covers for delivery',
      'Pre-register at the hospital',
      'Plan parental leave with work',
      'Add the baby to health insurance after the birth',
      'Apply for a birth certificate and Social Security number',
    ],
  },
];

/** Stable ids so two devices seeding at once write the same documents instead of duplicates. */
export function defaultChecklistDocs(now: number, by: string): { id: string; data: ChecklistItemData }[] {
  const out: { id: string; data: ChecklistItemData }[] = [];
  DEFAULT_CHECKLISTS.forEach(({ list, items }, li) =>
    items.forEach((text, i) =>
      out.push({
        id: `default-${li + 1}-${i + 1}`,
        data: { list, text, done: false, order: (li + 1) * 1000 + i * 10, createdAt: now, by },
      }),
    ),
  );
  return out;
}

export interface ChecklistGroup {
  list: string;
  items: ChecklistItem[];
  done: number;
}

/** Groups by list in the order lists first appear (by their lowest `order`), items by `order`. */
export function groupChecklist(items: ChecklistItem[]): ChecklistGroup[] {
  const sorted = [...items].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const groups = new Map<string, ChecklistGroup>();
  for (const item of sorted) {
    const g = groups.get(item.list) ?? { list: item.list, items: [], done: 0 };
    g.items.push(item);
    if (item.done) g.done++;
    groups.set(item.list, g);
  }
  return [...groups.values()];
}

/**
 * Moving an item up or down a list swaps its `order` with its neighbour's. Returns the two writes,
 * or [] at the ends. Equal orders are separated so the swap is visible.
 */
export function moveItem(group: ChecklistItem[], id: string, dir: -1 | 1): { id: string; order: number }[] {
  const i = group.findIndex((it) => it.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= group.length) return [];
  const a = group[i];
  const b = group[j];
  if (a.order === b.order) {
    return dir === -1 ? [{ id: a.id, order: b.order - 1 }] : [{ id: a.id, order: b.order + 1 }];
  }
  return [
    { id: a.id, order: b.order },
    { id: b.id, order: a.order },
  ];
}

/** Order for a new item at the end of a list (or after every list for a new one). */
export function nextOrder(items: ChecklistItem[], list: string): number {
  const inList = items.filter((i) => i.list === list);
  if (inList.length) return Math.max(...inList.map((i) => i.order)) + 10;
  return items.length ? Math.max(...items.map((i) => i.order)) + 1000 : 1000;
}
