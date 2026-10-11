import { useEffect, useState } from 'react';
import { Hand, Minus, Pencil, Phone, Plus, Square, Trash2, Undo2 } from 'lucide-react';
import { telHref } from '@huishouden/pwa-kit/places';
import { HOUR, formatDayShort, formatTime, parseYmd, weekdayName } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import { Checkbox, cardClass, iconButton, inputClass, overline, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { can } from '@huishouden/pwa-kit/roles';
import type { BabyStore } from '../data/types';
import { DeviceNotifications, type LiveNotifications } from '../components/Notifications';
import { providerContact } from '../lib/contractions';
import { STRIP_MAX, clampTarget, clock, lengthOf, minutesOf, needsCall, newestFirst, reachedTarget, running, strip, targetOf, timeToTarget, type Day } from '../lib/kicks';
import { LIMITS, type KickSession } from '../lib/model';
import { mayChange } from '../lib/roles';
import { useT } from '../i18n';

type Translate = ReturnType<typeof useT>;

interface Props {
  store: BabyStore;
  notify: (message: string, undo?: () => void) => void;
  /** Signed in, the household and address the notifications switch acts for. */
  live?: LiveNotifications;
}

/** "23 min" or "1 h 05 min". */
function span(t: Translate, ms: number): string {
  const m = minutesOf(ms);
  return m >= 60 ? t('kicks.spanHour', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') }) : t('kicks.spanMin', { m });
}

/** "10 movements in 23 min", or for a count stopped early "7 of 10 movements in 45 min, stopped". */
function resultOf(t: Translate, s: KickSession, now: number): string {
  const ms = timeToTarget(s);
  return ms != null
    ? t('kicks.result', { n: s.target, span: span(t, ms) })
    : t('kicks.stoppedResult', { n: s.taps.length, target: s.target, span: span(t, lengthOf(s, now)) });
}

/** The kick counter: the guidance, one big Movement button, the last 14 days, and the history. */
export function Kicks({ store, notify, live }: Props) {
  const t = useT();
  const { now: slow, read } = useClock();
  const { kickSessions, kickSettings, contacts } = store.data;
  const sessions = newestFirst(kickSessions);
  const current = running(kickSessions);
  const currentId = current?.id;
  // The elapsed time moves every second; the shared clock only every 15.
  const [tick, setTick] = useState<number | null>(null);
  useEffect(() => {
    if (!currentId) {
      setTick(null);
      return;
    }
    const id = setInterval(() => setTick(read()), 1000);
    return () => clearInterval(id);
  }, [currentId, read]);
  const now = Math.max(slow, tick ?? 0);

  const target = current?.target ?? targetOf(kickSettings);
  const last = sessions.find((s) => s.id !== currentId);
  const provider = providerContact(contacts);
  const callNow = !!current && needsCall(current, now);
  const mayDelete = (s: KickSession) => mayChange(store.role, store.me, s);
  const days = strip(kickSessions, now);

  const tap = () => {
    if (!current) return;
    navigator.vibrate?.(30);
    store.actions.tapKick(current.id);
  };
  const remove = (s: KickSession) => {
    store.actions.deleteKickSession(s.id);
    notify(t('kicks.deleted'), () => store.actions.restoreKickSession(s));
  };

  return (
    <div className="space-y-4 lg:h-full lg:overflow-y-auto">
      <p role="note" className="rounded-2xl border border-line bg-attention-tint px-4 py-3 text-base text-ink" data-testid="kick-guidance">
        {t('kicks.guidance', { target })}
      </p>

      {callNow && current && (
        <section role="alert" className="rounded-2xl border-2 border-attention-fill bg-attention-tint p-4" data-testid="kick-call" aria-label={t('kicks.callNow')}>
          <p className="text-2xl font-semibold text-ink">{t('kicks.callNow')}</p>
          <p className="mt-1 text-base text-ink">{t('kicks.callBody', { n: current.taps.length, target: current.target })}</p>
          {provider?.phone ? (
            <a className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-lg font-semibold text-link" href={telHref(provider.phone)}>
              <Phone size={20} aria-hidden="true" />
              <span className="min-w-0 text-left">
                <span className="block [overflow-wrap:anywhere]">{t('kicks.call', { name: provider.name })}</span>
                <span className="block text-base font-medium tabular-nums">{provider.phone}</span>
              </span>
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('kicks.noContact')}</p>
          )}
        </section>
      )}

      <section className={`${cardClass} p-4 sm:p-6`} aria-label={t('kicks.title')}>
        {current ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-semibold text-ink tabular-nums" data-testid="kick-progress" role="status">
                {t('kicks.progress', { n: current.taps.length, target: current.target })}
              </p>
              <p className="text-3xl font-semibold text-ink tabular-nums" data-testid="kick-elapsed" aria-label={t('kicks.elapsed')}>
                {clock(lengthOf(current, now))}
              </p>
            </div>
            <button
              type="button"
              onClick={tap}
              className="mt-3 flex min-h-56 w-full touch-manipulation select-none flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-8 text-4xl font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-hover active:bg-primary-hover"
            >
              <Hand size={48} aria-hidden="true" />
              {t('kicks.movement')}
              <span className="text-6xl tabular-nums" aria-hidden="true">{current.taps.length}</span>
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* A helper adds movements to and ends someone else's count, but never takes one back (the rules). */}
              {mayDelete(current) && (
                <button type="button" className={`${secondaryButton} min-h-14`} disabled={current.taps.length === 0} onClick={() => store.actions.undoKick(current.id)}>
                  <Undo2 size={18} aria-hidden="true" /> {t('kicks.undo')}
                </button>
              )}
              <button type="button" className={`${secondaryButton} min-h-14 ${mayDelete(current) ? '' : 'col-span-2'}`} onClick={() => store.actions.stopKicks(current.id)}>
                <Square size={18} aria-hidden="true" /> {t('kicks.stop')}
              </button>
            </div>
            {mayDelete(current) && (
              <button type="button" className={`${secondaryButton} mt-3 w-full`} onClick={() => remove(current)}>
                <Trash2 size={18} aria-hidden="true" /> {t('kicks.cancel')}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => store.actions.startKicks()}
              className="flex min-h-40 w-full touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-4 py-6 text-3xl font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-hover"
            >
              <Hand size={32} aria-hidden="true" />
              {t('kicks.start')}
            </button>
            {last && (
              <p className="mt-3 text-lg text-ink" data-testid="kick-last">
                {t('kicks.lastAgo', { result: resultOf(t, last, now) })}
              </p>
            )}
          </>
        )}
      </section>

      <section className={`${cardClass} p-4 sm:p-6`} aria-label={t('kicks.stripTitle')} data-testid="kick-strip">
        <p className={overline}>{t('kicks.stripTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('kicks.stripHint', { target: targetOf(kickSettings) })}</p>
        <ul className="mt-3 flex h-36 items-end gap-1">
          {days.map((d) => (
            <StripDay key={d.ymd} day={d} today={d === days[days.length - 1]} target={targetOf(kickSettings)} />
          ))}
        </ul>
      </section>

      {!can(store.role, 'edit-others') && kickSessions.some((s) => s.by !== store.me) && <RoleNote action="edit-others" />}

      <section className="space-y-3" aria-label={t('kicks.history')}>
        {sessions.length === 0 && <p className="text-lg text-muted">{t('kicks.none')}</p>}
        {sessions.length > 0 && (
          <div className={`${cardClass} p-4 sm:p-6`}>
            <p className={overline}>{t('kicks.history')}</p>
            <ul className="mt-2">
              {sessions.map((s) => (
                <HistoryRow key={s.id} session={s} now={now} store={store} canEdit={mayDelete(s)} onDelete={() => remove(s)} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <Settings store={store} />
      {can(store.role, 'change-settings') && <DeviceNotifications live={live} />}
    </div>
  );
}

function StripDay({ day, today, target }: { day: Day; today: boolean; target: number }) {
  const t = useT();
  const when = parseYmd(day.ymd)!;
  const name = formatDayShort(when);
  const s = day.session;
  const label = day.minutes != null
    ? t('kicks.stripDay', { day: name, span: span(t, day.minutes * 60_000), target })
    : s
      ? t('kicks.stripStopped', { day: name, n: s.taps.length, target })
      : t('kicks.stripEmpty', { day: name });
  const pct = day.minutes != null ? Math.max(6, Math.min(100, (day.minutes * 60_000 * 100) / STRIP_MAX)) : 0;
  return (
    <li className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" data-testid="kick-day" data-minutes={day.minutes ?? ''}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="text-xs text-muted tabular-nums">{day.minutes ?? (s ? s.taps.length : '')}</span>
      <span aria-hidden="true" className="flex w-full flex-1 items-end">
        {day.minutes != null ? (
          <span className="w-full rounded-t-md bg-forest-600 dark:bg-forest-300" style={{ height: `${pct}%` }} />
        ) : s ? (
          <span className="h-3 w-full rounded-t-md border-2 border-attention-fill" />
        ) : (
          <span className="h-1 w-full rounded-full bg-sunken" />
        )}
      </span>
      <span aria-hidden="true" className={`text-xs tabular-nums ${today ? 'font-semibold text-ink' : 'text-muted'}`}>
        {weekdayName(new Date(when).getDay(), { short: true }).slice(0, 1).toUpperCase()}
      </span>
    </li>
  );
}

function HistoryRow({ session: s, now, store, canEdit, onDelete }: { session: KickSession; now: number; store: BabyStore; canEdit: boolean; onDelete: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const going = s.end == null;
  const slow = reachedTarget(s) && (timeToTarget(s) ?? 0) > 2 * HOUR;
  return (
    <li className="border-b border-line py-3 last:border-b-0" data-testid="kick-row">
      <div className="flex min-h-12 items-center gap-3">
        <span className="w-24 shrink-0 text-base text-muted">
          <span className="block">{formatDayShort(s.start)}</span>
          <span className="block tabular-nums">{formatTime(s.start)}</span>
        </span>
        <span className={`min-w-0 flex-1 text-lg font-semibold tabular-nums ${slow ? 'text-attention' : 'text-ink'}`}>
          {going ? t('kicks.going', { n: s.taps.length, target: s.target }) : resultOf(t, s, now)}
        </span>
        {canEdit && !editing && (
          <button
            type="button"
            className={iconButton}
            aria-label={t('kicks.editNote', { time: formatTime(s.start) })}
            onClick={() => {
              setDraft(s.note ?? '');
              setEditing(true);
            }}
          >
            <Pencil size={20} aria-hidden="true" />
          </button>
        )}
        {canEdit && (
          <button type="button" className={iconButton} aria-label={t('kicks.delete', { time: formatTime(s.start) })} onClick={onDelete}>
            <Trash2 size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            store.actions.saveKickNote(s.id, draft);
            setEditing(false);
          }}
        >
          <input className={inputClass} value={draft} maxLength={LIMITS.kickNote} placeholder={t('kicks.notePlaceholder')} aria-label={t('kicks.note')} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className={primaryButton}>{t('common.save')}</button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      ) : (
        s.note && <p className="mt-1 text-base text-muted [overflow-wrap:anywhere]" data-testid="kick-note">{s.note}</p>
      )}
    </li>
  );
}

/** The movements to count and the daily reminder: admins and members change them, helpers see them. */
function Settings({ store }: { store: BabyStore }) {
  const t = useT();
  const saved = store.data.kickSettings;
  const canChange = can(store.role, 'change-settings');
  const [target, setTarget] = useState(targetOf(saved));
  const [remind, setRemind] = useState(!!saved?.remindAt);
  const [at, setAt] = useState(saved?.remindAt ?? '19:00');
  // Another device's change arrives; a draft being edited here is not overwritten until saved.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty) return;
    setTarget(targetOf(saved));
    setRemind(!!saved?.remindAt);
    setAt(saved?.remindAt ?? '19:00');
  }, [saved, dirty]);
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    setDirty(true);
    set(v);
  };

  if (!canChange)
    return (
      <section className={`${cardClass} p-4 sm:p-6`} aria-label={t('kicks.settings')}>
        <p className={overline}>{t('kicks.settings')}</p>
        <p className="mt-2 text-base text-ink">{t('kicks.progress', { n: targetOf(saved), target: targetOf(saved) })}</p>
        <p className="mt-1 text-sm text-muted">{t('kicks.readOnly')}</p>
      </section>
    );
  return (
    <section className={`${cardClass} p-4 sm:p-6`} aria-label={t('kicks.settings')}>
      <p className={overline}>{t('kicks.settings')}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-base text-ink">{t('kicks.target')}</p>
        <div className="flex items-center gap-2">
          <button type="button" className={iconButton} aria-label={t('kicks.targetFewer')} onClick={() => edit(setTarget)(clampTarget(target - 1))}>
            <Minus size={20} aria-hidden="true" />
          </button>
          <span className="w-10 text-center text-2xl font-semibold text-ink tabular-nums" data-testid="kick-target">{target}</span>
          <button type="button" className={iconButton} aria-label={t('kicks.targetMore')} onClick={() => edit(setTarget)(clampTarget(target + 1))}>
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-3">
        <Checkbox checked={remind} onChange={edit(setRemind)} describedBy="kick-remind-hint">
          {t('kicks.remindOn')}
        </Checkbox>
        <p id="kick-remind-hint" className="ml-9 text-sm text-muted">{t('kicks.remindHint')}</p>
        {remind && (
          <label className="ml-9 mt-2 block">
            <span className="text-sm text-muted">{t('kicks.remindAt')}</span>
            <input type="time" className={`${inputClass} mt-1 max-w-40`} value={at} onChange={(e) => edit(setAt)(e.target.value)} />
          </label>
        )}
      </div>
      <button
        type="button"
        className={`${primaryButton} mt-4`}
        disabled={!dirty}
        onClick={() => {
          store.actions.saveKickSettings({ target, ...(remind && at ? { remindAt: at } : {}) });
          setDirty(false);
        }}
      >
        {t('common.save')}
      </button>
    </section>
  );
}
