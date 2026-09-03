import type { ReactNode } from 'react';
import type { Alarm } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { formatAlarmTime } from '@/utils/time';
import { categoryIcon } from '@/data/categories';
import { Toggle, cx } from './ui';
import { useRepeatSummary } from './alarmBits';

export function AlarmCard({
  alarm,
  onEdit,
  onDelete,
  dormant,
}: {
  alarm: Alarm;
  onEdit: () => void;
  onDelete: () => void;
  dormant?: boolean;
}) {
  const t = useT();
  const hour24 = useStore((s) => s.settings.hour24);
  const toggleAlarm = useStore((s) => s.toggleAlarm);
  const repeatSummary = useRepeatSummary();

  const [time, meridiem] = formatAlarmTime(alarm.hour, alarm.minute, hour24).split(' ');
  const armed = alarm.enabled && !dormant;
  const dim = !alarm.enabled || dormant;
  const features = [
    alarm.preAlarm.enabled && t('editor.preAlarm'),
    alarm.wakeUpTask.type !== 'none' &&
      t(`editor.wakeTask.${alarm.wakeUpTask.type}` as 'editor.wakeTask.math'),
    alarm.strongAlert.enabled && t('editor.strongAlert'),
    alarm.afterStop.enabled && t('editor.afterStop'),
  ].filter(Boolean) as string[];

  const name = alarm.label || t(`category.${alarm.category}` as 'category.other');

  return (
    <div className="glass overflow-hidden rounded-card">
      <div className="flex items-center gap-3 p-4">
        <span
          aria-hidden="true"
          className={cx(
            'h-12 w-1 shrink-0 rounded-full transition-colors',
            armed ? 'bg-accent' : 'bg-transparent',
          )}
        />

        {/* one real button = the whole info area opens the editor */}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${t('alarms.edit')} — ${name}, ${time} ${meridiem}`.trim()}
          className={cx(
            'row-tap -m-2 min-w-0 flex-1 rounded-xl p-2 text-left transition',
            dim && 'opacity-45',
          )}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="tnum text-[2.1rem] font-light leading-none tracking-tight">{time}</span>
            {meridiem && <span className="text-xs font-semibold text-muted">{meridiem}</span>}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[13px]">
            <span aria-hidden="true">{categoryIcon(alarm.category)}</span>
            <span className="truncate font-medium">{name}</span>
            <span className="text-muted">·</span>
            <span className="shrink-0 text-muted">{repeatSummary(alarm)}</span>
          </div>
          {(features.length > 0 || dormant) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {dormant && <Tag muted>{t('alarms.dormant')}</Tag>}
              {features.map((f) => (
                <Tag key={f}>{f}</Tag>
              ))}
            </div>
          )}
        </button>

        <Toggle
          checked={alarm.enabled}
          onChange={(v) => toggleAlarm(alarm.id, v)}
          label={`${name} — ${alarm.enabled ? t('alarms.on') : t('alarms.off')}`}
        />
      </div>

      <div className="flex border-t border-hairline text-sm font-medium">
        <button onClick={onEdit} className="flex-1 py-2.5 text-fg transition hover:bg-surface-2">
          {t('alarms.edit')}
        </button>
        <span className="w-px bg-hairline" aria-hidden="true" />
        <button onClick={onDelete} className="flex-1 py-2.5 text-danger transition hover:bg-surface-2">
          {t('alarms.delete')}
        </button>
      </div>
    </div>
  );
}

function Tag({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cx(
        'rounded-pill px-2 py-0.5 text-[11px] font-medium',
        muted ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent',
      )}
    >
      {children}
    </span>
  );
}
