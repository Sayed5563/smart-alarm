import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { Button, Sheet, cx } from './ui';
import { formatAlarmTime } from '@/utils/time';
import { categoryIcon } from '@/data/categories';

export function ProfilesPanel() {
  const t = useT();
  const profiles = useStore((s) => s.profiles);
  const alarms = useStore((s) => s.alarms);
  const activeProfileId = useStore((s) => s.activeProfileId);
  const addProfile = useStore((s) => s.addProfile);
  const renameProfile = useStore((s) => s.renameProfile);
  const duplicateProfile = useStore((s) => s.duplicateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const activateProfile = useStore((s) => s.activateProfile);
  const setProfileAlarms = useStore((s) => s.setProfileAlarms);
  const hour24 = useStore((s) => s.settings.hour24);

  const [editing, setEditing] = useState<string | null>(null);
  const editProfile = profiles.find((p) => p.id === editing);

  return (
    <div className="space-y-3 py-1">
      <p className="text-sm text-muted">{t('settings.profilesBody')}</p>

      <button
        onClick={() => activateProfile(null)}
        className={cx(
          'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm',
          activeProfileId === null ? 'border-accent bg-accent-soft' : 'border-border',
        )}
      >
        <span className="font-medium">{t('settings.profileNone')}</span>
        {activeProfileId === null && (
          <span className="text-xs font-semibold text-accent">{t('settings.profileActive')}</span>
        )}
      </button>

      {profiles.map((p) => {
        const active = p.id === activeProfileId;
        return (
          <div
            key={p.id}
            className={cx(
              'rounded-xl border p-3',
              active ? 'border-accent bg-accent-soft' : 'border-border',
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted">
                  {p.activeAlarmIds.filter((id) => alarms.some((a) => a.id === id)).length} /{' '}
                  {alarms.length} {t('nav.alarms').toLowerCase()}
                </div>
              </div>
              {active ? (
                <span className="text-xs font-semibold text-accent">
                  {t('settings.profileActive')}
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => activateProfile(p.id)}>
                  {t('settings.profileActivate')}
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2 text-xs">
              <button className="text-accent" onClick={() => setEditing(p.id)}>
                {t('settings.profileEdit')}
              </button>
              <span className="text-muted">·</span>
              <button
                className="text-muted hover:text-fg"
                onClick={() => {
                  const name = window.prompt(t('settings.profileNamePrompt'), p.name);
                  if (name != null) renameProfile(p.id, name);
                }}
              >
                {t('settings.profileRename')}
              </button>
              <span className="text-muted">·</span>
              <button className="text-muted hover:text-fg" onClick={() => duplicateProfile(p.id)}>
                {t('settings.profileDuplicate')}
              </button>
              <span className="text-muted">·</span>
              <button className="text-danger" onClick={() => deleteProfile(p.id)}>
                {t('settings.profileDelete')}
              </button>
            </div>
          </div>
        );
      })}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const name = window.prompt(t('settings.profileNamePrompt'), '');
          if (name) addProfile(name);
        }}
      >
        + {t('settings.profileNew')}
      </Button>

      <Sheet
        open={editProfile != null}
        onClose={() => setEditing(null)}
        title={editProfile?.name ?? ''}
      >
        {editProfile && (
          <div className="space-y-2">
            <p className="text-sm text-muted">{t('settings.profileEdit')}</p>
            {alarms.length === 0 && <p className="text-sm text-muted">{t('alarms.empty')}</p>}
            {alarms.map((a) => {
              const on = editProfile.activeAlarmIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setProfileAlarms(
                        editProfile.id,
                        e.target.checked
                          ? [...editProfile.activeAlarmIds, a.id]
                          : editProfile.activeAlarmIds.filter((x) => x !== a.id),
                      )
                    }
                    className="h-5 w-5 accent-accent"
                  />
                  <span className="tnum text-sm font-medium">
                    {formatAlarmTime(a.hour, a.minute, hour24)}
                  </span>
                  <span className="text-sm text-muted">
                    {categoryIcon(a.category)}{' '}
                    {a.label || t(`category.${a.category}` as 'category.other')}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}
