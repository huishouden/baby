import { useMemo, useState, type ReactNode } from 'react';
import { can } from '@huishouden/pwa-kit/roles';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { mayChange } from '../lib/roles';
import { Baby, ChevronLeft, ChevronRight, Droplet, Droplets, Milk, Moon, Pencil, Sun } from 'lucide-react';
import type { BabyEvent, DiaperKind, Side } from '../lib/model';
import { dayTimeline, dayTotals, describeEvent, diaperBreakdown, feedDetail, ofKind, sleepState } from '../lib/summary';
import { latest } from '@huishouden/pwa-kit/log';
import { addDays, formatDayLong, formatDuration, formatHours, formatTime, startOfDay } from '@huishouden/pwa-kit/time';
import { babyAge } from '../lib/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { BabyStore } from '../data/types';
import { AmountDialog } from '../components/AmountDialog';
import { EventDialog } from '../components/EventDialog';
import { PersonBadge, cardClass, iconButton } from '@huishouden/pwa-kit/react/ui';

const HISTORY_DAYS = 13;

interface Props {
  store: BabyStore;
  notify: (message: string, undo?: () => void) => void;
  /** Left out for helpers and kids: the baby's details are the household's settings. */
  onEditProfile?: () => void;
}

/** After the birth: what happened last, one-tap logging, and today's totals and timeline. */
export function LogScreen({ store, notify, onEditProfile }: Props) {
  const { now, read } = useClock();
  const { data, actions } = store;
  const [amountFor, setAmountFor] = useState<'bottle' | 'pump' | null>(null);
  const [editing, setEditing] = useState<BabyEvent | null>(null);
  const [dayOffset, setDayOffset] = useState(0);

  const events = data.events;
  const lastFeed = latest(events, now, ofKind('feed'));
  const sleep = sleepState(events, now);
  const lastDiaper = latest(events, now, ofKind('diaper'));
  const day = addDays(now, -dayOffset);
  const dayStart = startOfDay(day);
  const totals = useMemo(() => dayTotals(events, dayStart, now), [events, dayStart, now]);
  const timeline = useMemo(() => dayTimeline(events, dayStart, now), [events, dayStart, now]);
  const lastPump = latest(events, now, ofKind('pump'));
  const lastBottle = useMemo(() => events.filter((e) => e.kind === 'feed' && e.method === 'bottle' && e.amountMl).sort((a, b) => b.at - a.at)[0], [events]);

  const log = (fields: Parameters<typeof actions.logEvent>[0], what: string) => {
    const e = actions.logEvent({ ...fields, at: read() });
    notify(`Logged ${what} at ${formatTime(e.at)}`, () => actions.deleteEvent(e.id));
  };
  const feed = (side: Side) => log({ kind: 'feed', method: 'breast', side }, `feed, ${side}`);
  const diaper = (d: DiaperKind) => log({ kind: 'diaper', diaper: d }, `${d} diaper`);
  const toggleSleep = () => {
    if (sleep.state === 'asleep') {
      // Anyone may end a sleep someone else started: only its end changes (huishouden/rules babyEvents).
      const before = sleep.event;
      const end = read();
      actions.updateEvent(before, { ...before, endAt: end });
      notify(`Woke up after ${formatDuration(end - before.at)}`, () => actions.restoreEvent(before));
    } else log({ kind: 'sleep', endAt: null }, 'sleep start');
  };

  const name = data.profile?.name;
  const age = data.profile?.birthDate ? babyAge(data.profile.birthDate, now) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-h-0 flex-col gap-6">
        <section className={`${cardClass} px-6 py-5`} aria-live="polite" aria-label="At a glance">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">
              {name ?? 'Baby'}
              {age && <span className="font-normal text-muted"> · {age}</span>}
            </h2>
            {onEditProfile && (
              <button type="button" onClick={onEditProfile} className={iconButton} aria-label="Edit baby details">
                <Pencil size={18} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <Glance
              label="Last fed"
              {...ago(lastFeed?.at, now)}
              detail={lastFeed ? `${feedDetail(lastFeed)}, ${formatTime(lastFeed.at)}` : 'Tap a feed button to log one'}
            />
            <Glance
              label={sleep.state === 'asleep' ? 'Asleep for' : sleep.state === 'awake' ? 'Awake for' : 'Sleep'}
              value={sleep.state === 'unknown' ? 'Not yet' : formatDuration(now - sleep.since)}
              detail={sleep.state === 'unknown' ? 'Start a sleep to time it' : `since ${formatTime(sleep.since)}`}
              attention={sleep.state === 'asleep'}
            />
            <Glance
              label="Last diaper"
              {...ago(lastDiaper?.at, now)}
              detail={lastDiaper ? `${lastDiaper.diaper ?? 'changed'}, ${formatTime(lastDiaper.at)}` : 'Tap wet, dirty or both'}
            />
          </div>
        </section>

        <section aria-label="Log" className={`${cardClass} grid flex-1 grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-rows-[1fr_1fr_1.1fr]`}>
          <BigButton onClick={() => feed('left')} icon={<Milk size={22} />} label="Left" sub="Breast feed" ariaLabel="Log breast feed, left" />
          <BigButton onClick={() => feed('right')} icon={<Milk size={22} />} label="Right" sub="Breast feed" ariaLabel="Log breast feed, right" />
          <BigButton onClick={() => feed('both')} icon={<Milk size={22} />} label="Both sides" sub="Breast feed" ariaLabel="Log breast feed, both sides" />
          <BigButton onClick={() => setAmountFor('bottle')} icon={<Milk size={22} />} label="Bottle" sub="Feed, in ml" ariaLabel="Log bottle feed" />
          <BigButton onClick={() => diaper('wet')} icon={<Droplet size={22} />} label="Wet" sub="Diaper" ariaLabel="Log wet diaper" />
          <BigButton onClick={() => diaper('dirty')} icon={<Baby size={22} />} label="Dirty" sub="Diaper" ariaLabel="Log dirty diaper" />
          <BigButton onClick={() => diaper('both')} icon={<Baby size={22} />} label="Wet and dirty" sub="Diaper" ariaLabel="Log wet and dirty diaper" />
          <BigButton
            onClick={() => setAmountFor('pump')}
            icon={<Droplets size={22} />}
            label="Pumped"
            sub={totals.pumps && dayOffset === 0 ? `${totals.pumpMl} ml today` : 'In ml'}
            ariaLabel="Log pumping"
          />
          <button
            type="button"
            onClick={toggleSleep}
            className={`col-span-2 flex min-h-24 w-full items-center justify-center gap-4 rounded-2xl border px-4 transition-colors duration-150 sm:col-span-4 ${
              sleep.state === 'asleep'
                ? 'border-primary bg-primary text-on-primary hover:bg-primary-hover'
                : 'border-line bg-page text-link hover:border-forest-400 hover:bg-tint'
            }`}
          >
            {sleep.state === 'asleep' ? <Sun size={32} /> : <Moon size={32} />}
            <span className="text-left">
              <span className="block text-2xl font-semibold">{sleep.state === 'asleep' ? 'Woke up' : 'Fell asleep'}</span>
              <span className={`block text-base tabular-nums ${sleep.state === 'asleep' ? 'text-forest-100 dark:text-forest-900' : 'text-muted'}`}>
                {sleep.state === 'asleep' ? `Asleep ${formatDuration(now - sleep.since)}. Tap to stop the sleep timer.` : 'Starts the sleep timer'}
              </span>
            </span>
          </button>
        </section>
      </div>

      <section className={`${cardClass} flex min-h-0 flex-col`} aria-label="Day">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <button type="button" className={iconButton} aria-label="Previous day" disabled={dayOffset >= HISTORY_DAYS} onClick={() => setDayOffset((d) => d + 1)}>
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-lg font-semibold text-ink">{dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Yesterday' : formatDayLong(day)}</h2>
          <button type="button" className={iconButton} aria-label="Next day" disabled={dayOffset === 0} onClick={() => setDayOffset((d) => d - 1)}>
            <ChevronRight size={22} />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line">
          <Total label="Feeds" value={String(totals.feeds)} detail={feedTotalsDetail(totals.breastFeeds, totals.bottleFeeds, totals.bottleMl)} />
          <Total label="Sleep" value={formatHours(totals.sleepMs)} detail={totals.sleepMs ? formatDuration(totals.sleepMs) : 'none yet'} />
          <Total label="Diapers" value={String(totals.diaperCount)} detail={diaperBreakdown(totals.diapers)} />
          <Total label="Pumped" value={`${totals.pumpMl} ml`} detail={totals.pumps ? `${totals.pumps} time${totals.pumps === 1 ? '' : 's'}` : 'none yet'} />
        </dl>
        {timeline.some((e) => !mayChange(store.role, store.me, e)) && !can(store.role, 'edit-others') && (
          <RoleNote action="edit-others" className="border-b border-line px-5 py-2" />
        )}
        <ol className="min-h-0 flex-1 overflow-y-auto" aria-label="Timeline">
          {timeline.length === 0 && <li className="px-5 py-6 text-base text-muted">Nothing logged {dayOffset === 0 ? 'yet today' : 'this day'}.</li>}
          {timeline.map((e) => (
            <li key={e.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2 pr-2 pl-5 last:border-b-0">
              <span className="w-[4.5rem] shrink-0 text-sm text-muted tabular-nums">{formatTime(e.at)}</span>
              <KindIcon event={e} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-ink">{describeEvent(e, now)}</p>
                {(e.kind === 'sleep' || e.note) && (
                  <p className="truncate text-sm text-muted">
                    {e.kind === 'sleep' && (e.endAt != null ? `${formatTime(e.at)} to ${formatTime(e.endAt)}` : 'Running')}
                    {e.kind === 'sleep' && e.note ? ' · ' : ''}
                    {e.note}
                  </p>
                )}
              </div>
              <PersonBadge email={e.by} me={store.me} members={store.members} size={30} />
              {mayChange(store.role, store.me, e) ? (
                <button type="button" className={iconButton} aria-label={`Edit ${describeEvent(e, now)} at ${formatTime(e.at)}`} onClick={() => setEditing(e)}>
                  <Pencil size={18} />
                </button>
              ) : (
                <span className="w-11 shrink-0" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {amountFor && (
        <AmountDialog
          title={amountFor === 'bottle' ? 'Bottle feed' : 'Pump'}
          action={amountFor === 'bottle' ? 'Log bottle' : 'Log pumping'}
          initial={amountFor === 'bottle' ? lastBottle?.amountMl : lastPump?.amountMl}
          onClose={() => setAmountFor(null)}
          onLog={(ml) =>
            amountFor === 'bottle'
              ? log({ kind: 'feed', method: 'bottle', amountMl: ml }, ml ? `bottle, ${ml} ml` : 'bottle')
              : log({ kind: 'pump', amountMl: ml }, ml ? `pumping, ${ml} ml` : 'pumping')
          }
        />
      )}
      {editing && (
        <EventDialog
          event={editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => {
            const before = editing;
            actions.updateEvent(before, fields);
            notify('Saved', () => actions.restoreEvent(before));
          }}
          onDelete={() => {
            const gone = editing;
            actions.deleteEvent(gone.id);
            notify(`Deleted ${describeEvent(gone, now).toLowerCase()}`, () => actions.restoreEvent(gone));
          }}
        />
      )}
    </div>
  );
}

function feedTotalsDetail(breast: number, bottle: number, ml: number) {
  const parts = [];
  if (breast) parts.push(`${breast} breast`);
  if (bottle) parts.push(`${bottle} bottle${ml ? `, ${ml} ml` : ''}`);
  return parts.length ? parts.join(' · ') : 'none yet';
}

/** Big number with "ago" on the smaller line, so the number never wraps. */
function ago(at: number | undefined, now: number): { value: string; prefix?: string } {
  if (at === undefined) return { value: 'Not yet' };
  if (now - at < 60_000) return { value: 'Just now' };
  return { value: formatDuration(now - at), prefix: 'ago' };
}

function Glance({ label, value, prefix, detail, attention }: { label: string; value: string; prefix?: string; detail: string; attention?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted sm:text-base">{label}</p>
      <p className={`text-2xl leading-tight font-semibold tracking-tight whitespace-nowrap sm:text-5xl tabular-nums ${attention ? 'text-link' : 'text-ink'}`}>{value}</p>
      <p className="text-sm text-muted sm:text-lg">
        {prefix ? `${prefix} · ` : ''}
        {detail}
      </p>
    </div>
  );
}

function BigButton({ onClick, label, sub, icon, ariaLabel }: { onClick: () => void; label: string; sub?: string; icon?: ReactNode; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-page px-2 py-2 text-link transition-colors duration-150 hover:border-forest-400 hover:bg-tint active:bg-tint-strong"
    >
      {icon}
      <span className="text-xl font-semibold">{label}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </button>
  );
}

function Total({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface px-5 py-3">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-2xl font-semibold text-ink tabular-nums">{value}</dd>
      <dd className="text-sm text-muted">
        {detail}
      </dd>
    </div>
  );
}

function KindIcon({ event }: { event: BabyEvent }) {
  const Icon = event.kind === 'feed' ? Milk : event.kind === 'sleep' ? Moon : event.kind === 'diaper' ? Baby : Droplets;
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint text-link" aria-hidden="true">
      <Icon size={18} />
    </span>
  );
}
