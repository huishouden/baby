import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { cardClass, overline } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

// Kept to what ACOG ("How to Tell When Labor Begins", "Preterm Labor and Birth"), Cleveland Clinic
// (Braxton Hicks, labor contractions, round ligament pain) and MedlinePlus ("Am I in labor?",
// preterm labor) say. It compares, it never concludes: no line says "this is labor".

const ROWS = [
  { label: 'contractions.explain.timing.label', practice: 'contractions.explain.timing.practice', labor: 'contractions.explain.timing.labor' },
  { label: 'contractions.explain.change.label', practice: 'contractions.explain.change.practice', labor: 'contractions.explain.change.labor' },
  { label: 'contractions.explain.strength.label', practice: 'contractions.explain.strength.practice', labor: 'contractions.explain.strength.labor' },
  { label: 'contractions.explain.where.label', practice: 'contractions.explain.where.practice', labor: 'contractions.explain.where.labor' },
  { label: 'contractions.explain.length.label', practice: 'contractions.explain.length.practice', labor: 'contractions.explain.length.labor' },
] as const;
const RED_FLAGS = ['contractions.explain.red.water', 'contractions.explain.red.bleeding', 'contractions.explain.red.movement', 'contractions.explain.red.pain'] as const;
const CHECKS = [
  'contractions.explain.check.position',
  'contractions.explain.check.rest',
  'contractions.explain.check.water',
  'contractions.explain.check.bladder',
  'contractions.explain.check.time',
] as const;
const OTHERS = ['contractions.explain.other.ligament', 'contractions.explain.other.bladder', 'contractions.explain.other.gut'] as const;

interface Props {
  /** True before 37 weeks, false from 37, null when there is no due date to tell. */
  preterm: boolean | null;
  /** The Call button for the household's L&D contact, when it has a phone number. */
  call?: ReactNode;
}

/** "Labor or practice contractions?": a folded comparison, with the preterm note always out when it applies. */
export function LaborOrPractice({ preterm, call }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const pretermNote = (prominent: boolean) => (
    <div
      role="note"
      data-testid={prominent ? 'preterm-note' : undefined}
      className={prominent ? 'rounded-xl border-2 border-attention-fill bg-attention-tint px-3 py-3 text-ink' : 'rounded-xl border border-line bg-sunken px-3 py-3 text-ink'}
    >
      <p className="text-lg font-semibold">{t('contractions.explain.pretermTitle')}</p>
      <p className="mt-1 text-base">{t('contractions.explain.pretermBody')}</p>
      {prominent && call}
    </div>
  );

  return (
    <section className={`${cardClass} space-y-3 p-4 sm:p-6`} aria-label={t('contractions.explain.title')} data-testid="labor-or-practice">
      {preterm === true && pretermNote(true)}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-sunken"
      >
        <CircleHelp size={22} aria-hidden="true" className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-ink">{t('contractions.explain.title')}</span>
          <span className="block text-sm text-muted">{t('contractions.explain.hint')}</span>
        </span>
        <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div id={bodyId} hidden={!open} className="space-y-5">
        <div className="rounded-xl border border-line bg-attention-tint px-3 py-3 text-ink" data-testid="red-flags">
          <p className="text-base font-semibold">{t('contractions.explain.redTitle')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base">
            {RED_FLAGS.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
        </div>

        {preterm === null && pretermNote(false)}

        <div>
          <p className={overline}>{t('contractions.explain.compareTitle')}</p>
          <table className="mt-2 w-full table-fixed border-collapse text-left text-base">
            <thead>
              <tr>
                <th scope="col" className="w-1/2 pr-2 pb-1 align-bottom text-sm font-semibold text-muted">{t('contractions.explain.practice')}</th>
                <th scope="col" className="w-1/2 pl-2 pb-1 align-bottom text-sm font-semibold text-muted">{t('contractions.explain.labor')}</th>
              </tr>
            </thead>
            {ROWS.map((r) => (
              <tbody key={r.label} className="border-t border-line">
                <tr>
                  <th scope="rowgroup" colSpan={2} className="pt-2 text-sm font-semibold text-ink">{t(r.label)}</th>
                </tr>
                <tr>
                  <td className="pr-2 pb-2 align-top text-muted">{t(r.practice)}</td>
                  <td className="pl-2 pb-2 align-top text-ink">{t(r.labor)}</td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>

        <div>
          <p className={overline}>{t('contractions.explain.checkTitle')}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-base text-ink">
            {CHECKS.map((k) => <li key={k}>{t(k)}</li>)}
          </ol>
          <p className="mt-2 text-base text-ink">{t('contractions.explain.checkAfter')}</p>
        </div>

        <div>
          <p className={overline}>{t('contractions.explain.otherTitle')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-ink">
            {OTHERS.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
        </div>

        <div className="space-y-1 border-t border-line pt-3 text-sm text-muted">
          <p>{t('contractions.explain.disclaimer')}</p>
          <p>{t('contractions.explain.sources')}</p>
        </div>
      </div>
    </section>
  );
}
