import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { formatAlarmTime } from '@/utils/time';

export function QuickSet() {
  const t = useT();
  const quickSet = useStore((s) => s.quickSet);
  const hour24 = useStore((s) => s.settings.hour24);
  const toast = useStore((s) => s.toast);
  const deleteAlarm = useStore((s) => s.deleteAlarm);

  const add = (mins: number) => {
    const a = quickSet(mins);
    toast(t('quick.created', { time: formatAlarmTime(a.hour, a.minute, hour24) }), {
      label: t('common.undo'),
      run: () => deleteAlarm(a.id),
    });
  };

  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label={t('home.quickSet')}>
      {[5, 10, 15].map((m) => (
        <button
          key={m}
          onClick={() => add(m)}
          className="border border-hairline bg-tile flex h-[3.75rem] flex-col items-center justify-center rounded-2xl transition duration-150 hover:bg-surface-2 active:scale-[0.97]"
        >
          <span className="text-lg font-semibold">+{m}</span>
          <span className="text-[11px] text-muted">min</span>
        </button>
      ))}
    </div>
  );
}
