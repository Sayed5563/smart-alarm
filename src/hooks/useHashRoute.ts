import { useEffect, useState } from 'react';

export type Route = 'home' | 'alarms' | 'history' | 'settings';
const ROUTES: Route[] = ['home', 'alarms', 'history', 'settings'];

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

/** Tiny hash router — no dependency, gives the PWA a working back button and
 *  shareable deep links (#/alarms, #/settings). */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.replace('#/home');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = `#/${r}`;
  };
  return [route, navigate];
}
