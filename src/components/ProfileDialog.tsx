import { useState } from 'react';
import type { BabyProfile } from '../lib/model';
import { LIMITS } from '../lib/model';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { ProfileInput } from '../data/types';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export type ProfileMode = 'due' | 'born' | 'edit';

const TITLES: Record<ProfileMode, string> = { due: 'Due date', born: 'Baby is here', edit: 'Baby details' };

/** Due date and name before the birth; name and birth date for "Baby is here"; everything to edit. */
export function ProfileDialog({ mode, profile, now, onSave, onClose }: {
  mode: ProfileMode;
  profile: BabyProfile | null;
  now: number;
  onSave: (p: ProfileInput) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? '');
  const [dueDate, setDueDate] = useState(profile?.dueDate ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? (mode === 'born' ? toYmd(now) : ''));
  const valid = mode === 'born' ? !!birthDate : mode === 'due' ? !!dueDate : true;

  const save = () => {
    onSave({ name, dueDate: dueDate || undefined, birthDate: mode === 'due' ? profile?.birthDate : birthDate || undefined });
    onClose();
  };

  return (
    <Dialog
      title={TITLES[mode]}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            {mode === 'born' ? 'Start the log' : 'Save'}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save();
        }}
      >
        {mode === 'born' && <p className="text-base text-muted">The main screen becomes the feeding, sleep and diaper log. You can change these later.</p>}
        <Field label={mode === 'due' ? 'Name (optional)' : 'Name'}>
          <input className={inputClass} value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        {mode !== 'born' && (
          <Field label="Due date">
            <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required={mode === 'due'} />
          </Field>
        )}
        {mode !== 'due' && (
          <Field label="Birth date" hint={mode === 'edit' ? 'Clear it to go back to the countdown.' : undefined}>
            <input className={inputClass} type="date" value={birthDate} max={toYmd(now)} onChange={(e) => setBirthDate(e.target.value)} required={mode === 'born'} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
