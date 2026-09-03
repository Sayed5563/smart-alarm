import { useState } from 'react';
import type { Alarm, FadeInDuration, SoundRef } from '@/types';
import { useStore } from '@/store/useStore';
import { useT, type TranslationKey } from '@/i18n';
import { CATEGORIES } from '@/data/categories';
import { getBuiltinSound } from '@/data/sounds';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { clamp } from '@/utils/time';
import { vibrationService } from '@/services';
import {
  Sheet,
  Button,
  Segmented,
  Slider,
  RowToggle,
  Field,
  Collapsible,
  PickerRow,
  cx,
} from './ui';
import { RepeatPicker } from './alarmBits';
import { SoundPicker } from './SoundPicker';
import { TimePicker } from './TimePicker';

const FADE_OPTIONS: FadeInDuration[] = [0, 10, 30, 60, 300];

type SoundTarget = 'main' | 'pre' | 'after';

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
  const beginRing = useStore((s) => s.beginRing);
  const hour24 = useStore((s) => s.settings.hour24);
  const customSounds = useStore((s) => s.customSounds);
  const [draft, setDraft] = useState<Alarm>(alarm);
  const [picking, setPicking] = useState<SoundTarget | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const patch = (p: Partial<Alarm>) => setDraft((d) => ({ ...d, ...p }));

  const soundName = (id: SoundRef) =>
    id.startsWith('custom:')
      ? (customSounds.find((c) => `custom:${c.id}` === id)?.name ?? t('sounds.custom'))
      : (getBuiltinSound(id)?.name ?? id);

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

  const remove = () => {
    deleteAlarm(draft.id);
    onClose();
  };

  // ---- sound sub-screen -----------------------------------------------------
  if (picking) {
    const current =
      picking === 'main'
        ? draft.soundId
        : picking === 'pre'
          ? draft.preAlarm.soundId
          : draft.afterStop.soundId;
    const vol =
      picking === 'main'
        ? draft.volume
        : picking === 'pre'
          ? draft.preAlarm.volume
          : draft.afterStop.volume;
    const setSound = (soundId: SoundRef) => {
      if (picking === 'main') patch({ soundId });
      else if (picking === 'pre') patch({ preAlarm: { ...draft.preAlarm, soundId } });
      else patch({ afterStop: { ...draft.afterStop, soundId } });
    };
    return (
      <Sheet
        open
        onClose={() => setPicking(null)}
        title={t('sounds.title')}
        footer={
          <Button variant="primary" full onClick={() => setPicking(null)} data-autofocus>
            {t('common.done')}
          </Button>
        }
      >
        <SoundPicker value={current} volume={vol} onChange={setSound} />
      </Sheet>
    );
  }

  const snoozeOptions = [...new Set([5, 10, 15, 20, draft.snoozeMinutes])].sort((a, b) => a - b);
  const vibrationBad = !vibrationService.isSupported();

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
          <Button variant="primary" full onClick={save}>
            {t('editor.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <TimePicker
          hour={draft.hour}
          minute={draft.minute}
          hour24={hour24}
          onChange={(h, m) => patch({ hour: h, minute: m })}
        />

        <Field label={t('editor.section.repeat')}>
          <RepeatPicker
            repeat={draft.repeat}
            customDays={draft.customDays}
            onChange={(repeat, customDays) => patch({ repeat, customDays })}
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
            className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 outline-none focus:border-accent"
          />
        </Field>

        <Field label={t('editor.category')}>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={draft.category === c.key}
                onClick={() => patch({ category: c.key })}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-medium transition',
                  draft.category === c.key
                    ? 'bg-accent text-accent-contrast'
                    : 'bg-surface-2 text-muted hover:text-fg',
                )}
              >
                <span aria-hidden="true">{c.icon}</span>
                {t(c.labelKey as TranslationKey)}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-4">
          <PickerRow
            label={t('editor.sound')}
            value={soundName(draft.soundId)}
            onClick={() => setPicking('main')}
          />
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
        </div>

        <RowToggle
          label={t('editor.enabled')}
          checked={draft.enabled}
          onChange={(v) => patch({ enabled: v })}
        />

        <Collapsible label={t('editor.more')} open={moreOpen} onOpenChange={setMoreOpen}>
          <div className="space-y-5">
            {/* snooze */}
            <Field label={t('editor.snooze')}>
              <Segmented
                value={String(draft.snoozeMinutes)}
                onChange={(v) => patch({ snoozeMinutes: Number(v) })}
                options={snoozeOptions.map((n) => ({ value: String(n), label: `${n}m` }))}
              />
            </Field>

            {/* vibration */}
            <Field
              label={t('editor.vibration')}
              hint={vibrationBad ? t('editor.vibrationUnsupported') : undefined}
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

            {/* wake-up task */}
            <Field label={t('editor.wakeTask')} hint={t('editor.wakeTaskHint')}>
              <select
                value={draft.wakeUpTask.type}
                onChange={(e) =>
                  patch({
                    wakeUpTask: {
                      ...draft.wakeUpTask,
                      type: e.target.value as Alarm['wakeUpTask']['type'],
                    },
                  })
                }
                className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 outline-none focus:border-accent"
              >
                <option value="none">{t('editor.wakeTask.none')}</option>
                <option value="math">{t('editor.wakeTask.math')}</option>
                <option value="code">{t('editor.wakeTask.code')}</option>
                <option value="sequence">{t('editor.wakeTask.sequence')}</option>
                <option value="qr">{t('editor.wakeTask.qr')}</option>
              </select>
            </Field>
            {draft.wakeUpTask.type !== 'none' && draft.wakeUpTask.type !== 'qr' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>
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
                  className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 outline-none focus:border-accent"
                />
              </Field>
            )}

            {/* strong alert */}
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

            {/* pre-alarm */}
            <RowToggle
              label={t('editor.preAlarm')}
              hint={t('editor.preAlarmHint')}
              checked={draft.preAlarm.enabled}
              onChange={(v) => patch({ preAlarm: { ...draft.preAlarm, enabled: v } })}
            />
            {draft.preAlarm.enabled && (
              <div className="space-y-3 rounded-xl border border-hairline p-3">
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
                <PickerRow
                  label={t('editor.sound')}
                  value={soundName(draft.preAlarm.soundId)}
                  onClick={() => setPicking('pre')}
                />
              </div>
            )}

            {/* after-stop */}
            <RowToggle
              label={t('editor.afterStop')}
              hint={t('editor.afterStopHint')}
              checked={draft.afterStop.enabled}
              onChange={(v) => patch({ afterStop: { ...draft.afterStop, enabled: v } })}
            />
            {draft.afterStop.enabled && (
              <div className="space-y-3 rounded-xl border border-hairline p-3">
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
                <PickerRow
                  label={t('editor.sound')}
                  value={soundName(draft.afterStop.soundId)}
                  onClick={() => setPicking('after')}
                />
              </div>
            )}

            {/* importance / DND */}
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
        </Collapsible>

        <div className="flex flex-col items-center gap-1 pt-1">
          <Button variant="secondary" size="sm" onClick={() => beginRing({ ...draft }, 'test')}>
            {t('editor.test')}
          </Button>
          {!isNew && (
            <button
              type="button"
              onClick={remove}
              className="px-3 py-2 text-sm font-medium text-danger hover:underline"
            >
              {t('editor.deleteAlarm')}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
