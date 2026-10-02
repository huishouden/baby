import { useState } from 'react';
import { CalendarPlus, ChevronDown, ChevronUp, MapPin, Pencil } from 'lucide-react';
import type { Appointment } from '../lib/model';
import { relativeDay } from '../lib/time';
import { formatDayLong, formatTime, monthShort } from '../lib/format';
import { useClock } from '../clock';
import type { BabyStore } from '../data/types';
import { cardClass, ghostButton, iconButton, primaryButton } from '../components/ui';

export function Appointments({ store, onAdd, onEdit }: { store: BabyStore; onAdd: () => void; onEdit: (a: Appointment) => void }) {
  const { now } = useClock();
  const [showPast, setShowPast] = useState(false);
  const all = store.data.appointments;
  const upcoming = all.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at);
  const past = all.filter((a) => a.at < now - 3_600_000).sort((a, b) => b.at - a.at);

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-stone-800">Appointments</h2>
        <button type="button" className={primaryButton} onClick={onAdd}>
          <CalendarPlus size={20} /> Add appointment
        </button>
      </div>

      <section className={cardClass} aria-label="Upcoming appointments">
        {upcoming.length === 0 && <p className="p-6 text-lg text-stone-600">No appointments coming up.</p>}
        <ul>
          {upcoming.map((a, i) => (
            <Row key={a.id} a={a} now={now} first={i === 0} onEdit={() => onEdit(a)} />
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section aria-label="Past appointments">
          <button type="button" className={ghostButton} onClick={() => setShowPast((s) => !s)} aria-expanded={showPast}>
            {showPast ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Past ({past.length})
          </button>
          {showPast && (
            <ul className={`${cardClass} mt-2`}>
              {past.map((a) => (
                <Row key={a.id} a={a} now={now} onEdit={() => onEdit(a)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ a, now, first, onEdit }: { a: Appointment; now: number; first?: boolean; onEdit: () => void }) {
  const d = new Date(a.at);
  return (
    <li className="flex items-start gap-5 border-b border-stone-200 p-5 last:border-b-0">
      <div className={`flex w-16 shrink-0 flex-col items-center rounded-xl py-2 ${first ? 'bg-forest-700 text-white' : 'bg-forest-50 text-forest-700'}`}>
        <span className="text-sm font-medium">{monthShort(a.at)}</span>
        <span className="text-2xl font-semibold tabular-nums">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${first ? 'text-2xl' : 'text-xl'} font-semibold text-stone-800`}>{a.title}</p>
        <p className="mt-0.5 text-base text-stone-700">
          <span className="font-medium text-forest-700">{relativeDay(a.at, now)}</span> · {formatDayLong(a.at)}, {formatTime(a.at)}
        </p>
        {a.location && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
            <MapPin size={16} aria-hidden="true" /> {a.location}
          </p>
        )}
        {a.notes && <p className="mt-1 text-base whitespace-pre-line text-stone-600">{a.notes}</p>}
      </div>
      <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit ${a.title}`}>
        <Pencil size={18} />
      </button>
    </li>
  );
}
