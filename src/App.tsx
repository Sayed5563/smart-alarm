import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { I18nContext, LANGUAGES, translate, type I18n } from '@/i18n';
import { useHashRoute } from '@/hooks/useHashRoute';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import {
  alarmScheduler,
  themeService,
  notificationService,
  storageService,
  type DueEvent,
} from '@/services';
import { upcomingEvents } from '@/utils/schedule';
import { resolveWallpaper } from '@/data/wallpapers';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { categoryIcon } from '@/data/categories';
import { Navigation } from '@/components/Navigation';
import { AlarmRinging } from '@/components/AlarmRinging';
import { Home } from '@/pages/Home';
import { Alarms } from '@/pages/Alarms';
import { History } from '@/pages/History';
import { Settings } from '@/pages/Settings';
import { makeAlarm } from '@/data/defaults';

export default function App() {
  const settings = useStore((s) => s.settings);
  const alarms = useStore((s) => s.alarms);
  const ringing = useStore((s) => s.ringing);
  const lastToast = useStore((s) => s.lastToast);
  const beginRing = useStore((s) => s.beginRing);
  const [route, navigate] = useHashRoute();

  const lang = LANGUAGES[settings.language] ?? LANGUAGES.en;
  const i18n = useMemo<I18n>(
    () => ({ lang, t: (key, vars) => translate(lang.dict, key, vars) }),
    [lang],
  );

  /* ---------------------------------------------------------------- theme */
  useEffect(() => {
    themeService.apply(settings.theme, settings.accent, settings.reducedMotion);
    return themeService.watchSystem(() =>
      themeService.apply(settings.theme, settings.accent, settings.reducedMotion),
    );
  }, [settings.theme, settings.accent, settings.reducedMotion]);

  /* -------------------------------------------------------------- language / dir */
  useEffect(() => {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir;
  }, [lang]);

  /* -------------------------------------------------------------- wallpaper */
  const customWallpaper = useStore((s) => s.customWallpapers[0]);
  const customUrl = useObjectUrl(
    () =>
      settings.wallpaperId === 'custom' && customWallpaper
        ? storageService.getWallpaper(customWallpaper.id)
        : undefined,
    [settings.wallpaperId, customWallpaper?.id],
  );

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.wallpaperId === 'custom' && customUrl) {
      root.style.setProperty('--wallpaper', `url("${customUrl}")`);
      root.style.setProperty('--scrim', 'rgba(4,6,12,0.4)');
      root.dataset.wallpaperScrim = 'dark';
      return;
    }
    const wp = resolveWallpaper(settings.wallpaperId, resolvedDark);
    root.style.setProperty('--wallpaper', wp.css);
    root.style.setProperty('--scrim', wp.scrim === 'dark' ? 'rgba(4,6,12,0.18)' : 'transparent');
    root.dataset.wallpaperScrim = wp.scrim;
  }, [settings.wallpaperId, customUrl, resolvedDark]);

  /* -------------------------------------------------------------- scheduler */
  const queueRef = useRef<DueEvent[]>([]);

  useEffect(() => {
    const onDue = (e: DueEvent) => {
      const s = useStore.getState();
      const alarm = s.alarms.find((a) => a.id === e.alarmId);
      if (!alarm) return;
      if (s.ringing) {
        queueRef.current.push(e);
        return;
      }
      beginRing(alarm, e.kind === 'pre-alarm' ? 'pre-alarm' : 'alarm');
    };

    alarmScheduler.configure(() => {
      const s = useStore.getState();
      return { alarms: s.alarms, settings: s.settings, activeAlarmIds: s.activeAlarmIds() };
    }, onDue);
    alarmScheduler.start();

    const unsub = useStore.subscribe(() => alarmScheduler.sync());
    return () => {
      unsub();
      alarmScheduler.stop();
    };
  }, [beginRing]);

  /* Drain the queue when the current alarm finishes. */
  useEffect(() => {
    if (ringing) return;
    const next = queueRef.current.shift();
    if (!next) return;
    const alarm = useStore.getState().alarms.find((a) => a.id === next.alarmId);
    if (alarm) beginRing(alarm, next.kind === 'pre-alarm' ? 'pre-alarm' : 'alarm');
  }, [ringing, beginRing]);

  /* ------------------------------------------------------ upcoming-alarm notification */
  useEffect(() => {
    if (!settings.notificationsEnabled || notificationService.permission() !== 'granted') return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      const events = upcomingEvents(
        alarms,
        settings,
        useStore.getState().activeAlarmIds(),
        now,
        6 * 3600_000,
      ).filter((e) => e.kind === 'alarm');
      if (events.length === 0) return;
      const next = events[0];
      const lead = next.at - 10 * 60_000;
      const fireAt = Math.max(lead, now + 1000);
      if (fireAt - now > 2_147_000_000) return;
      timer = window.setTimeout(() => {
        const alarm = alarms.find((a) => a.id === next.alarmId);
        if (alarm) {
          void notificationService.notify(
            i18n.t('home.nextAlarm'),
            {
              body: `${categoryIcon(alarm.category)} ${
                alarm.label || i18n.t(`category.${alarm.category}` as 'category.other')
              }`,
              tag: `upcoming-${alarm.id}`,
            },
          );
        }
        schedule();
      }, fireAt - now);
    };
    schedule();
    const onVis = () => document.visibilityState === 'visible' && schedule();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [alarms, settings, i18n]);

  /* -------------------------------------------------------------- test alarm */
  const runTest = () => {
    if (useStore.getState().ringing) return;
    const test = makeAlarm(settings, {
      label: i18n.t('ringing.test'),
      category: 'personal',
      volume: Math.max(0.4, settings.defaults.volume),
      fadeInSeconds: 10,
      vibration: settings.defaults.vibration === 'off' ? 'medium' : settings.defaults.vibration,
      wakeUpTask: { type: 'math', difficulty: 'easy', rounds: 1 },
      afterStop: {
        enabled: true,
        soundId: 'builtin:bright-bells',
        volume: 0.5,
        behavior: 'stoppable',
      },
      strongAlert: { enabled: true, maxDurationMinutes: 5 },
    });
    beginRing(test, 'test');
  };

  return (
    <I18nContext.Provider value={i18n}>
      <div className="wallpaper-layer" />
      <div className="wallpaper-scrim" />

      <div className="mx-auto flex min-h-full max-w-md flex-col">
        <main className="flex-1 px-4 pb-4">
          {route === 'home' && <Home onAddAlarm={() => navigate('alarms')} onTest={runTest} />}
          {route === 'alarms' && <Alarms />}
          {route === 'history' && <History />}
          {route === 'settings' && <Settings />}
        </main>
        <Navigation route={route} onNavigate={navigate} />
      </div>

      {ringing && <AlarmRinging />}
      {lastToast && <Toast key={lastToast.id} message={lastToast.message} />}
    </I18nContext.Provider>
  );
}

function Toast({ message }: { message: string }) {
  const clear = useStore((s) => s.toast);
  useEffect(() => {
    const t = window.setTimeout(() => clear(''), 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!message) return null;
  return (
    <div
      role="status"
      className="toast-in glass fixed inset-x-0 bottom-24 z-40 mx-auto w-fit max-w-[90vw] rounded-pill px-4 py-2 text-sm font-medium shadow-lg"
    >
      {message}
    </div>
  );
}
