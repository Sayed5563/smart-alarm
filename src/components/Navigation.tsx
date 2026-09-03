import type { Route } from '@/hooks/useHashRoute';
import { useT } from '@/i18n';
import { cx } from './ui';

const ICONS: Record<Route, JSX.Element> = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />
  ),
  alarms: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M5 3 2 6M19 3l3 3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4M12 8v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V22a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 20l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 15H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4V2a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17.4 4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20 9h2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
};

export function Navigation({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  const t = useT();
  const items: Route[] = ['home', 'alarms', 'history', 'settings'];
  return (
    <div className="sticky bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <nav
        aria-label={t('app.name')}
        className="glass flex items-stretch justify-around rounded-[1.25rem] px-1.5 py-1.5"
      >
        {items.map((r) => {
          const active = route === r;
          return (
            <button
              key={r}
              onClick={() => onNavigate(r)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'relative flex min-h-[3rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition duration-200',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:text-fg',
              )}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.1 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[r]}
              </svg>
              {t(`nav.${r}` as 'nav.home')}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
