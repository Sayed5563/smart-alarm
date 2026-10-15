import { useEffect, useState } from 'react';

export type Route = 'alarms' | 'timer' | 'settings' | 'advanced' | 'history';
/** The bottom tabs. Advanced and History live under Settings. */
export const NAV_TABS: Route[] = ['alarms', 'timer', 'settings'];

const PATH: Record<Route, string> = {
  alarms: 'alarms',
  timer: 'timer',
  settings: 'settings',
  advanced: 'settings/advanced',
  history: 'settings/advanced/history',
};

export function routeHash(r: Route): string {
  return `#/${PATH[r]}`;
}

/** Unknown and legacy hashes land somewhere sensible: #/home → Alarms, #/history → History. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === 'history') return 'history';
  return (Object.keys(PATH) as Route[]).find((r) => PATH[r] === path) ?? 'alarms';
}

/** The tab to light up: sub-pages belong to Settings. */
export function tabFor(r: Route): Route {
  return r === 'advanced' || r === 'history' ? 'settings' : r;
}

/** Where a sub-page's back link goes — always up a level, never "wherever the browser came from". */
export function parentOf(r: Route): Route | null {
  return r === 'history' ? 'advanced' : r === 'advanced' ? 'settings' : null;
}

function parse(): Route {
  return parseRoute(window.location.hash);
}

/** Tiny hash router — no dependency, gives the PWA a working back button and
 *  shareable deep links (#/alarms, #/settings). */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash || window.location.hash === '#/home') window.location.replace('#/alarms');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeHash(r);
  };
  return [route, navigate];
}
