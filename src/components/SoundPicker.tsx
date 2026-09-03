import { useRef, useState } from 'react';
import type { SoundRef } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { BUILTIN_SOUNDS, SOUND_GROUPS } from '@/data/sounds';
import { audioService } from '@/services';
import { validateUpload } from '@/utils/validation';
import { Button, ConfirmDialog, cx } from './ui';

export function SoundPicker({
  value,
  volume = 0.7,
  onChange,
  allowUpload = true,
}: {
  value: SoundRef;
  volume?: number;
  onChange: (id: SoundRef) => void;
  allowUpload?: boolean;
}) {
  const t = useT();
  const customSounds = useStore((s) => s.customSounds);
  const addCustomSound = useStore((s) => s.addCustomSound);
  const deleteCustomSound = useStore((s) => s.deleteCustomSound);
  const toast = useStore((s) => s.toast);

  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<{ stop: () => void } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const preview = async (id: SoundRef) => {
    previewRef.current?.stop();
    if (previewing === id) {
      setPreviewing(null);
      return;
    }
    if (!audioService.isUnlocked()) await audioService.unlock();
    const h = await audioService.preview(id, volume);
    previewRef.current = h;
    setPreviewing(id);
    void h.ended.then(() => setPreviewing((p) => (p === id ? null : p)));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const check = validateUpload(file, 'audio');
    if (!check.ok) {
      toast(check.reason);
      return;
    }
    const res = await addCustomSound(file);
    if ('error' in res) toast(res.error);
    else onChange(`custom:${res.id}`);
  };

  return (
    <div className="space-y-4">
      {SOUND_GROUPS.map((group) => (
        <fieldset key={group.key}>
          <legend className="mb-2 text-xs font-medium text-muted">
            {t(group.labelKey as 'sounds.group.gentle')}
          </legend>
          <div className="space-y-1.5">
            {BUILTIN_SOUNDS.filter((s) => s.group === group.key).map((s) => (
              <SoundRow
                key={s.id}
                id={s.id}
                name={s.name}
                selected={value === s.id}
                previewing={previewing === s.id}
                onSelect={() => onChange(s.id)}
                onPreview={() => preview(s.id)}
                previewLabel={t('sounds.preview')}
                stopLabel={t('sounds.stop')}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">
          {t('sounds.custom')}
        </legend>
        {customSounds.length === 0 && (
          <p className="mb-2 text-sm text-muted">{t('sounds.none')}</p>
        )}
        <div className="space-y-1.5">
          {customSounds.map((c) => (
            <SoundRow
              key={c.id}
              id={`custom:${c.id}`}
              name={c.name}
              selected={value === `custom:${c.id}`}
              previewing={previewing === `custom:${c.id}`}
              onSelect={() => onChange(`custom:${c.id}`)}
              onPreview={() => preview(`custom:${c.id}`)}
              onDelete={() => setConfirmDelete(c.id)}
              previewLabel={t('sounds.preview')}
              stopLabel={t('sounds.stop')}
              deleteLabel={t('sounds.delete')}
            />
          ))}
        </div>

        {allowUpload && (
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {t('sounds.upload')}
            </Button>
            <p className="mt-1.5 text-xs text-muted">{t('sounds.uploadHint')}</p>
          </div>
        )}
      </fieldset>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('sounds.delete')}
        body={t('sounds.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteCustomSound(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function SoundRow({
  name,
  selected,
  previewing,
  onSelect,
  onPreview,
  onDelete,
  previewLabel,
  stopLabel,
  deleteLabel,
}: {
  id: string;
  name: string;
  selected: boolean;
  previewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete?: () => void;
  previewLabel: string;
  stopLabel: string;
  deleteLabel?: string;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition',
        selected ? 'border-accent/45 bg-accent-soft' : 'border-hairline',
      )}
    >
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-2.5 text-left text-sm font-medium"
        aria-pressed={selected}
      >
        <span
          className={cx(
            'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
            selected ? 'border-accent' : 'border-muted/60',
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
        </span>
        {name}
      </button>
      <button
        onClick={onPreview}
        aria-label={previewing ? stopLabel : `${previewLabel}: ${name}`}
        className={cx(
          'rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-surface-2',
          previewing ? 'text-accent' : 'text-muted hover:text-fg',
        )}
      >
        {previewing ? stopLabel : previewLabel}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label={`${deleteLabel}: ${name}`}
          className="rounded-lg px-2 py-1 text-xs font-medium text-danger/80 hover:bg-surface-2 hover:text-danger"
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
