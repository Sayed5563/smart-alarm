import { useEffect, useState } from 'react';

export type Route = 'alarms' | 'timer' | 'settings' | 'history';
const ROUTES: Route[] = ['alarms', 'timer', 'settings', 'history'];
/** The bottom tabs. History is reached from Settings. */
export const NAV_TABS: Route[] = ['alarms', 'timer', 'settings'];

/** Unknown and legacy (#/home) hashes land on Alarms. */
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'alarms';
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
    window.location.hash = `#/${r}`;
  };
  return [route, navigate];
}
