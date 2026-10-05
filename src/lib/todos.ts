import type { TodoInput } from '@huishouden/pwa-kit/todos';
import type { ChecklistItem } from './model';
import { tabUrl } from './agenda';
import { isOpen } from './checklist';
import { t } from '../i18n';
import { SUITE_ORIGIN } from '@huishouden/pwa-kit/site';

// What Baby puts on the household to-do list (households/{id}/todos), so the portal's To-do tab
// shows it: every checklist item not yet done or skipped. Appointments always have a time, so they
// are on the household calendar instead (./agenda).

const ORIGIN = globalThis.location?.origin ?? SUITE_ORIGIN;

export const checklistRef = (id: string) => `check:${id}`;


/**
 * One to-do per open checklist item, with Done (a tick anyone may make) and Skip (staff or whoever
 * added it), in the page's language: wrap in `localizeTodos` for every language.
 */
export function todoItems(checklists: readonly ChecklistItem[], origin = ORIGIN): TodoInput[] {
  return checklists
    .filter((item) => isOpen(item) && item.text.trim())
    .map((item) => ({
      ref: checklistRef(item.id),
      title: item.text,
      detail: item.list,
      createdAt: item.createdAt,
      url: tabUrl(origin, 'checklists'),
      private: false,
      owner: item.by,
      done: { label: t('todo.markDone'), ops: [{ col: 'babyChecklists', id: item.id, data: { done: true }, merge: true }], roles: ['admin', 'member', 'helper', 'kid'] },
      cancel: {
        label: t('todo.skip'),
        ops: [{ col: 'babyChecklists', id: item.id, data: { skipped: true, skippedAt: '$now' }, merge: true }],
        roles: ['admin', 'member'],
        owner: true,
      },
    }));
}
