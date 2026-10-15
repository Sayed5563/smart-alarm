import type { Alarm } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { formatAlarmTime } from '@/utils/time';
import { isSpent } from '@/utils/alarmList';
import { Toggle, cx } from './ui';
import { useRepeatSummary } from './alarmBits';

/** One alarm in the list: time, label · days, feature icons, and its switch. */
export function AlarmRow({ alarm, dormant }: { alarm: Alarm; dormant?: boolean }) {
  const t = useT();
  const hour24 = useStore((s) => s.settings.hour24);
  const toggleAlarm = useStore((s) => s.toggleAlarm);
  const repeatSummary = useRepeatSummary();

  const on = alarm.enabled && !isSpent(alarm);
  const [time, meridiem] = formatAlarmTime(alarm.hour, alarm.minute, hour24).split(' ');
  const name = alarm.label || t('alarms.untitled');

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cx('min-w-0 flex-1 transition-opacity', (!on || dormant) && 'opacity-45')}>
        <div className="flex items-baseline gap-1">
          <span className="tnum text-[2.4rem] font-light leading-none tracking-tight">{time}</span>
          {meridiem && <span className="text-sm font-medium text-muted">{meridiem}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
          <span className="truncate text-fg/80">{name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{dormant ? t('alarms.dormant') : repeatSummary(alarm)}</span>
          {alarm.wakeUpTask.type !== 'none' && (
            <span
              title={t(`editor.wakeTask.${alarm.wakeUpTask.type}` as 'editor.wakeTask.math')}
              aria-hidden="true"
            >
              🧩
            </span>
          )}
          {alarm.afterStop.enabled && (
            <span title={t('editor.afterStop')} aria-hidden="true">
              🔔
            </span>
          )}
        </div>
      </div>
      <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Toggle
          checked={on}
          onChange={(v) => toggleAlarm(alarm.id, v)}
          label={`${name} ${time} — ${on ? t('alarms.on') : t('alarms.off')}`}
        />
      </div>
    </div>
  );
}
