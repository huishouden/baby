import { UserPlus } from 'lucide-react';
import { groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { ContactCard } from '@huishouden/pwa-kit/react/contacts';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { roleLabels, withShownRoles } from '../lib/contacts';
import type { BabyStore } from '../data/types';
import { mayChange } from '../lib/roles';
import { useT } from '../i18n';

/** The care team: everyone the household may need to call about the baby, one tap away. */
export function Contacts({ store, onAdd, onEdit, notify }: {
  store: BabyStore;
  onAdd: () => void;
  onEdit: (c: Contact) => void;
  notify: (message: string, undo?: () => void) => void;
}) {
  const t = useT();
  // Grouped under the role names of the page's language; edits and undo keep the role as stored.
  const stored = new Map(store.data.contacts.map((c) => [c.id, c]));
  const groups = groupContacts(withShownRoles(store.data.contacts), roleLabels());

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">{t('contactsTab.title')}</h2>
        <button type="button" className={primaryButton} onClick={onAdd}>
          <UserPlus size={20} /> {t('contactsTab.add')}
        </button>
      </div>
      {groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('contactsTab.empty')}</p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {groups.flatMap((g) =>
          g.contacts.map((shown) => {
            const c = stored.get(shown.id) ?? shown;
            return (
            <ContactCard
              key={c.id}
              contact={c}
              role={g.role}
              onEdit={mayChange(store.role, store.me, c) ? () => onEdit(c) : undefined}
              onDelete={
                mayChange(store.role, store.me, c)
                  ? () => {
                      store.actions.deleteContact(c.id);
                      notify(t('common.deleted', { name: c.name }), () => store.actions.restoreContact(c));
                    }
                  : undefined
              }
            />
            );
          }),
        )}
      </div>
    </div>
  );
}
