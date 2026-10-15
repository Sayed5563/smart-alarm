import { goBack, routeHash, type Route } from '@/hooks/useHashRoute';
import { useT } from '@/i18n';

/** Page title, with a back link to the parent page on sub-pages. */
export function PageHeader({ title, back }: { title: string; back?: Route }) {
  const t = useT();
  return (
    <header className="flex items-center gap-1 pt-6">
      {back && (
        <a
          href={routeHash(back)}
          onClick={(e) => {
            e.preventDefault();
            goBack(back);
          }}
          aria-label={t('common.back')}
          className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:text-fg"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </a>
      )}
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

/** A settings row that opens a sub-page. */
export function LinkRow({ label, to, value }: { label: string; to: Route; value?: string }) {
  return (
    <a
      href={routeHash(to)}
      className="flex min-h-[3rem] items-center justify-between gap-3 py-2 text-[15px] font-medium"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-muted">
        {value}
        <span aria-hidden="true">›</span>
      </span>
    </a>
  );
}
