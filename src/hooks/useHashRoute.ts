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

/**
 * Our mirror of the browser's history entries, so a sub-page's back arrow can
 * do what Android's Back would. Without it the arrow pushed a new entry, and
 * system Back then bounced between History and Advanced.
 */
const stack: Route[] = [];
let replacing = false;
/** A pop is in flight: history.back() is async, so ignore a second tap until it lands. */
let backPending = false;

export function trackRoute(r: Route) {
  backPending = false;
  if (replacing) {
    replacing = false;
    stack[Math.max(0, stack.length - 1)] = r;
  } else if (stack.length > 1 && stack[stack.length - 2] === r) {
    stack.pop();
  } else if (stack[stack.length - 1] !== r) {
    stack.push(r);
  }
}

/** 'pop' when the previous entry is the parent page, else 'replace' (deep link). */
export function backAction(prev: Route | null, parent: Route): 'pop' | 'replace' {
  return prev === parent ? 'pop' : 'replace';
}

/** A sub-page's back arrow: up to `parent`, without growing the history. */
export function goBack(parent: Route) {
  if (backPending) return;
  const prev = stack.length > 1 ? stack[stack.length - 2] : null;
  if (backAction(prev, parent) === 'pop') {
    backPending = true;
    window.history.back();
  } else {
    replacing = true;
    window.location.replace(routeHash(parent));
  }
}

/** Tiny hash router — no dependency, gives the PWA a working back button and
 *  shareable deep links (#/alarms, #/settings). */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    trackRoute(parse());
    const onHash = () => {
      const r = parse();
      trackRoute(r);
      setRoute(r);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash || window.location.hash === '#/home') window.location.replace('#/alarms');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeHash(r);
  };
  return [route, navigate];
}
