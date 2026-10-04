import { useState } from 'react';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

const PRESETS = [60, 90, 120, 150, 180];

/** Millilitres for a bottle or a pump session. */
export function AmountDialog({ title, action, initial, onLog, onClose }: {
  title: string;
  action: string;
  initial?: number;
  onLog: (ml: number | undefined) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [ml, setMl] = useState(initial ? String(initial) : '');
  const value = Number(ml);
  const amount = Number.isFinite(value) && value > 0 && value <= 1000 ? Math.round(value) : undefined;
  const log = () => {
    onLog(amount);
    onClose();
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryButton} onClick={log}>
            {action}
          </button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Chip key={p} active={amount === p} onClick={() => setMl(String(p))}>
            {t('unit.ml', { ml: p })}
          </Chip>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          log();
        }}
      >
        <Field label={t('amount.label')} hint={t('amount.hint')}>
          <input className={inputClass} inputMode="numeric" type="number" min={1} max={1000} value={ml} onChange={(e) => setMl(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
