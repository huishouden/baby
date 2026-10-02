import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, ListPlus, Phone, Plus, Trash2, UserPlus, UserRound } from 'lucide-react';
import { telHref } from '@huishouden/pwa-kit/places';
import { groupChecklist, moveItem } from '../lib/checklist';
import { LIMITS } from '../lib/model';
import { contactForRole, roleForChecklistItem, type KnownRole } from '../lib/contacts';
import type { BabyStore } from '../data/types';
import { Dialog, Field, cardClass, ghostButton, iconButton, inputClass, linkClass, primaryButton } from '../components/ui';

export function Checklists({ store, notify, onAddContact }: {
  store: BabyStore;
  notify: (message: string, undo?: () => void) => void;
  /** Opens the contact dialog with the role filled in. */
  onAddContact: (role: KnownRole) => void;
}) {
  const { actions } = store;
  const groups = groupChecklist(store.data.checklists);
  const [newList, setNewList] = useState(false);

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-stone-800">Checklists</h2>
        <button type="button" className={primaryButton} onClick={() => setNewList(true)}>
          <ListPlus size={20} /> New list
        </button>
      </div>
      {groups.length === 0 && <p className="text-lg text-stone-600">No checklists yet. Start one with New list.</p>}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.list} className={`${cardClass} p-5`} aria-label={g.list}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-xl font-semibold text-stone-800">{g.list}</h3>
              <p className="text-base text-stone-600 tabular-nums">
                {g.done} of {g.items.length} done
              </p>
            </div>
            <ul>
              {g.items.map((item, i) => {
                const role = roleForChecklistItem(item.text);
                const who = role ? contactForRole(store.data.contacts, role) : undefined;
                return (
                <li key={item.id} className="border-b border-stone-200 last:border-b-0">
                  <div className="flex min-h-12 items-center gap-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.done}
                    onClick={() => actions.setChecklistDone(item.id, !item.done)}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-2 text-left"
                  >
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${item.done ? 'border-forest-700 bg-forest-700 text-white' : 'border-stone-400'}`}
                      aria-hidden="true"
                    >
                      {item.done && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span className={`text-base ${item.done ? 'text-stone-600 line-through' : 'text-stone-800'}`}>{item.text}</span>
                  </button>
                  {role && !who && (
                    <button type="button" className={`${ghostButton} px-2 text-forest-700`} onClick={() => onAddContact(role)} aria-label={`Add contact: ${role}`}>
                      <UserPlus size={18} /> Add contact
                    </button>
                  )}
                  <button type="button" className={iconButton} aria-label={`Move up: ${item.text}`} disabled={i === 0} onClick={() => actions.reorderChecklist(moveItem(g.items, item.id, -1))}>
                    <ArrowUp size={18} />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Move down: ${item.text}`}
                    disabled={i === g.items.length - 1}
                    onClick={() => actions.reorderChecklist(moveItem(g.items, item.id, 1))}
                  >
                    <ArrowDown size={18} />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Delete: ${item.text}`}
                    onClick={() => {
                      actions.deleteChecklistItem(item.id);
                      notify(`Deleted "${item.text}"`, () => actions.restoreChecklistItem(item));
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                  </div>
                  {who && (
                    <div className="-mt-1 flex flex-wrap items-center gap-x-4 pb-1 pl-9 text-base text-stone-600">
                      <span className="flex items-center gap-1.5">
                        <UserRound size={16} aria-hidden="true" /> {who.name}
                      </span>
                      {who.phone && (
                        <a className={`${linkClass} tabular-nums`} href={telHref(who.phone)} aria-label={`Call ${who.name}, ${who.phone}`}>
                          <Phone size={16} aria-hidden="true" /> {who.phone}
                        </a>
                      )}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
            <AddItem list={g.list} onAdd={(text) => actions.addChecklistItem(g.list, text)} />
          </section>
        ))}
      </div>
      {newList && (
        <NewListDialog
          onClose={() => setNewList(false)}
          onCreate={(list, text) => actions.addChecklistItem(list, text)}
          existing={groups.map((g) => g.list.toLowerCase())}
        />
      )}
    </div>
  );
}

function AddItem({ list, onAdd }: { list: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text);
        setText('');
      }}
    >
      <input className={inputClass} value={text} maxLength={LIMITS.itemText} onChange={(e) => setText(e.target.value)} placeholder={`Add to ${list.toLowerCase()}`} aria-label={`Add to ${list}`} />
      <button type="submit" className={`${ghostButton} border border-stone-200`} aria-label={`Add item to ${list}`} disabled={!text.trim()}>
        <Plus size={20} />
      </button>
    </form>
  );
}

function NewListDialog({ onClose, onCreate, existing }: { onClose: () => void; onCreate: (list: string, first: string) => void; existing: string[] }) {
  const [list, setList] = useState('');
  const [first, setFirst] = useState('');
  const taken = existing.includes(list.trim().toLowerCase());
  const valid = list.trim().length > 0 && first.trim().length > 0 && !taken;
  const create = () => {
    if (!valid) return;
    onCreate(list, first);
    onClose();
  };
  return (
    <Dialog
      title="New list"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={create}>
            Create list
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Field label="List name" hint={taken ? 'There is already a list with this name.' : undefined}>
          <input className={inputClass} value={list} maxLength={60} onChange={(e) => setList(e.target.value)} placeholder="Freezer meals" />
        </Field>
        <Field label="First item">
          <input className={inputClass} value={first} maxLength={LIMITS.itemText} onChange={(e) => setFirst(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
