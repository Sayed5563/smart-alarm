import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import {
  Button,
  Card,
  Segmented,
  Slider,
  RowToggle,
  Field,
  ConfirmDialog,
  Sheet,
  cx,
} from '@/components/ui';
import { WallpaperPicker } from '@/components/WallpaperPicker';
import { SoundPicker } from '@/components/SoundPicker';
import { ProfilesPanel } from '@/components/ProfilesPanel';
import {
  audioService,
  notificationService,
  vibrationService,
  storageService,
  updateService,
  isNativeApp,
  AlarmClock,
} from '@/services';
import { isPlausibleExportBundle } from '@/utils/validation';
import { pad2 } from '@/utils/time';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { APP_VERSION } from '@/version';

export function Settings() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateDefaults = useStore((s) => s.updateDefaults);
  const updateDnd = useStore((s) => s.updateDnd);
  const exportBundle = useStore((s) => s.exportBundle);
  const importBundle = useStore((s) => s.importBundle);
  const resetAll = useStore((s) => s.resetAll);
  const clearHistory = useStore((s) => s.clearHistory);
  const toast = useStore((s) => s.toast);

  const [confirmReset, setConfirmReset] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState(notificationService.permission());
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storageService.estimate().then(setStorageInfo);
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  const requestNotif = async () => {
    const p = await notificationService.requestPermission();
    setNotifPerm(p);
    updateSettings({ notificationsEnabled: p === 'granted' });
  };

  const doExport = () => {
    const bundle = exportBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-alarm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isPlausibleExportBundle(parsed)) {
        toast(t('settings.importInvalid'));
        return;
      }
      importBundle(parsed);
      toast(t('settings.importDone'));
    } catch {
      toast(t('settings.importInvalid'));
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <h1 className="text-[1.7rem] font-semibold tracking-tight">{t('settings.title')}</h1>

      {/* -------------------------------------------------- Appearance */}
      <SettingsSection title={t('settings.section.appearance')}>
        <Field label={t('settings.theme')}>
          <Segmented
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'light', label: t('settings.theme.light') },
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'system', label: t('settings.theme.system') },
            ]}
          />
        </Field>
        <Field label={t('settings.accent')}>
          <div className="flex gap-2.5" role="radiogroup" aria-label={t('settings.accent')}>
            {(
              [
                ['amber', '#ff9a5e'],
                ['blue', '#5c9bff'],
                ['purple', '#a98bff'],
                ['green', '#45c98a'],
              ] as const
            ).map(([key, dot]) => (
              <button
                key={key}
                role="radio"
                aria-checked={settings.accent === key}
                aria-label={t(`settings.accent.${key}` as 'settings.accent.amber')}
                onClick={() => updateSettings({ accent: key })}
                className={cx(
                  'grid h-11 w-11 place-items-center rounded-full transition',
                  settings.accent === key
                    ? 'ring-2 ring-offset-2 ring-offset-transparent'
                    : 'opacity-70 hover:opacity-100',
                )}
                style={
                  settings.accent === key
                    ? ({ '--tw-ring-color': dot } as CSSProperties)
                    : undefined
                }
              >
                <span className="h-6 w-6 rounded-full" style={{ background: dot }} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('settings.clockType')}>
          <Segmented
            value={settings.clockType}
            onChange={(v) => updateSettings({ clockType: v })}
            options={[
              { value: 'digital', label: t('settings.clockType.digital') },
              { value: 'analog', label: t('settings.clockType.analog') },
            ]}
          />
        </Field>
        <Field label={t('settings.clockFont')}>
          <Segmented
            value={settings.clockFont}
            onChange={(v) => updateSettings({ clockFont: v })}
            options={[
              { value: 'classic', label: t('settings.clockFont.classic') },
              { value: 'digital', label: t('settings.clockFont.digital') },
              { value: 'minimal', label: t('settings.clockFont.minimal') },
            ]}
          />
        </Field>
        <RowToggle
          label={t('settings.hour24')}
          checked={settings.hour24}
          onChange={(v) => updateSettings({ hour24: v })}
        />
        <RowToggle
          label={t('settings.showSeconds')}
          checked={settings.showSeconds}
          onChange={(v) => updateSettings({ showSeconds: v })}
        />
        <RowToggle
          label={t('settings.reducedMotion')}
          checked={settings.reducedMotion}
          onChange={(v) => updateSettings({ reducedMotion: v })}
        />
        <div className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setWallpaperOpen(true)}>
            {t('settings.wallpaper')}
          </Button>
        </div>
      </SettingsSection>

      {/* -------------------------------------------------- Alarm defaults */}
      <SettingsSection title={t('settings.section.alarm')}>
        <Field label={t('settings.defaultSnooze')}>
          <Segmented
            value={String(settings.defaults.snoozeMinutes)}
            onChange={(v) => updateDefaults({ snoozeMinutes: Number(v) })}
            options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: `${n}m` }))}
          />
        </Field>
        <Slider
          label={t('settings.defaultVolume')}
          value={Math.round(settings.defaults.volume * 100)}
          onChange={(v) => updateDefaults({ volume: v / 100 })}
          format={(v) => `${v}%`}
        />
        <Field label={t('settings.defaultFade')}>
          <Segmented
            value={String(settings.defaults.fadeInSeconds)}
            onChange={(v) => updateDefaults({ fadeInSeconds: Number(v) as 0 | 10 | 30 | 60 | 300 })}
            options={[0, 10, 30, 60, 300].map((f) => ({
              value: String(f),
              label: f === 0 ? t('common.off') : f < 60 ? `${f}s` : `${f / 60}m`,
            }))}
          />
        </Field>
        <div className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setSoundOpen(true)}>
            {t('settings.defaultSound')}
          </Button>
        </div>
        <Field
          label={t('settings.defaultVibration')}
          hint={vibrationService.isSupported() ? undefined : t('editor.vibrationUnsupported')}
        >
          <Segmented
            value={settings.defaults.vibration}
            onChange={(v) => updateDefaults({ vibration: v })}
            options={[
              { value: 'off', label: t('common.off') },
              { value: 'short', label: t('difficulty.easy') },
              { value: 'medium', label: t('difficulty.medium') },
              { value: 'strong', label: t('difficulty.hard') },
            ]}
          />
        </Field>
      </SettingsSection>

      {/* -------------------------------------------------- Wake-up */}
      <SettingsSection title={t('settings.section.wake')}>
        <Field label={t('settings.defaultTask')}>
          <Segmented
            value={settings.defaults.wakeUpTask}
            onChange={(v) => updateDefaults({ wakeUpTask: v })}
            options={[
              { value: 'none', label: t('editor.wakeTask.none') },
              { value: 'math', label: t('editor.wakeTask.math') },
              { value: 'code', label: t('editor.wakeTask.code') },
              { value: 'sequence', label: t('editor.wakeTask.sequence') },
            ]}
          />
        </Field>
        <RowToggle
          label={t('settings.defaultStrong')}
          hint={t('editor.minutes', { n: MAX_ALERT_DURATION_MINUTES }) + ' max'}
          checked={settings.defaults.strongAlert}
          onChange={(v) => updateDefaults({ strongAlert: v })}
        />
      </SettingsSection>

      {/* -------------------------------------------------- Notifications */}
      <SettingsSection title={t('settings.section.notifications')}>
        <p className="text-sm text-muted">{t('settings.notificationsBody')}</p>
        <div className="mt-3">
          {notifPerm === 'unsupported' && (
            <p className="text-sm text-muted">{t('settings.notificationsUnsupported')}</p>
          )}
          {notifPerm === 'denied' && (
            <p className="text-sm text-danger">{t('settings.notificationsDenied')}</p>
          )}
          {notifPerm === 'granted' && (
            <RowToggle
              label={t('settings.notifications')}
              checked={settings.notificationsEnabled}
              onChange={(v) => updateSettings({ notificationsEnabled: v })}
            />
          )}
          {notifPerm === 'default' && (
            <Button variant="secondary" size="sm" onClick={requestNotif}>
              {t('settings.notificationsRequest')}
            </Button>
          )}
        </div>
        {isNativeApp && <ExactAlarmRow />}
      </SettingsSection>

      {/* -------------------------------------------------- Quiet hours */}
      <SettingsSection title={t('settings.section.quiet')}>
        <p className="mb-3 text-sm text-muted">{t('settings.dndBody')}</p>
        <RowToggle
          label={t('settings.dnd')}
          checked={settings.dnd.enabled}
          onChange={(v) => updateDnd({ enabled: v })}
        />
        {settings.dnd.enabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('settings.dndStart')} htmlFor="dnd-start">
                <input
                  id="dnd-start"
                  type="time"
                  value={`${pad2(settings.dnd.startHour)}:${pad2(settings.dnd.startMinute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    updateDnd({ startHour: h, startMinute: m });
                  }}
                  className="tnum w-full rounded-xl border border-border bg-surface-2 px-3 py-2"
                />
              </Field>
              <Field label={t('settings.dndEnd')} htmlFor="dnd-end">
                <input
                  id="dnd-end"
                  type="time"
                  value={`${pad2(settings.dnd.endHour)}:${pad2(settings.dnd.endMinute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    updateDnd({ endHour: h, endMinute: m });
                  }}
                  className="tnum w-full rounded-xl border border-border bg-surface-2 px-3 py-2"
                />
              </Field>
            </div>
            <Field label={t('settings.dndBehavior')}>
              <Segmented
                value={settings.dnd.behavior}
                onChange={(v) => updateDnd({ behavior: v })}
                options={[
                  { value: 'mute', label: t('settings.dndBehavior.mute') },
                  { value: 'allow-important', label: t('settings.dndBehavior.allow-important') },
                ]}
              />
            </Field>
          </div>
        )}
      </SettingsSection>

      {/* -------------------------------------------------- Profiles */}
      <SettingsSection title={t('settings.section.profiles')}>
        <ProfilesPanel />
      </SettingsSection>

      {/* -------------------------------------------------- Data */}
      <SettingsSection title={t('settings.section.data')}>
        <div className="space-y-3">
          <div>
            <Button variant="secondary" size="sm" onClick={doExport}>
              {t('settings.export')}
            </Button>
            <p className="mt-1 text-xs text-muted">{t('settings.exportBody')}</p>
          </div>
          <div>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                void doImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => importRef.current?.click()}>
              {t('settings.import')}
            </Button>
            <p className="mt-1 text-xs text-muted">{t('settings.importBody')}</p>
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              {t('settings.clearHistory')}
            </Button>
          </div>
          <div className="rounded-xl border border-danger/30 p-3">
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              {t('settings.reset')}
            </Button>
            <p className="mt-1.5 text-xs text-muted">{t('settings.resetBody')}</p>
          </div>

          {storageInfo && storageInfo.quota > 0 && (
            <div className="pt-2 text-xs text-muted">
              {t('settings.storageUsed', {
                used: fmtBytes(storageInfo.usage),
                quota: fmtBytes(storageInfo.quota),
              })}
              {!persisted && (
                <button
                  className="ml-2 text-accent underline"
                  onClick={() => storageService.requestPersistent().then(setPersisted)}
                >
                  {t('settings.storagePersist')}
                </button>
              )}
              {persisted && <span className="ml-2 text-success">{t('settings.storagePersisted')}</span>}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* -------------------------------------------------- About */}
      <SettingsSection title={t('settings.section.about')}>
        <p className="text-sm">{t('about.tagline')}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{t('about.version', { v: APP_VERSION })}</p>
          <UpdateButton />
        </div>
        <About />
      </SettingsSection>

      <Sheet open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} title={t('wallpaper.title')}>
        <WallpaperPicker />
      </Sheet>
      <Sheet open={soundOpen} onClose={() => setSoundOpen(false)} title={t('sounds.title')}>
        <SoundPicker
          value={settings.defaults.soundId}
          volume={settings.defaults.volume}
          onChange={(soundId) => updateDefaults({ soundId })}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmReset}
        title={t('settings.resetConfirmTitle')}
        body={t('settings.resetConfirmBody')}
        confirmLabel={t('settings.resetConfirm')}
        cancelLabel={t('common.cancel')}
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void resetAll();
          setConfirmReset(false);
          toast(t('settings.reset'));
        }}
      />
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-[13px] font-medium text-muted">{title}</h2>
      <Card className="divide-y divide-hairline !py-1">{children}</Card>
    </section>
  );
}

function ExactAlarmRow() {
  const t = useT();
  const [granted, setGranted] = useState<boolean | null>(null);

  const check = () =>
    AlarmClock.canScheduleExactAlarms()
      .then((r) => setGranted(r.granted))
      .catch(() => setGranted(null));

  useEffect(() => {
    void check();
    const onVis = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (granted === null) return null;

  return (
    <div className="py-3">
      <div className="text-sm font-medium">{t('settings.exactAlarms')}</div>
      {granted ? (
        <p className="mt-1 text-xs text-success">{t('settings.exactAlarmsOk')}</p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t('settings.exactAlarmsBody')}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => void AlarmClock.openExactAlarmSettings()}
          >
            {t('settings.exactAlarmsGrant')}
          </Button>
        </>
      )}
    </div>
  );
}

function UpdateButton() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [checking, setChecking] = useState(false);

  const run = async () => {
    setChecking(true);
    const result = await updateService.check();
    setChecking(false);
    const messages: Record<typeof result, string> = {
      updating: t('about.updateFound'),
      current: t('about.updateCurrent'),
      offline: t('about.updateOffline'),
      unsupported: t('about.updateUnsupported'),
    };
    toast(messages[result]);
  };

  return (
    <Button variant="secondary" size="sm" onClick={run} disabled={checking}>
      {checking ? t('about.checkingUpdates') : t('about.checkUpdates')}
    </Button>
  );
}

function About() {
  const t = useT();
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs leading-relaxed text-muted">{t('about.autoUpdateNote')}</p>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('about.limitationsTitle')}</summary>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t('about.limitations')}</p>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t('about.privacyTitle')}</summary>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t('about.privacy')}</p>
      </details>
      <p className="text-xs text-muted">
        {audioService.isSupported()
          ? ''
          : 'Note: the Web Audio API is unavailable in this browser, so alarm sounds will not play.'}
      </p>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
