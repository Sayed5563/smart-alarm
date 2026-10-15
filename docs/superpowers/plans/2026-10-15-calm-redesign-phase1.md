# Calm redesign — Phase 1 (v1.7.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home + Alarms with one calm Alarms screen (small clock, "Next in", quick chips, a flat alarm list with tap-to-edit and swipe-to-delete + Undo, and a + button), behind a 3-tab nav (Alarms · Timer · Settings).

**Architecture:** UI-only change over the existing zustand store. Two pure helper modules (`utils/alarmList.ts`) carry the logic that gets unit tests. The store gains an undoable delete and a toast action. New presentational components (`SwipeRow`, `AlarmRow`) replace `AlarmCard`. The tiny hash router changes its route set and redirects legacy routes.

**Tech Stack:** React 18 + TS strict, zustand, Tailwind v4, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-15-calm-redesign-design.md` (sections 1, 2, and the Timer *route* from 3. The Timer redesign itself is phase 2.)

## Global Constraints

- No data-model migration: `Alarm`, `repeat`/`customDays` and persisted keys are unchanged. The only new store fields (`lastDeleted`) are **not** persisted.
- No new dependencies.
- One accent (warm amber) is the target, but **phase 1 does not change the accent default**. That's phase 3.
- Touch targets ≥ 44 px. Every interactive element is a real `<button>` (keyboard/a11y).
- Copy: sentence case, no ALL-CAPS labels (Nightstand design rule).
- The native ringing screen, the scheduler and `nativeAlarmScheduler` are untouched.
- Commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `master` is protected: branch, then PR, then squash-merge.

## Review Focus

1. **Undo after the toast has gone, or after another delete.** Undo restores only the most recent deletion, and the slot clears after 5 s. A second delete replaces the slot. It must never restore the wrong alarm. Pinned by store tests in Task 1.
2. **Undo restores profile membership.** An alarm deleted from a profile comes back *in* that profile. Pinned in Task 1.
3. **A spent one-off alarm** (`repeat: 'once'` with `lastFiredKey`) shows as off, and toggling it on re-arms it (existing `toggleAlarm` clears `lastFiredKey`). Pinned by `isSpent` tests in Task 2.
4. **A vertical scroll that starts on a row must not delete or open it.** The swipe only engages on a mostly horizontal drag (|dx| > |dy| and > 8 px), and a tap only fires when the finger hasn't moved. Pinned by `swipeIntent` tests in Task 4.
5. **Legacy deep links** `#/home` and `#/history` still open a sensible screen. Pinned by `parseRoute` tests in Task 3.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/utils/alarmList.ts` | create | `sortByTimeOfDay`, `isSpent` (pure) |
| `src/test/alarmList.test.ts` | create | tests for the above |
| `src/store/useStore.ts` | modify | `lastDeleted`, `undoDelete`, toast `action` |
| `src/test/store.test.ts` | modify | undo tests |
| `src/hooks/useHashRoute.ts` | modify | routes `alarms·timer·settings·history`, `parseRoute` export, legacy redirect |
| `src/test/route.test.ts` | create | `parseRoute` tests |
| `src/components/SwipeRow.tsx` | create | swipe-left-to-reveal-Delete wrapper + exported pure `swipeIntent` |
| `src/test/swipe.test.ts` | create | `swipeIntent` tests |
| `src/components/AlarmRow.tsx` | create | flat alarm row (replaces `AlarmCard`) |
| `src/pages/Alarms.tsx` | rewrite | the new main screen |
| `src/pages/TimerPage.tsx` | create | wraps the existing `Timer` (phase 2 redesigns it) |
| `src/components/Navigation.tsx` | modify | 3 tabs |
| `src/App.tsx` | modify | routes, toast with action, drop `runTest`/Home |
| `src/i18n/en.ts` | modify | new strings |
| delete | `src/pages/Home.tsx`, `src/components/AlarmCard.tsx` | superseded |

---

### Task 1: Undoable delete + toast action (store)

**Files:**
- Modify: `src/store/useStore.ts` (state type near line 25; `deleteAlarm` at ~146; `toast` at ~423)
- Test: `src/test/store.test.ts`

**Interfaces:**
- Produces: `lastDeleted: { alarm: Alarm; profileIds: ID[]; at: number } | null`, `undoDelete(): void`, `toast(message: string, action?: { label: string; run: () => void }): void`, `lastToast: { id: number; message: string; action?: { label: string; run: () => void } } | null`.

- [ ] **Step 1: Write the failing tests** (append inside `describe('alarm CRUD', …)` in `src/test/store.test.ts`; also add `lastDeleted: null` to `reset()`'s `setState`):

```ts
  it('undoDelete restores the alarm and its profile membership', () => {
    const a = useStore.getState().addAlarm({ label: 'Gym' });
    const p = useStore.getState().addProfile('Work');
    useStore.getState().setProfileAlarms(p.id, [a.id]);
    useStore.getState().deleteAlarm(a.id);
    expect(useStore.getState().alarms).toHaveLength(0);

    useStore.getState().undoDelete();
    expect(useStore.getState().alarms.map((x) => x.label)).toEqual(['Gym']);
    expect(useStore.getState().profiles[0].activeAlarmIds).toEqual([a.id]);
    expect(useStore.getState().lastDeleted).toBeNull();
  });

  it('undoDelete only restores the most recent deletion, once', () => {
    const a = useStore.getState().addAlarm({ label: 'A' });
    const b = useStore.getState().addAlarm({ label: 'B' });
    useStore.getState().deleteAlarm(a.id);
    useStore.getState().deleteAlarm(b.id);
    useStore.getState().undoDelete();
    useStore.getState().undoDelete();
    expect(useStore.getState().alarms.map((x) => x.label)).toEqual(['B']);
  });

  it('undoDelete does nothing once the 5 s window has passed', () => {
    vi.useFakeTimers();
    const a = useStore.getState().addAlarm();
    useStore.getState().deleteAlarm(a.id);
    vi.advanceTimersByTime(5_001);
    useStore.getState().undoDelete();
    expect(useStore.getState().alarms).toHaveLength(0);
    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run them, expect FAIL**

Run: `npx vitest run src/test/store.test.ts`
Expected: FAIL. `undoDelete is not a function`.

- [ ] **Step 3: Implement.** In `StoreState` add:

```ts
  /** In-memory only: the last deleted alarm, for the Undo toast (5 s). */
  lastDeleted: { alarm: Alarm; profileIds: ID[]; at: number } | null;
  undoDelete: () => void;
```

Change the toast types:

```ts
  lastToast: { id: number; message: string; action?: { label: string; run: () => void } } | null;
  toast: (message: string, action?: { label: string; run: () => void }) => void;
```

Initial state: add `lastDeleted: null,` beside `timerEndsAt: null,`. In the persisted `merge`, add `lastDeleted: null,` beside `ringing: null,`.

Replace `deleteAlarm`:

```ts
      deleteAlarm: (id) =>
        set((s) => {
          const alarm = s.alarms.find((a) => a.id === id);
          return {
            alarms: s.alarms.filter((a) => a.id !== id),
            profiles: s.profiles.map((p) => ({
              ...p,
              activeAlarmIds: p.activeAlarmIds.filter((x) => x !== id),
            })),
            ringing: s.ringing?.alarmId === id ? null : s.ringing,
            lastDeleted: alarm
              ? {
                  alarm,
                  profileIds: s.profiles.filter((p) => p.activeAlarmIds.includes(id)).map((p) => p.id),
                  at: Date.now(),
                }
              : s.lastDeleted,
          };
        }),

      undoDelete: () =>
        set((s) => {
          const d = s.lastDeleted;
          if (!d || Date.now() - d.at > UNDO_WINDOW_MS) return { lastDeleted: null };
          return {
            alarms: [...s.alarms, d.alarm],
            profiles: s.profiles.map((p) =>
              d.profileIds.includes(p.id)
                ? { ...p, activeAlarmIds: [...p.activeAlarmIds, d.alarm.id] }
                : p,
            ),
            lastDeleted: null,
          };
        }),
```

Add `const UNDO_WINDOW_MS = 5_000;` next to `STORAGE_KEY`. Replace `toast`:

```ts
      toast: (message, action) => set({ lastToast: { id: Date.now(), message, action } }),
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/test/store.test.ts`
Expected: PASS, all store tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.ts src/test/store.test.ts
git commit -m "feat(store): undoable delete and toast actions"
```

---

### Task 2: List helpers

**Files:**
- Create: `src/utils/alarmList.ts`
- Test: `src/test/alarmList.test.ts`

**Interfaces:**
- Produces: `sortByTimeOfDay(alarms: Alarm[]): Alarm[]` (new array, by hour then minute then `createdAt`); `isSpent(a: Pick<Alarm, 'repeat' | 'lastFiredKey'>): boolean`.

- [ ] **Step 1: Failing tests** in `src/test/alarmList.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS } from '@/data/defaults';
import { isSpent, sortByTimeOfDay } from '@/utils/alarmList';

const at = (hour: number, minute: number, createdAt = 0) =>
  makeAlarm(DEFAULT_SETTINGS, { hour, minute, createdAt });

describe('sortByTimeOfDay', () => {
  it('orders by clock time, not by next ring, and is stable on ties', () => {
    const list = [at(14, 15), at(5, 30), at(6, 45, 2), at(6, 45, 1)];
    expect(sortByTimeOfDay(list).map((a) => [a.hour, a.minute, a.createdAt])).toEqual([
      [5, 30, 0], [6, 45, 1], [6, 45, 2], [14, 15, 0],
    ]);
  });
  it('does not mutate its input', () => {
    const list = [at(9, 0), at(1, 0)];
    sortByTimeOfDay(list);
    expect(list[0].hour).toBe(9);
  });
});

describe('isSpent', () => {
  it('is true only for a once-alarm that already rang', () => {
    expect(isSpent({ repeat: 'once', lastFiredKey: 'k' })).toBe(true);
    expect(isSpent({ repeat: 'once', lastFiredKey: undefined })).toBe(false);
    expect(isSpent({ repeat: 'daily', lastFiredKey: 'k' })).toBe(false);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/alarmList.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/utils/alarmList.ts`:

```ts
import type { Alarm } from '@/types';

/** The list order: by clock time, so it doesn't reshuffle every time an alarm rings. */
export function sortByTimeOfDay(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute) || a.createdAt - b.createdAt,
  );
}

/** A one-off alarm that already rang: shown as off until it's switched back on. */
export function isSpent(a: Pick<Alarm, 'repeat' | 'lastFiredKey'>): boolean {
  return a.repeat === 'once' && !!a.lastFiredKey;
}
```

- [ ] **Step 4:** Run `npx vitest run src/test/alarmList.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/alarmList.ts src/test/alarmList.test.ts
git commit -m "feat: alarm list sort and spent helpers"
```

---

### Task 3: Routes and 3-tab navigation

**Files:**
- Modify: `src/hooks/useHashRoute.ts`, `src/components/Navigation.tsx`, `src/i18n/en.ts`
- Create: `src/pages/TimerPage.tsx`
- Test: `src/test/route.test.ts`

**Interfaces:**
- Produces: `type Route = 'alarms' | 'timer' | 'settings' | 'history'`; `parseRoute(hash: string): Route`; `NAV_TABS: Route[] = ['alarms','timer','settings']`; `TimerPage(): JSX.Element`.

- [ ] **Step 1: Failing test** `src/test/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseRoute } from '@/hooks/useHashRoute';

describe('parseRoute', () => {
  it('maps the tabs', () => {
    expect(parseRoute('#/alarms')).toBe('alarms');
    expect(parseRoute('#/timer')).toBe('timer');
    expect(parseRoute('#/settings')).toBe('settings');
  });
  it('keeps old links working', () => {
    expect(parseRoute('#/home')).toBe('alarms');
    expect(parseRoute('#/history')).toBe('history');
    expect(parseRoute('')).toBe('alarms');
    expect(parseRoute('#/nonsense')).toBe('alarms');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/route.test.ts`. Expected: FAIL, `parseRoute` not exported.

- [ ] **Step 3: Implement** in `src/hooks/useHashRoute.ts` (replace the top of the file through `parse()`):

```ts
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
```

In `useHashRoute`, change the initial redirect to `if (!window.location.hash || window.location.hash === '#/home') window.location.replace('#/alarms');`.

In `src/components/Navigation.tsx`: import `NAV_TABS`. Replace the `home` icon entry with a `timer` icon:

```tsx
  timer: (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M12 14V10.5M10 3h4M18.5 7.5l1.5-1.5" />
    </>
  ),
```

Make `ICONS` a `Partial<Record<Route, JSX.Element>>` and keep `history` (it's still used by the Settings link). Set `const items = NAV_TABS;`.

In `src/i18n/en.ts`, add `'nav.timer': 'Timer',` after `'nav.alarms'`.

Create `src/pages/TimerPage.tsx`:

```tsx
import { useT } from '@/i18n';
import { Timer } from '@/components/QuickTimer';

/** Phase 1: the existing timer on its own tab. Phase 2 gives it the countdown ring. */
export function TimerPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <h1 className="pt-6 text-[1.75rem] font-semibold tracking-tight">{t('timer.title')}</h1>
      <Timer />
    </div>
  );
}
```

- [ ] **Step 4:** Run `npx vitest run src/test/route.test.ts && npx tsc -b`. Expected: route tests PASS. `tsc` will show errors in `App.tsx` (`'home'`). They're fixed in Task 6; that's expected here.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHashRoute.ts src/components/Navigation.tsx src/i18n/en.ts src/pages/TimerPage.tsx src/test/route.test.ts
git commit -m "feat(nav): alarms, timer, settings tabs with legacy redirects"
```

---

### Task 4: SwipeRow

**Files:**
- Create: `src/components/SwipeRow.tsx`
- Test: `src/test/swipe.test.ts`

**Interfaces:**
- Produces: `swipeIntent(dx: number, dy: number): 'none' | 'horizontal' | 'vertical'` (`none` while |dx|,|dy| ≤ 8); `SwipeRow({ children, onTap, onDelete, deleteLabel }: { children: ReactNode; onTap: () => void; onDelete: () => void; deleteLabel: string })`.

- [ ] **Step 1: Failing test** `src/test/swipe.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { swipeIntent } from '@/components/SwipeRow';

describe('swipeIntent', () => {
  it('ignores tiny movement so a tap stays a tap', () => {
    expect(swipeIntent(5, 3)).toBe('none');
  });
  it('a mostly vertical drag is a scroll, never a swipe', () => {
    expect(swipeIntent(-20, 40)).toBe('vertical');
  });
  it('a mostly horizontal drag is a swipe', () => {
    expect(swipeIntent(-30, 6)).toBe('horizontal');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/swipe.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/components/SwipeRow.tsx`:

```tsx
import { useRef, useState, type ReactNode } from 'react';

const SLOP = 8;
const REVEAL = 88; // width of the Delete button, px

/** Decide what a drag is, once it's past the slop. */
export function swipeIntent(dx: number, dy: number): 'none' | 'horizontal' | 'vertical' {
  if (Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) return 'none';
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

/**
 * A row you tap to open and swipe left to reveal Delete. Vertical drags pass
 * through to the page scroll (touch-action: pan-y). The Delete button is a
 * real button, so it also works from the keyboard once revealed.
 */
export function SwipeRow({
  children,
  onTap,
  onDelete,
  deleteLabel,
}: {
  children: ReactNode;
  onTap: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; intent: ReturnType<typeof swipeIntent> } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: offset, intent: 'none' };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (s.intent === 'none') s.intent = swipeIntent(dx, e.clientY - s.y);
    if (s.intent !== 'horizontal') return;
    if (!dragging) {
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setOffset(Math.max(-REVEAL * 1.4, Math.min(0, s.base + dx)));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (s.intent === 'none') {
      if (offset !== 0) setOffset(0); // tap on an open row closes it
      else onTap();
    } else if (s.intent === 'horizontal') {
      setOffset(offset < -REVEAL / 2 ? -REVEAL : 0);
    }
    setDragging(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onDelete}
        tabIndex={offset === 0 ? -1 : 0}
        aria-hidden={offset === 0}
        className="absolute inset-y-0 right-0 w-[88px] bg-danger text-sm font-semibold text-white"
      >
        {deleteLabel}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setOffset(0);
        }}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.22s var(--ease-out-soft)',
          touchAction: 'pan-y',
        }}
        className="relative bg-surface"
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4:** Run `npx vitest run src/test/swipe.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SwipeRow.tsx src/test/swipe.test.ts
git commit -m "feat: swipe-to-reveal-delete row"
```

---

### Task 5: AlarmRow

**Files:**
- Create: `src/components/AlarmRow.tsx`

**Interfaces:**
- Consumes: `isSpent` (Task 2), `useRepeatSummary` (existing, `src/components/alarmBits.tsx`), `Toggle` and `cx` (existing, `src/components/ui.tsx`), `formatAlarmTime` (existing).
- Produces: `AlarmRow({ alarm, dormant }: { alarm: Alarm; dormant?: boolean })`. Purely presentational: tap and delete are handled by the `SwipeRow` around it. The toggle stops pointer propagation so flipping it doesn't open the editor.

- [ ] **Step 1: Implement** `src/components/AlarmRow.tsx`:

```tsx
import type { Alarm } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { formatAlarmTime } from '@/utils/time';
import { isSpent } from '@/utils/alarmList';
import { Toggle, cx } from './ui';
import { useRepeatSummary } from './alarmBits';

/** One alarm in the list: time, label · days, feature icons, and its switch. */
export function AlarmRow({ alarm, dormant }: { alarm: Alarm; dormant?: boolean }) {
  const t = useT();
  const hour24 = useStore((s) => s.settings.hour24);
  const toggleAlarm = useStore((s) => s.toggleAlarm);
  const repeatSummary = useRepeatSummary();

  const on = alarm.enabled && !isSpent(alarm);
  const [time, meridiem] = formatAlarmTime(alarm.hour, alarm.minute, hour24).split(' ');
  const name = alarm.label || t('alarms.untitled');

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cx('min-w-0 flex-1 transition-opacity', (!on || dormant) && 'opacity-45')}>
        <div className="flex items-baseline gap-1">
          <span className="tnum text-[2.4rem] font-light leading-none tracking-tight">{time}</span>
          {meridiem && <span className="text-sm font-medium text-muted">{meridiem}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
          <span className="truncate text-fg/80">{name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{dormant ? t('alarms.dormant') : repeatSummary(alarm)}</span>
          {alarm.wakeUpTask.type !== 'none' && (
            <span title={t(`editor.wakeTask.${alarm.wakeUpTask.type}` as 'editor.wakeTask.math')} aria-hidden="true">🧩</span>
          )}
          {alarm.afterStop.enabled && <span title={t('editor.afterStop')} aria-hidden="true">🔔</span>}
        </div>
      </div>
      <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Toggle
          checked={on}
          onChange={(v) => toggleAlarm(alarm.id, v)}
          label={`${name} ${time} — ${on ? t('alarms.on') : t('alarms.off')}`}
        />
      </div>
    </div>
  );
}
```

Add `'alarms.untitled': 'Alarm',` to `src/i18n/en.ts`.

- [ ] **Step 2:** Run `npx tsc -b`. Expected: no errors from `AlarmRow.tsx`. `App.tsx` errors from Task 3 remain until Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/AlarmRow.tsx src/i18n/en.ts
git commit -m "feat: flat alarm row"
```

---

### Task 6: The new Alarms screen, wired into App

**Files:**
- Rewrite: `src/pages/Alarms.tsx`
- Modify: `src/App.tsx` (route rendering ~277–280; `runTest` ~246–266; `Toast` ~290)
- Modify: `src/pages/Settings.tsx` (History link)
- Modify: `src/i18n/en.ts`
- Delete: `src/pages/Home.tsx`, `src/components/AlarmCard.tsx`

**Interfaces:**
- Consumes: `sortByTimeOfDay` (T2), `SwipeRow` (T4), `AlarmRow` (T5), `undoDelete`/`toast(message, action)` (T1), `QuickSet` (existing `src/components/QuickTimer.tsx`), `nextEvent` (existing `src/utils/schedule.ts`), `formatCountdown` (existing).
- Produces: `Alarms(): JSX.Element` (no props).

- [ ] **Step 1: Strings.** Add to `src/i18n/en.ts`:

```ts
  'alarms.nextIn': 'Next in {time}',
  'alarms.noneOn': 'No alarms on',
  'alarms.deleted': 'Alarm deleted',
  'alarms.newAlarm': 'New alarm',
  'common.undo': 'Undo',
  'settings.history': 'History',
```

Change `'alarms.emptyHint'` to `'Tap + to add your first alarm'`.

- [ ] **Step 2: Rewrite** `src/pages/Alarms.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';
import { AlarmEditor } from '@/components/AlarmEditor';
import { AlarmRow } from '@/components/AlarmRow';
import { SwipeRow } from '@/components/SwipeRow';
import { QuickSet } from '@/components/QuickTimer';
import { Button } from '@/components/ui';
import { nextEvent } from '@/utils/schedule';
import { formatClock, formatCountdown } from '@/utils/time';
import { sortByTimeOfDay } from '@/utils/alarmList';
import { audioService, isNativeApp } from '@/services';

export function Alarms() {
  const t = useT();
  const now = useNow('minute');
  const alarms = useStore((s) => s.alarms);
  const settings = useStore((s) => s.settings);
  const addAlarm = useStore((s) => s.addAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const undoDelete = useStore((s) => s.undoDelete);
  const toast = useStore((s) => s.toast);
  const setAudioUnlocked = useStore((s) => s.setAudioUnlocked);
  const activeIds = useStore((s) => s.activeAlarmIds)();

  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);

  const sorted = useMemo(() => sortByTimeOfDay(alarms), [alarms]);
  const next = useMemo(
    () => nextEvent(alarms, settings, activeIds, now.getTime()),
    [alarms, settings, activeIds, now],
  );
  const editingAlarm = editing ? alarms.find((a) => a.id === editing.id) : undefined;

  const add = () => {
    const a = addAlarm();
    setEditing({ id: a.id, isNew: true });
  };
  const remove = (id: string) => {
    deleteAlarm(id);
    toast(t('alarms.deleted'), { label: t('common.undo'), run: undoDelete });
  };

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="space-y-5 pb-24">
      <header className="pt-6">
        <p className="tnum text-sm text-muted">
          {dateLabel} · {formatClock(now, { hour24: settings.hour24, showSeconds: false })}
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight">{t('alarms.title')}</h1>
        <p className="mt-0.5 text-sm font-medium text-accent">
          {next ? t('alarms.nextIn', { time: formatCountdown(next.at - now.getTime()) }) : t('alarms.noneOn')}
        </p>
      </header>

      {!isNativeApp && !settings.audioUnlocked && !audioService.isUnlocked() && (
        <button
          type="button"
          onClick={async () => setAudioUnlocked(await audioService.unlock())}
          className="w-full rounded-xl bg-accent-soft px-4 py-2.5 text-left text-sm font-medium text-accent"
        >
          {t('home.enableSound')} →
        </button>
      )}

      <QuickSet />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="text-4xl" aria-hidden="true">🌙</span>
          <p className="text-base font-medium">{t('alarms.empty')}</p>
          <p className="text-sm text-muted">{t('alarms.emptyHint')}</p>
          <Button variant="primary" size="lg" onClick={add}>
            {t('alarms.add')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id}>
              <SwipeRow
                onTap={() => setEditing({ id: a.id, isNew: false })}
                onDelete={() => remove(a.id)}
                deleteLabel={t('alarms.delete')}
              >
                <AlarmRow alarm={a} dormant={activeIds != null && !activeIds.includes(a.id)} />
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        aria-label={t('alarms.add')}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-14rem+1.25rem))] z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg shadow-black/40 transition active:scale-95"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {editing && editingAlarm && (
        <AlarmEditor alarm={editingAlarm} isNew={editing.isNew} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: App.tsx.**
  - Remove the `Home` import. Add `import { TimerPage } from '@/pages/TimerPage';`.
  - Delete the `runTest` function and its `makeAlarm` use, if that's the only use. Keep `makeAlarm` if the timer effect still uses it (it does).
  - Replace the route block with:

```tsx
          {route === 'alarms' && <Alarms />}
          {route === 'timer' && <TimerPage />}
          {route === 'history' && <History />}
          {route === 'settings' && <Settings />}
```

  - Replace `Toast` so it can carry the Undo action:

```tsx
function Toast({ message, action }: { message: string; action?: { label: string; run: () => void } }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const t = window.setTimeout(dismiss, action ? 5000 : 2600);
    return () => window.clearTimeout(t);
  }, [dismiss, action]);
  return (
    <div
      role="status"
      className="toast-in glass fixed inset-x-0 bottom-[5.5rem] z-40 mx-auto flex w-fit max-w-[88vw] items-center gap-3 rounded-pill py-2 pl-4 pr-2 text-sm font-medium"
    >
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.run();
            dismiss();
          }}
          className="rounded-pill px-3 py-1.5 font-semibold text-accent hover:bg-surface-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

  and render it as `{lastToast?.message && <Toast key={lastToast.id} message={lastToast.message} action={lastToast.action} />}`.

  - Grep for any other `navigate('home')` / `'home'` route uses and switch them to `'alarms'`: `grep -rn "'home'" src`.

- [ ] **Step 4: Settings History link** (History is no longer a tab). In `src/pages/Settings.tsx`, at the top of the Data section (`<SettingsSection title={t('settings.section.data')}>`), add:

```tsx
        <a href="#/history" className="flex items-center justify-between rounded-xl py-2 text-sm font-medium">
          {t('settings.history')}
          <span className="text-muted" aria-hidden="true">›</span>
        </a>
```

- [ ] **Step 5: Delete** `src/pages/Home.tsx` and `src/components/AlarmCard.tsx`. Run `grep -rn "AlarmCard\|pages/Home" src`. Expected: no matches.

- [ ] **Step 6: Verify**

Run: `npx tsc -b && npm test --silent`
Expected: no type errors. All tests pass (90 + the new ones).

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: calm alarms screen with swipe-to-delete and undo"
```

---

### Task 7: Visual check, emulator check, release v1.7.0

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/version.ts` (version → 1.7.0)

- [ ] **Step 1: Browser check at S22 width.** Run `npm run build && npx vite preview --port 4173`. Open at 412×915 with seeded alarms (a daily, a weekdays, a spent once, a disabled one). Screenshot the Alarms screen in dark and light. Check:
  - the header shows date · time, "Alarms", and "Next in …"
  - the rows are in clock order
  - the spent once-alarm shows off and dimmed
  - the toggle doesn't open the editor
  - the + button sits above the tab bar and doesn't cover the last row (`pb-24`)
  - the empty state appears with no alarms
- [ ] **Step 2: Interaction check (browser).**
  - Swipe a row left; Delete appears.
  - Tap Delete; the toast shows Undo.
  - Undo brings the alarm back.
  - A vertical scroll that starts on a row neither opens nor deletes it.
  - `#/home` lands on Alarms, and `#/history` opens History.
  - The Timer tab shows the timer.
- [ ] **Step 3: Emulator check of the APK.** Do the same flows by touch on `Medium_Phone_API_36.1`. Also add an alarm via +, then Save, and confirm it arms natively (`dumpsys alarm | grep -c com.sayed.smartalarm.FIRE` grows).
- [ ] **Step 4: Version bump.** Run `npm version 1.7.0 --no-git-tag-version` and set `APP_VERSION = '1.7.0'` in `src/version.ts`. Commit with `chore: v1.7.0`.
- [ ] **Step 5: Ship.** Push the branch and open a PR to `master`. Wait for `verify` + `android`, squash-merge, tag `v1.7.0`, and create the GitHub Release with the debug APK (`npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`).
