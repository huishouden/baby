import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { BabyEvent, DiaperKind, EventFields, FeedMethod, Side } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromLocalInput, toLocalInput } from '../lib/time';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from './ui';

const KIND_TITLE = { feed: 'Feed', sleep: 'Sleep', diaper: 'Diaper', pump: 'Pump' } as const;

/** Edit any entry: its time (and end, for sleep), the details for its kind, and a note. */
export function EventDialog({ event, onSave, onDelete, onClose }: {
  event: BabyEvent;
  onSave: (fields: EventFields) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(toLocalInput(event.at));
  const [endAt, setEndAt] = useState(event.endAt != null ? toLocalInput(event.endAt) : '');
  const [running, setRunning] = useState(event.kind === 'sleep' && event.endAt == null);
  const [method, setMethod] = useState<FeedMethod>(event.method ?? 'breast');
  const [side, setSide] = useState<Side>(event.side ?? 'both');
  const [diaper, setDiaper] = useState<DiaperKind>(event.diaper ?? 'wet');
  const [ml, setMl] = useState(event.amountMl ? String(event.amountMl) : '');
  const [note, setNote] = useState(event.note ?? '');

  const start = fromLocalInput(at);
  const end = running ? null : fromLocalInput(endAt);
  const endInvalid = event.kind === 'sleep' && !running && (end === null || (start !== null && end < start));
  const valid = start !== null && !endInvalid;

  const save = () => {
    if (!valid || start === null) return;
    const amount = Number(ml) > 0 ? Math.round(Number(ml)) : undefined;
    onSave({
      kind: event.kind,
      at: start,
      endAt: event.kind === 'sleep' ? end : undefined,
      method: event.kind === 'feed' ? method : undefined,
      side: event.kind === 'feed' && method === 'breast' ? side : undefined,
      amountMl: (event.kind === 'feed' && method === 'bottle') || event.kind === 'pump' ? amount : undefined,
      diaper: event.kind === 'diaper' ? diaper : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog
      title={`Edit ${KIND_TITLE[event.kind].toLowerCase()}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-medium text-red-700 hover:bg-stone-100"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={18} /> Delete
          </button>
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
        <Field label={event.kind === 'sleep' ? 'Fell asleep' : 'Time'}>
          <input className={inputClass} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>

        {event.kind === 'sleep' && (
          <>
            <label className="flex min-h-11 items-center gap-3 text-base text-stone-800">
              <input type="checkbox" className="h-5 w-5 accent-forest-700" checked={running} onChange={(e) => setRunning(e.target.checked)} />
              Still asleep
            </label>
            {!running && (
              <Field label="Woke up" hint={endInvalid ? 'Pick a time after falling asleep.' : undefined}>
                <input className={inputClass} type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </Field>
            )}
          </>
        )}

        {event.kind === 'feed' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Feeding method">
              <Chip active={method === 'breast'} onClick={() => setMethod('breast')}>Breast</Chip>
              <Chip active={method === 'bottle'} onClick={() => setMethod('bottle')}>Bottle</Chip>
            </div>
            {method === 'breast' ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Side">
                {(['left', 'right', 'both'] as const).map((s) => (
                  <Chip key={s} active={side === s} onClick={() => setSide(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Chip>
                ))}
              </div>
            ) : (
              <Field label="Amount in ml">
                <input className={inputClass} type="number" inputMode="numeric" min={1} max={1000} value={ml} onChange={(e) => setMl(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {event.kind === 'diaper' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Diaper">
            {(['wet', 'dirty', 'both'] as const).map((d) => (
              <Chip key={d} active={diaper === d} onClick={() => setDiaper(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Chip>
            ))}
          </div>
        )}

        {event.kind === 'pump' && (
          <Field label="Amount in ml">
            <input className={inputClass} type="number" inputMode="numeric" min={1} max={1000} value={ml} onChange={(e) => setMl(e.target.value)} />
          </Field>
        )}

        <Field label="Note (optional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
