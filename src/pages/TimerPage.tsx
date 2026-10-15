import { useT } from '@/i18n';
import { Timer } from '@/components/QuickTimer';

/** Phase 1: the existing timer on its own tab. Phase 2 gives it the countdown ring. */
export function TimerPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="pt-6 text-[1.75rem] font-semibold tracking-tight">{t('timer.title')}</h1>
      <Timer />
    </div>
  );
}
