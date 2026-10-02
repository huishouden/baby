import { useState } from 'react';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

const PRESETS = [60, 90, 120, 150, 180];

/** Millilitres for a bottle or a pump session. */
export function AmountDialog({ title, action, initial, onLog, onClose }: {
  title: string;
  action: string;
  initial?: number;
  onLog: (ml: number | undefined) => void;
  onClose: () => void;
}) {
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
            Cancel
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
            {p} ml
          </Chip>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          log();
        }}
      >
        <Field label="Amount in ml" hint="Leave empty if you don't know.">
          <input className={inputClass} inputMode="numeric" type="number" min={1} max={1000} value={ml} onChange={(e) => setMl(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
