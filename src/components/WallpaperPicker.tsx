import { useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { BUILTIN_WALLPAPERS, WALLPAPER_PACKS } from '@/data/wallpapers';
import { storageService } from '@/services';
import { resizeImage } from '@/utils/image';
import { validateUpload } from '@/utils/validation';
import { newId } from '@/utils/id';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { Button, cx } from './ui';

export function WallpaperPicker() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const customWallpapers = useStore((s) => s.customWallpapers);
  const setCustomWallpaper = useStore((s) => s.setCustomWallpaper);
  const clearCustomWallpaper = useStore((s) => s.clearCustomWallpaper);
  const toast = useStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);

  const customMeta = customWallpapers[0];
  const customUrl = useObjectUrl(
    () => (customMeta ? storageService.getWallpaper(customMeta.id) : undefined),
    [customMeta?.id],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const check = validateUpload(file, 'image');
    if (!check.ok) return toast(check.reason);
    try {
      const { blob, width, height } = await resizeImage(file);
      const id = newId();
      await storageService.putWallpaper(id, blob);
      if (customMeta) await storageService.deleteWallpaper(customMeta.id);
      setCustomWallpaper({ id, name: file.name, width, height, createdAt: Date.now() });
    } catch {
      toast('Could not process that image.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Swatch
          label={t('wallpaper.default')}
          css="linear-gradient(135deg, #eef1f6 0 50%, #0b0f1a 50% 100%)"
          selected={settings.wallpaperId === 'default'}
          onClick={() => updateSettings({ wallpaperId: 'default' })}
        />
      </div>

      {WALLPAPER_PACKS.map((pack) => (
        <div key={pack}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t(`wallpaper.pack.${pack}` as 'wallpaper.pack.minimal')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BUILTIN_WALLPAPERS.filter((w) => w.pack === pack).map((w) => (
              <Swatch
                key={w.id}
                label={w.name}
                css={w.css}
                selected={settings.wallpaperId === w.id}
                onClick={() => updateSettings({ wallpaperId: w.id })}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t('wallpaper.custom')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {customUrl && (
            <Swatch
              label={t('wallpaper.custom')}
              image={customUrl}
              selected={settings.wallpaperId === 'custom'}
              onClick={() => updateSettings({ wallpaperId: 'custom' })}
            />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            {t('wallpaper.upload')}
          </Button>
          {customMeta && (
            <Button variant="ghost" size="sm" onClick={() => void clearCustomWallpaper()}>
              {t('wallpaper.clear')}
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">{t('wallpaper.uploadHint')}</p>
      </div>
    </div>
  );
}

function Swatch({
  label,
  css,
  image,
  selected,
  onClick,
}: {
  label: string;
  css?: string;
  image?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cx(
        'relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition',
        selected ? 'border-accent' : 'border-transparent',
      )}
      style={image ? { backgroundImage: `url(${image})`, backgroundSize: 'cover' } : { background: css }}
    >
      <span className="absolute inset-x-0 bottom-0 bg-black/35 px-1.5 py-1 text-[10px] font-medium text-white">
        {label}
      </span>
      {selected && (
        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-contrast">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </button>
  );
}
