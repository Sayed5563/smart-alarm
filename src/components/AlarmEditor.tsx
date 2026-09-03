import { useState, type ReactNode } from 'react';
import type { Alarm, FadeInDuration } from '@/types';
import { useStore } from '@/store/useStore';
import { useT, type TranslationKey } from '@/i18n';
import { CATEGORIES } from '@/data/categories';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { pad2, clamp } from '@/utils/time';
import { vibrationService } from '@/services';
import { Sheet, Button, Segmented, Slider, RowToggle, Field, cx } from './ui';
import { DayPicker } from './alarmBits';
import { SoundPicker } from './SoundPicker';

const FADE_OPTIONS: FadeInDuration[] = [0, 10, 30, 60, 300];
const SNOOZE_OPTIONS = [5, 10, 15, 20];

export function AlarmEditor({
  alarm,
  isNew,
  onClose,
}: {
  alarm: Alarm;
  isNew: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const updateAlarm = useStore((s) => s.updateAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const [draft, setDraft] = useState<Alarm>(alarm);

  const patch = (p: Partial<Alarm>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    updateAlarm(draft.id, {
      ...draft,
      strongAlert: {
        ...draft.strongAlert,
        maxDurationMinutes: clamp(draft.strongAlert.maxDurationMinutes, 1, MAX_ALERT_DURATION_MINUTES),
      },
    });
    onClose();
  };

  const cancel = () => {
    if (isNew) deleteAlarm(draft.id);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={cancel}
      title={isNew ? t('editor.newTitle') : t('editor.editTitle')}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={cancel}>
            {t('editor.cancel')}
          </Button>
          <Button variant="primary" full onClick={save} data-autofocus>
            {t('editor.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* -------------------------------------------------- Basic */}
        <section className="space-y-3">
          <Field label={t('editor.time')} htmlFor="alarm-time">
            <input
              id="alarm-time"
              type="time"
              value={`${pad2(draft.hour)}:${pad2(draft.minute)}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!Number.isNaN(h) && !Number.isNaN(m)) patch({ hour: h, minute: m });
              }}
              className="tnum w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-3xl"
            />
          </Field>

          <Field label={t('editor.label')} htmlFor="alarm-label">
            <input
              id="alarm-label"
              type="text"
              maxLength={80}
              value={draft.label}
              placeholder={t('editor.labelPlaceholder')}
              onChange={(e) => patch({ label: e.target.value })}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3"
            />
          </Field>

          <Field label={t('editor.category')}>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={draft.category === c.key}
                  onClick={() => patch({ category: c.key })}
                  className={cx(
                    'flex items-center gap-1.5 rounded-pill px-3 py-2 text-sm font-medium transition',
                    draft.category === c.key ? 'bg-accent text-accent-contrast' : 'glass text-muted',
                  )}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  {t(c.labelKey as TranslationKey)}
                </button>
              ))}
            </div>
          </Field>

          <RowToggle
            label={t('editor.enabled')}
            checked={draft.enabled}
            onChange={(v) => patch({ enabled: v })}
          />
        </section>

        {/* -------------------------------------------------- Repeat */}
        <Section title={t('editor.section.repeat')}>
          <Segmented
            value={draft.repeat}
            onChange={(v) => patch({ repeat: v })}
            label={t('editor.section.repeat')}
            options={[
              { value: 'once', label: t('repeat.once') },
              { value: 'daily', label: t('repeat.daily') },
              { value: 'weekdays', label: t('repeat.weekdays') },
              { value: 'weekends', label: t('repeat.weekends') },
              { value: 'custom', label: t('repeat.custom') },
            ]}
          />
          {draft.repeat === 'custom' && (
            <div className="mt-3">
              <DayPicker value={draft.customDays} onChange={(customDays) => patch({ customDays })} />
            </div>
          )}
        </Section>

        {/* -------------------------------------------------- Sound & volume */}
        <Section title={t('editor.section.sound')} defaultOpen>
          <div className="space-y-4">
            <Slider
              label={t('editor.volume')}
              value={Math.round(draft.volume * 100)}
              onChange={(v) => patch({ volume: v / 100 })}
              format={(v) => `${v}%`}
            />
            <Field label={t('editor.fadeIn')} hint={t('editor.fadeInHint')}>
              <Segmented
                value={String(draft.fadeInSeconds)}
                onChange={(v) => patch({ fadeInSeconds: Number(v) as FadeInDuration })}
                options={FADE_OPTIONS.map((f) => ({
                  value: String(f),
                  label: f === 0 ? t('common.off') : f < 60 ? `${f}s` : `${f / 60}m`,
                }))}
              />
            </Field>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">{t('editor.sound')}</summary>
              <div className="mt-3">
                <SoundPicker
                  value={draft.soundId}
                  volume={draft.volume}
                  onChange={(soundId) => patch({ soundId })}
                />
              </div>
            </details>
          </div>
        </Section>

        {/* -------------------------------------------------- Snooze / vibration */}
        <Section title={t('editor.snooze')}>
          <div className="space-y-4">
            <Field label={t('editor.snooze')}>
              <div className="flex flex-wrap gap-2">
                {SNOOZE_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={draft.snoozeMinutes === m}
                    onClick={() => patch({ snoozeMinutes: m })}
                    className={cx(
                      'rounded-pill px-4 py-2 text-sm font-medium',
                      draft.snoozeMinutes === m ? 'bg-accent text-accent-contrast' : 'glass text-muted',
                    )}
                  >
                    {t('editor.minutes', { n: m })}
                  </button>
                ))}
                <label className="flex items-center gap-2 rounded-pill glass px-3 py-1.5 text-sm">
                  <span className="text-muted">{t('repeat.custom')}</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={draft.snoozeMinutes}
                    onChange={(e) =>
                      patch({ snoozeMinutes: clamp(Math.trunc(+e.target.value || 1), 1, 60) })
                    }
                    className="tnum w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center"
                  />
                </label>
              </div>
            </Field>

            <Field
              label={t('editor.vibration')}
              hint={vibrationService.isSupported() ? undefined : t('editor.vibrationUnsupported')}
            >
              <Segmented
                value={draft.vibration}
                onChange={(v) => patch({ vibration: v })}
                options={[
                  { value: 'off', label: t('common.off') },
                  { value: 'short', label: t('difficulty.easy') },
                  { value: 'medium', label: t('difficulty.medium') },
                  { value: 'strong', label: t('difficulty.hard') },
                ]}
              />
            </Field>
          </div>
        </Section>

        {/* -------------------------------------------------- Smart wake-up */}
        <Section title={t('editor.section.smart')}>
          <div className="space-y-4">
            <Field label={t('editor.wakeTask')} hint={t('editor.wakeTaskHint')}>
              <select
                value={draft.wakeUpTask.type}
                onChange={(e) =>
                  patch({ wakeUpTask: { ...draft.wakeUpTask, type: e.target.value as Alarm['wakeUpTask']['type'] } })
                }
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3"
              >
                <option value="none">{t('editor.wakeTask.none')}</option>
                <option value="math">{t('editor.wakeTask.math')}</option>
                <option value="code">{t('editor.wakeTask.code')}</option>
                <option value="sequence">{t('editor.wakeTask.sequence')}</option>
                <option value="qr">{t('editor.wakeTask.qr')}</option>
              </select>
            </Field>

            {draft.wakeUpTask.type !== 'none' && draft.wakeUpTask.type !== 'qr' && (
              <>
                <Field label={t('editor.wakeTask.difficulty')}>
                  <Segmented
                    value={draft.wakeUpTask.difficulty}
                    onChange={(v) => patch({ wakeUpTask: { ...draft.wakeUpTask, difficulty: v } })}
                    options={[
                      { value: 'easy', label: t('difficulty.easy') },
                      { value: 'medium', label: t('difficulty.medium') },
                      { value: 'hard', label: t('difficulty.hard') },
                    ]}
                  />
                </Field>
                <Field label={t('editor.wakeTask.rounds')}>
                  <Segmented
                    value={String(draft.wakeUpTask.rounds)}
                    onChange={(v) => patch({ wakeUpTask: { ...draft.wakeUpTask, rounds: Number(v) } })}
                    options={[1, 2, 3, 5].map((n) => ({ value: String(n), label: String(n) }))}
                  />
                </Field>
              </>
            )}

            {draft.wakeUpTask.type === 'qr' && (
              <Field label={t('editor.wakeTask.qr')} hint={t('editor.wakeTask.qrPayloadHint')}>
                <input
                  type="text"
                  value={draft.wakeUpTask.qrPayload ?? ''}
                  placeholder="SMART-ALARM-BATHROOM"
                  onChange={(e) =>
                    patch({ wakeUpTask: { ...draft.wakeUpTask, qrPayload: e.target.value } })
                  }
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3"
                />
              </Field>
            )}

            <RowToggle
              label={t('editor.strongAlert')}
              hint={t('editor.strongAlertHint')}
              checked={draft.strongAlert.enabled}
              onChange={(v) => patch({ strongAlert: { ...draft.strongAlert, enabled: v } })}
            />
            {draft.strongAlert.enabled && (
              <Field label={t('editor.strongAlertMax')}>
                <Segmented
                  value={String(draft.strongAlert.maxDurationMinutes)}
                  onChange={(v) =>
                    patch({ strongAlert: { ...draft.strongAlert, maxDurationMinutes: Number(v) } })
                  }
                  options={[5, 10, 15, 30]
                    .filter((n) => n <= MAX_ALERT_DURATION_MINUTES)
                    .map((n) => ({ value: String(n), label: t('editor.minutes', { n }) }))}
                />
              </Field>
            )}
          </div>
        </Section>

        {/* -------------------------------------------------- Advanced */}
        <Section title={t('editor.section.advanced')}>
          <div className="space-y-4">
            <RowToggle
              label={t('editor.preAlarm')}
              hint={t('editor.preAlarmHint')}
              checked={draft.preAlarm.enabled}
              onChange={(v) => patch({ preAlarm: { ...draft.preAlarm, enabled: v } })}
            />
            {draft.preAlarm.enabled && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <Field label={t('editor.preAlarmMinutes')}>
                  <Segmented
                    value={String(draft.preAlarm.minutesBefore)}
                    onChange={(v) =>
                      patch({ preAlarm: { ...draft.preAlarm, minutesBefore: Number(v) } })
                    }
                    options={[2, 5, 10, 15].map((n) => ({
                      value: String(n),
                      label: t('editor.minutes', { n }),
                    }))}
                  />
                </Field>
                <Slider
                  label={t('editor.volume')}
                  value={Math.round(draft.preAlarm.volume * 100)}
                  onChange={(v) => patch({ preAlarm: { ...draft.preAlarm, volume: v / 100 } })}
                  format={(v) => `${v}%`}
                />
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">{t('editor.sound')}</summary>
                  <div className="mt-3">
                    <SoundPicker
                      value={draft.preAlarm.soundId}
                      volume={draft.preAlarm.volume}
                      onChange={(soundId) => patch({ preAlarm: { ...draft.preAlarm, soundId } })}
                    />
                  </div>
                </details>
              </div>
            )}

            <RowToggle
              label={t('editor.afterStop')}
              hint={t('editor.afterStopHint')}
              checked={draft.afterStop.enabled}
              onChange={(v) => patch({ afterStop: { ...draft.afterStop, enabled: v } })}
            />
            {draft.afterStop.enabled && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <Field label={t('editor.afterStop.behavior')}>
                  <Segmented
                    value={draft.afterStop.behavior}
                    onChange={(v) => patch({ afterStop: { ...draft.afterStop, behavior: v } })}
                    options={[
                      { value: 'stoppable', label: t('editor.afterStop.stoppable') },
                      { value: 'must-finish', label: t('editor.afterStop.mustFinish') },
                    ]}
                  />
                </Field>
                <Slider
                  label={t('editor.volume')}
                  value={Math.round(draft.afterStop.volume * 100)}
                  onChange={(v) => patch({ afterStop: { ...draft.afterStop, volume: v / 100 } })}
                  format={(v) => `${v}%`}
                />
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">{t('editor.sound')}</summary>
                  <div className="mt-3">
                    <SoundPicker
                      value={draft.afterStop.soundId}
                      volume={draft.afterStop.volume}
                      onChange={(soundId) => patch({ afterStop: { ...draft.afterStop, soundId } })}
                    />
                  </div>
                </details>
              </div>
            )}

            <Field label={t('editor.importance')}>
              <Segmented
                value={draft.importance}
                onChange={(v) => patch({ importance: v })}
                options={[
                  { value: 'normal', label: t('editor.importance.normal') },
                  { value: 'important', label: t('editor.importance.important') },
                ]}
              />
            </Field>
            <RowToggle
              label={t('editor.dndOverride')}
              checked={draft.dndOverride}
              onChange={(v) => patch({ dndOverride: v })}
            />
          </div>
        </Section>
      </div>
    </Sheet>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{title}</summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
