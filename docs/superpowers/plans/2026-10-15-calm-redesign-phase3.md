# Calm redesign — Phase 3 (v1.9.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A short Settings screen (Alarms, Appearance, Permissions, Advanced ›, About), with everything rarely used on an Advanced sub-page; drop the blur from list tiles; and clear the phase 1–2 polish leftovers.

**Architecture:** One `Settings` component with a `view: 'main' | 'advanced'` prop. Its state, sheets and dialogs stay shared, and sections are shown per view, so no state is duplicated or moved. The router gains two path routes (`#/settings/advanced`, `#/settings/advanced/history`). A `routeHash`/`tabFor` pair, both unit-tested, maps routes to hashes and to the highlighted tab. Sub-pages get a back header.

**Tech Stack:** React 18 + TS strict, zustand, Tailwind v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-calm-redesign-design.md`, sections 5 (Settings) and 6 (Visual language).

## Global Constraints

- No `AppSettings` model change and no migration. Removed controls leave their stored fields untouched.
- No new dependencies. Touch targets ≥ 44 px. Real buttons and links. Sentence case.
- Native code, the scheduler and the alarm screen are untouched.
- Commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch → PR → squash-merge.

## Decisions that refine the spec (for review)

1. **Amber is already the default accent** (`DEFAULT_SETTINGS.accent = 'amber'`). Nothing to change: a user who picked blue keeps blue. Accent moves to Advanced.
2. **"Clock style", "Clock font" and "Show seconds" are removed, not moved to Advanced.** They only drove the giant Home clock that v1.7.0 removed, so today they do nothing. `components/Clock.tsx` is dead code and is deleted. The stored fields stay, harmlessly.
3. **The blur comes off tiles, not off overlays.** List rows already have no blur since v1.7.0. The quick-alarm chips, timer presets and History rows switch from `glass` (20 px backdrop blur) to a plain `bg-surface` tile. The tab bar and sheets keep it.
4. **Web-only notification controls move to Advanced** (they're hidden in the phone app anyway, since v1.6.0).

## Review Focus

1. **Every removed or moved control is still reachable** on main or Advanced: default sound, snooze, volume, fade-in, vibration, theme, 24-hour, permissions (native), wake-up default, strong alert default, quiet hours, profiles, history, accent, reduce motion, wallpaper, notifications (web), export, import, clear history, reset, storage note (web), version, privacy. Checked in Task 5.
2. **Deep links:** `#/settings/advanced` opens Advanced. `#/settings/advanced/history` and legacy `#/history` open History. Pinned in Task 1.
3. **The Settings tab stays highlighted on its sub-pages.** Pinned in Task 1 (`tabFor`).
4. **Back from a sub-page goes up a level** (History → Advanced → Settings), even when the page was opened from a deep link with no browser history. The back button navigates to the parent route; it doesn't use `history.back()`. Pinned in Task 1 (`parentOf`).
5. **The Reset and Import dialogs still work from the Advanced view** (shared state). Checked in Task 5.

---

### Task 1: Routes for the Settings sub-pages

**Files:** Modify `src/hooks/useHashRoute.ts`, `src/components/Navigation.tsx`. Test `src/test/route.test.ts`.

**Interfaces — produces:**
- `type Route = 'alarms' | 'timer' | 'settings' | 'advanced' | 'history'`
- `parseRoute(hash: string): Route` gains `#/settings/advanced` → `'advanced'` and `#/settings/advanced/history` → `'history'`, and keeps `#/history` → `'history'`.
- `routeHash(r: Route): string`
- `tabFor(r: Route): Route` (`advanced`/`history` → `settings`)
- `parentOf(r: Route): Route | null` (`advanced` → `settings`, `history` → `advanced`, others → `null`)
- `navigate(r)` uses `routeHash`.

- [ ] **Step 1: Failing tests.** Append to `src/test/route.test.ts`:

```ts
import { parentOf, routeHash, tabFor } from '@/hooks/useHashRoute';

describe('settings sub-pages', () => {
  it('parses the nested hashes', () => {
    expect(parseRoute('#/settings/advanced')).toBe('advanced');
    expect(parseRoute('#/settings/advanced/history')).toBe('history');
  });
  it('round-trips every route through its hash', () => {
    for (const r of ['alarms', 'timer', 'settings', 'advanced', 'history'] as const) {
      expect(parseRoute(routeHash(r))).toBe(r);
    }
  });
  it('keeps the Settings tab lit on its sub-pages', () => {
    expect(tabFor('advanced')).toBe('settings');
    expect(tabFor('history')).toBe('settings');
    expect(tabFor('timer')).toBe('timer');
  });
  it('back goes up one level, never to wherever the browser came from', () => {
    expect(parentOf('history')).toBe('advanced');
    expect(parentOf('advanced')).toBe('settings');
    expect(parentOf('alarms')).toBeNull();
  });
});
```

(Merge the import into the file's existing `import { parseRoute } …` line.)

- [ ] **Step 2:** Run `npx vitest run src/test/route.test.ts`. Expected: FAIL (`routeHash` not exported).
- [ ] **Step 3: Implement** in `src/hooks/useHashRoute.ts`. Replace the route constants and `parseRoute` with:

```ts
export type Route = 'alarms' | 'timer' | 'settings' | 'advanced' | 'history';
/** The bottom tabs. Advanced and History live under Settings. */
export const NAV_TABS: Route[] = ['alarms', 'timer', 'settings'];

const HASH: Record<Route, string> = {
  alarms: '#/alarms',
  timer: '#/timer',
  settings: '#/settings',
  advanced: '#/settings/advanced',
  history: '#/settings/advanced/history',
};

export function routeHash(r: Route): string {
  return HASH[r];
}

/** Unknown and legacy hashes land somewhere sensible: #/home → Alarms, #/history → History. */
export function parseRoute(hash: string): Route {
  const h = hash.replace(/\/+$/, '');
  if (h === '#/history') return 'history';
  const hit = (Object.keys(HASH) as Route[]).find((r) => HASH[r] === h);
  return hit ?? 'alarms';
}

export function tabFor(r: Route): Route {
  return r === 'advanced' || r === 'history' ? 'settings' : r;
}

export function parentOf(r: Route): Route | null {
  return r === 'history' ? 'advanced' : r === 'advanced' ? 'settings' : null;
}
```

Set `navigate` to `window.location.hash = routeHash(r);`. In `src/components/Navigation.tsx`, compute the active tab with `tabFor(route) === r`, importing `tabFor`.

- [ ] **Step 4:** Run `npx vitest run src/test/route.test.ts && npx tsc -b`. Expected: PASS, and tsc is clean (`App.tsx` doesn't render `'advanced'` yet, which is fine: an unhandled route renders nothing until Task 3).
- [ ] **Step 5:** Commit `feat(nav): settings sub-page routes`.

---

### Task 2: `PageHeader` with back + `LinkRow`

**Files:** Create `src/components/PageHeader.tsx`. Test `src/test/pageHeader.test.tsx`.

**Interfaces — produces:**
- `PageHeader({ title, back }: { title: string; back?: Route })`: when `back` is set, it renders a real `<a href={routeHash(back)}>` with an accessible "Back" label before the title.
- `LinkRow({ label, to, value }: { label: string; to: Route; value?: string })`: a full-width `<a>` row with a chevron.

- [ ] **Step 1: Failing test** `src/test/pageHeader.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkRow, PageHeader } from '@/components/PageHeader';

describe('PageHeader / LinkRow', () => {
  it('back is a real link to the parent page', () => {
    render(<PageHeader title="History" back="advanced" />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('#/settings/advanced');
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
  });
  it('a link row goes to its page', () => {
    render(<LinkRow label="Advanced" to="advanced" />);
    expect(screen.getByRole('link', { name: /Advanced/ }).getAttribute('href')).toBe('#/settings/advanced');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/pageHeader.test.tsx`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `src/components/PageHeader.tsx`:

```tsx
import { routeHash, type Route } from '@/hooks/useHashRoute';
import { useT } from '@/i18n';

/** Page title, with a back link to the parent page on sub-pages. */
export function PageHeader({ title, back }: { title: string; back?: Route }) {
  const t = useT();
  return (
    <header className="flex items-center gap-1 pt-6">
      {back && (
        <a
          href={routeHash(back)}
          aria-label={t('common.back')}
          className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:text-fg"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <a href={routeHash(to)} className="flex min-h-[3rem] items-center justify-between gap-3 py-2 text-[15px] font-medium">
      <span>{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-muted">
        {value}
        <span aria-hidden="true">›</span>
      </span>
    </a>
  );
}
```

Add `'common.back': 'Back',` and `'settings.advanced': 'Advanced',` to `src/i18n/en.ts`, if those keys don't exist (grep first).

- [ ] **Step 4:** Run `npx vitest run src/test/pageHeader.test.tsx`. Expected: PASS 2/2.
- [ ] **Step 5:** Commit `feat: page header with back link, link rows`.

---

### Task 3: Settings main / Advanced split

**Files:** Modify `src/pages/Settings.tsx`, `src/App.tsx`, `src/pages/History.tsx`, `src/i18n/en.ts`. Delete `src/components/Clock.tsx`.

**Interfaces:** `Settings({ view }: { view: 'main' | 'advanced' })`. App renders `<Settings view="main" />` on `settings` and `<Settings view="advanced" />` on `advanced`.

- [ ] **Step 1: Strings.** Add `'settings.section.look': 'Look'`, `'settings.section.permissions'` (exists since v1.6.0; check), and `'settings.advancedHint': 'Wake-up tasks, quiet hours, profiles, history, backup'`.
- [ ] **Step 2: Restructure `Settings`.** Keep all state, handlers, sheets and dialogs at the top level, unchanged. Wrap the sections:
  - `view === 'main'`:
    - `PageHeader title={t('settings.title')}`.
    - **Alarms:** a `PickerRow` for the default sound (label `t('settings.defaultSound')`, value = sound name, opens the existing sound sheet; replaces the old Button), then snooze, volume, fade-in, vibration (existing controls, moved here).
    - **Appearance:** theme `Segmented` and the 24-hour `RowToggle` (existing).
    - **Permissions** (native only): the three permission rows, with title `t('settings.section.permissions')`.
    - **One group with a single `LinkRow`** to Advanced: `label={t('settings.advanced')}`, plus a muted hint line from `t('settings.advancedHint')` under it.
    - **About** (existing).
  - `view === 'advanced'`:
    - `PageHeader title={t('settings.advanced')} back="settings"`.
    - **Wake-up** (existing: default task, strong alert default).
    - **Quiet hours** (existing).
    - **Profiles** (existing).
    - **History:** `LinkRow to="history"`.
    - **Look:** accent colours, reduce motion, wallpaper button (existing).
    - **Notifications** (web only: the existing web notification controls; drop the native-only rows from here, since they're on main).
    - **Data:** export, import, clear history, reset, storage note (existing).
  - Remove the Clock style, Clock font and Show seconds controls.
  - Delete `src/components/Clock.tsx`. Run `grep -rn "components/Clock" src` and expect no matches.
- [ ] **Step 3: App.tsx.** Render `{route === 'settings' && <Settings view="main" />}{route === 'advanced' && <Settings view="advanced" />}`. Replace the old `<a href="#/history">` row (added in v1.7.0 to the Data section) with the History `LinkRow` above.
- [ ] **Step 4: History back.** In `src/pages/History.tsx`, replace its `<header>…<h1>` with `<PageHeader title={t('history.title')} back="advanced" />`.
- [ ] **Step 5: Smoke test.** Append to `src/test/pageHeader.test.tsx`:

```tsx
import { Settings } from '@/pages/Settings';

describe('Settings views', () => {
  it('main shows the short list and links to Advanced; Advanced has the rest', () => {
    const { unmount } = render(<Settings view="main" />);
    expect(screen.getByRole('link', { name: /Advanced/ })).toBeTruthy();
    expect(screen.queryByText('Quiet hours')).toBeNull();
    unmount();
    render(<Settings view="advanced" />);
    expect(screen.getAllByText('Quiet hours').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /History/ })).toBeTruthy();
  });
});
```

(If `Settings` needs the store mocks from `store.test.ts`, the `vi.mock('@/services', …)` stub, copy that block into this file.)

- [ ] **Step 6:** Run `npx tsc -b && npm test --silent`. Expected: clean, and all tests pass.
- [ ] **Step 7:** Commit `feat: short settings with an Advanced page`.

---

### Task 4: Tiles without blur + polish leftovers

**Files:** Modify `src/components/QuickTimer.tsx`, `src/pages/TimerPage.tsx`, `src/pages/History.tsx`, `src/i18n/en.ts`.

- [ ] **Step 1: Failing test** for the timer label. Add to `src/test/timer.test.ts`:

```ts
import { durationLabel } from '@/utils/timer';

describe('durationLabel', () => {
  it('reads naturally', () => {
    expect(durationLabel(0, 20)).toBe('20 min');
    expect(durationLabel(1, 0)).toBe('1 h');
    expect(durationLabel(2, 5)).toBe('2 h 5 min');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/timer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `src/utils/timer.ts`:

```ts
/** "20 min", "1 h", "2 h 5 min" — the custom timer's Start label. */
export function durationLabel(h: number, m: number): string {
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
```

In `TimerPage`, use `{t('timer.start')} · {durationLabel(custom.h, custom.m)}`, and delete the `timer.hm` string.
- [ ] **Step 4: Timer hidden during another ring.** In `TimerPage`, change `!ringing` to `ringing?.kind !== 'timer'`, so the countdown stays visible when an unrelated alarm rings.
- [ ] **Step 5: No blur on tiles.** Replace `glass` with `bg-surface border border-hairline` on:
  - the quick-alarm chips (`QuickTimer.tsx`);
  - the timer presets (`TimerPage.tsx`);
  - the History list container/rows (`History.tsx`; grep `glass` in it).
  Leave `Navigation`, `ui.tsx` Sheet and the toast as they are.
- [ ] **Step 6: Unused strings.** Delete `timer.5`, `timer.10`, `timer.30`, `timer.running`, `editor.test`, `editor.enabled`, `nav.home`, `home.addAlarm`, `home.testAlarm`, `home.recent`, `home.noAlarms`, `home.noAlarmsHint`, `settings.clockType*`, `settings.clockFont*` and `settings.showSeconds` from `en.ts`. Before each deletion, `grep -rn "'<key>'" src` must show no use; if a type cast references one (e.g. Navigation's `'nav.home'`), fix the cast.
- [ ] **Step 7:** Run `npx tsc -b && npm test --silent`. Expected: clean, and all tests pass.
- [ ] **Step 8:** Commit `polish: flat tiles, natural timer label, leftovers`.

---

### Task 5: Verify and release v1.9.0

- [ ] **Step 1: Browser 412×915, dark + light.** Settings main shows Alarms · Appearance · Advanced › · About. On Advanced, check every item in Review Focus 1, and that its back link returns to Settings. History's back link returns to Advanced. The tab bar shows Settings lit on both sub-pages. `#/history` and `#/settings/advanced/history` both open History. Reset and Import open their dialogs from Advanced.
- [ ] **Step 2: Emulator APK.** On Settings, the Permissions rows show their status. Advanced and History open and go back by touch. A scroll test on the Alarms list feels smooth.
- [ ] **Step 3:** Version 1.9.0 (`npm version 1.9.0 --no-git-tag-version`, `src/version.ts`). Commit `chore: v1.9.0`.
- [ ] **Step 4:** Final whole-branch review (one fresh opus reviewer), fix Critical/Important with tests, then PR → CI → squash-merge → tag → Release with the APK.
