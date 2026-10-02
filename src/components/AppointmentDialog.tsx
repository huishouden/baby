import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { CalendarFind, LinkedEvent } from '@huishouden/pwa-kit/react/calendar';
import { Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { addDays, fromLocalInput, toLocalInput } from '@huishouden/pwa-kit/time';
import type { Appointment } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromCalendar } from '../lib/calendarImport';
import type { AppointmentInput } from '../data/types';
import { auth } from '../data/firebase';

export function AppointmentDialog({ appointment, now, contacts, calendarAvailable, onSave, onDelete, onClose }: {
  appointment: Appointment | null;
  now: number;
  contacts: Contact[];
  calendarAvailable: boolean;
  onSave: (input: AppointmentInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const initial = toLocalInput(appointment?.at ?? addDays(now, 1) + 9 * 3_600_000);
  const [title, setTitle] = useState(appointment?.title ?? '');
  const [date, setDate] = useState(initial.slice(0, 10));
  const [time, setTime] = useState(initial.slice(11));
  const [location, setLocation] = useState(appointment?.location ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [contactId, setContactId] = useState(appointment?.contactId ?? '');
  const [event, setEvent] = useState(appointment?.calendarEventId || appointment?.calendarLink ? { id: appointment.calendarEventId, link: appointment.calendarLink } : null);
  const at = fromLocalInput(`${date}T${time}`);
  const valid = title.trim().length > 0 && at !== null;
  // A contact that was deleted (or no longer shown in Baby) still appears until another is picked.
  const known = contactId && !contacts.some((c) => c.id === contactId);

  const save = () => {
    if (!valid || at === null) return;
    onSave({ title, at, location, notes, contactId: contactId || undefined, calendarEventId: event?.id, calendarLink: event?.link });
    onClose();
  };

  const pickMatch = (m: CalendarMatch) => {
    const filled = fromCalendar(m);
    const local = toLocalInput(filled.at);
    setDate(local.slice(0, 10));
    setTime(local.slice(11));
    if (filled.location) setLocation(filled.location);
    if (filled.notes) setNotes(filled.notes);
    setEvent({ id: filled.calendarEventId, link: filled.calendarLink });
  };

  const pickContact = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (c?.address && !location.trim()) setLocation(c.address.slice(0, LIMITS.location));
  };

  return (
    <Dialog
      title={appointment ? 'Edit appointment' : 'New appointment'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              className={deleteButton}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="What">
          <input className={inputClass} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder="Midwife check-up" />
        </Field>

        <CalendarFind auth={auth} app="Baby" query={title} available={calendarAvailable} onPick={pickMatch} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {(contacts.length > 0 || contactId) && (
          <Field label="Who (optional)">
            <select className={inputClass} value={contactId} onChange={(e) => pickContact(e.target.value)}>
              <option value="">No one in particular</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.role ? `${c.name} (${c.role})` : c.name}
                </option>
              ))}
              {known && <option value={contactId}>A removed contact</option>}
            </select>
          </Field>
        )}
        <Field label="Where (optional)">
          <input className={inputClass} value={location} maxLength={LIMITS.location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {event && <LinkedEvent link={event.link} onUnlink={() => setEvent(null)} />}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
