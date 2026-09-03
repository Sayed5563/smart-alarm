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

  const dim = !alarm.enabled || dormant;

  return (
    <div className={cx('glass rounded-card p-4 transition', dim && 'opacity-55')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-3xl font-light leading-none">
              {formatAlarmTime(alarm.hour, alarm.minute, hour24).split(' ')[0]}
            </span>
            {!hour24 && (
              <span className="text-sm text-muted">
                {formatAlarmTime(alarm.hour, alarm.minute, hour24).split(' ')[1]}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm">
            <span aria-hidden="true">{categoryIcon(alarm.category)}</span>
            <span className="truncate font-medium">
              {alarm.label || t(`category.${alarm.category}` as 'category.other')}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted">{repeatSummary(alarm)}</div>
          {(alarm.wakeUpTask.type !== 'none' ||
            alarm.strongAlert.enabled ||
            alarm.preAlarm.enabled ||
            alarm.afterStop.enabled) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alarm.preAlarm.enabled && <Tag>{t('editor.preAlarm')}</Tag>}
              {alarm.wakeUpTask.type !== 'none' && (
                <Tag>{t(`editor.wakeTask.${alarm.wakeUpTask.type}` as 'editor.wakeTask.math')}</Tag>
              )}
              {alarm.strongAlert.enabled && <Tag>{t('editor.strongAlert')}</Tag>}
              {alarm.afterStop.enabled && <Tag>{t('editor.afterStop')}</Tag>}
            </div>
          )}
          {dormant && (
            <div className="mt-2 text-xs font-medium text-muted">{t('alarms.dormant')}</div>
          )}
        </div>

        <Toggle
          checked={alarm.enabled}
          onChange={(v) => toggleAlarm(alarm.id, v)}
          label={`${alarm.label || t('nav.alarms')} ${alarm.enabled ? t('alarms.on') : t('alarms.off')}`}
        />
      </div>

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <button
          onClick={onEdit}
          className="h-10 flex-1 rounded-xl text-sm font-medium text-fg hover:bg-surface-2"
        >
          {t('alarms.edit')}
        </button>
        <button
          onClick={onDelete}
          className="h-10 flex-1 rounded-xl text-sm font-medium text-danger hover:bg-surface-2"
        >
          {t('alarms.delete')}
        </button>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
      {children}
    </span>
  );
}
