import type { ChecklistItem, ChecklistItemData } from './model';
import { t } from '../i18n';

/**
 * Lists and items a household starts with, as message keys: they are written once, in the language
 * of the device that starts the household's checklists, and are the household's own text after that.
 */
const TEMPLATES = [
  {
    list: 'template.bag',
    items: ['template.bag.id', 'template.bag.charger', 'template.bag.clothes', 'template.bag.toiletries', 'template.bag.outfit', 'template.bag.snacks'],
  },
  {
    list: 'template.carSeat',
    items: ['template.carSeat.buy', 'template.carSeat.install', 'template.carSeat.inspect', 'template.carSeat.practise'],
  },
  {
    list: 'template.nursery',
    items: ['template.nursery.crib', 'template.nursery.sheets', 'template.nursery.diapers', 'template.nursery.pad', 'template.nursery.swaddles', 'template.nursery.light'],
  },
  {
    list: 'template.paperwork',
    items: [
      'template.paperwork.pediatrician',
      'template.paperwork.coverage',
      'template.paperwork.preregister',
      'template.paperwork.leave',
      'template.paperwork.insurance',
      'template.paperwork.certificate',
    ],
  },
] as const;

/** The starter lists in the page's language. */
export function defaultChecklists(): { list: string; items: string[] }[] {
  return TEMPLATES.map(({ list, items }) => ({ list: t(list), items: items.map((k) => t(k)) }));
}

/** Stable ids so two devices seeding at once write the same documents instead of duplicates. */
export function defaultChecklistDocs(now: number, by: string): { id: string; data: ChecklistItemData }[] {
  const out: { id: string; data: ChecklistItemData }[] = [];
  defaultChecklists().forEach(({ list, items }, li) =>
    items.forEach((text, i) =>
      out.push({
        id: `default-${li + 1}-${i + 1}`,
        data: { list, text, done: false, order: (li + 1) * 1000 + i * 10, createdAt: now, by },
      }),
    ),
  );
  return out;
}

/** Still to do: neither ticked nor skipped. */
export const isOpen = (item: Pick<ChecklistItem, 'done' | 'skipped'>) => !item.done && item.skipped !== true;

export interface ChecklistGroup {
  list: string;
  items: ChecklistItem[];
  done: number;
  /** Skipped items: shown in the list, counted neither as done nor as left to do. */
  skipped: number;
  /** Items that count: all but the skipped ones ("3 of 5 done"). */
  total: number;
}

/** Groups by list in the order lists first appear (by their lowest `order`), items by `order`. */
export function groupChecklist(items: ChecklistItem[]): ChecklistGroup[] {
  const sorted = [...items].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const groups = new Map<string, ChecklistGroup>();
  for (const item of sorted) {
    const g = groups.get(item.list) ?? { list: item.list, items: [], done: 0, skipped: 0, total: 0 };
    g.items.push(item);
    if (item.done) g.done++;
    else if (item.skipped) g.skipped++;
    g.total = g.items.length - g.skipped;
    groups.set(item.list, g);
  }
  return [...groups.values()];
}

/** A list as shown: open items in their order, then done ones, then skipped ones (DESIGN.md "Completion"). */
export function shownOrder(items: ChecklistItem[]): ChecklistItem[] {
  return [...items.filter(isOpen), ...items.filter((x) => x.done), ...items.filter((x) => !x.done && x.skipped === true)];
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
