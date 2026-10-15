# Calm redesign — Phase 2 (v1.8.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A simpler alarm editor (time, M–S day circles, label, sound, snooze up front; everything else in "More options") and a real Timer tab (presets, custom, and a countdown ring).

**Architecture:** UI over the existing store, as in phase 1. The logic worth testing goes in pure helpers: `daysToRepeat` (`utils/repeat.ts`), `prepareSave` (`utils/alarmSave.ts`), and `timerView` (`utils/timer.ts`). The store gains one persisted field, `timerDurationMs`, so the ring knows its full length. Old saved data without it stays valid (`null` means the ring shows full).

**Tech Stack:** React 18 + TS strict, zustand, Tailwind v4, Vitest + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-calm-redesign-design.md`, sections 3 (Timer tab) and 4 (Editor).

## Global Constraints

- No `Alarm` model change and no migration. `repeat`/`customDays` stay; the day circles map onto them.
- No new dependencies. Touch targets ≥ 44 px. Every control is a real `<button>`/`<input>`. Sentence case.
- Native scheduler and native alarm screen untouched.
- Commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch → PR → squash-merge.

## Decisions that refine the spec (for review)

1. **Snooze has no "Off".** The model has no snooze-off flag (`snoozeMinutes > 0`), and adding one is a model change. Options are 5 / 10 / 15 / 20 min.
2. **Save stays at the bottom** (Cancel · Save), as today, not in the header. It's easier to reach with a thumb on a 6.8″ phone, and the sheet already has a close ✕ at the top.
3. **Editor "Delete alarm" uses the Undo toast instead of a confirm dialog**, the same as swipe-delete. This also closes deferred minor M3.
4. **Saving turns the alarm on** (iPhone/Pixel behaviour) and re-arms a spent one-off alarm. The "Enabled" toggle leaves the editor; the list switch is the on/off.
5. **The timer's "Custom" is hours + minutes** (the existing reel picker in 24-hour mode), not minutes + seconds. Timers over an hour are common and seconds rarely matter.

## Review Focus

1. **Day circles:** clearing every day gives Once. All 7 give Every day (`daily`). Mon–Fri gives `weekdays`, Sat+Sun gives `weekends`, anything else `custom`. Pinned in Task 1.
2. **Saving a spent one-off alarm without changing its time** must re-arm it (clear `lastFiredKey`) and turn it on. Pinned in Task 3.
3. **A timer started on an older version** (no `timerDurationMs`) still shows a sane ring: full, not NaN. Pinned in Task 4.
4. **Timer display over an hour** shows `h:mm:ss`, and at zero shows `0:00`, never negative. Pinned in Task 4.
5. **Opening "More options"** keeps every advanced setting reachable: volume, fade-in, vibration, wake-up task, strong alert, pre-alarm, after-stop, category, importance, quiet hours. Checked visually in Task 6.

---

## File map

| File | Change |
|---|---|
| `src/utils/repeat.ts` + `src/test/repeat.test.ts` | create: `daysToRepeat` |
| `src/components/DayCircles.tsx` | create: seven round toggles (replaces `RepeatPicker`) |
| `src/components/alarmBits.tsx` | modify: delete `RepeatPicker` (keep `useRepeatSummary`) |
| `src/utils/alarmSave.ts` + `src/test/alarmSave.test.ts` | create: `prepareSave` |
| `src/components/AlarmEditor.tsx` | modify: new layout, `onDelete` prop |
| `src/pages/Alarms.tsx` | modify: pass `onDelete` (undoable) |
| `src/store/useStore.ts` | modify: `timerDurationMs`, `startTimer(ms)` |
| `src/utils/timer.ts` + `src/test/timer.test.ts` | create: `timerView` |
| `src/pages/TimerPage.tsx` | rewrite: presets, custom, ring |
| `src/components/QuickTimer.tsx` | modify: drop `Timer` (keep `QuickSet`) |
| `src/i18n/en.ts` | strings |

---

### Task 1: `daysToRepeat`

**Files:** Create `src/utils/repeat.ts`, `src/test/repeat.test.ts`.

**Interfaces:** Produces `daysToRepeat(days: Weekday[]): { repeat: RepeatMode; customDays: Weekday[] }`. `customDays` is sorted, and `[]` unless `repeat === 'custom'`.

- [ ] **Step 1: Failing test** `src/test/repeat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { daysToRepeat } from '@/utils/repeat';

describe('daysToRepeat', () => {
  it('no days is a one-off', () => {
    expect(daysToRepeat([])).toEqual({ repeat: 'once', customDays: [] });
  });
  it('maps the familiar sets onto their presets', () => {
    expect(daysToRepeat([0, 1, 2, 3, 4, 5, 6])).toEqual({ repeat: 'daily', customDays: [] });
    expect(daysToRepeat([5, 1, 3, 2, 4])).toEqual({ repeat: 'weekdays', customDays: [] });
    expect(daysToRepeat([6, 0])).toEqual({ repeat: 'weekends', customDays: [] });
  });
  it('anything else is custom, sorted and de-duplicated', () => {
    expect(daysToRepeat([5, 1, 3, 1])).toEqual({ repeat: 'custom', customDays: [1, 3, 5] });
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/repeat.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `src/utils/repeat.ts`:

```ts
import type { RepeatMode, Weekday } from '@/types';

/** The day circles' selection, as the stored repeat rule. */
export function daysToRepeat(days: Weekday[]): { repeat: RepeatMode; customDays: Weekday[] } {
  const d = [...new Set(days)].sort((a, b) => a - b);
  const key = d.join(',');
  if (d.length === 0) return { repeat: 'once', customDays: [] };
  if (d.length === 7) return { repeat: 'daily', customDays: [] };
  if (key === '1,2,3,4,5') return { repeat: 'weekdays', customDays: [] };
  if (key === '0,6') return { repeat: 'weekends', customDays: [] };
  return { repeat: 'custom', customDays: d };
}
```

- [ ] **Step 4:** Run `npx vitest run src/test/repeat.test.ts`. Expected: PASS 3/3.
- [ ] **Step 5:** Commit `feat: daysToRepeat for the day circles`.

---

### Task 2: `DayCircles`

**Files:** Create `src/components/DayCircles.tsx`. Modify `src/components/alarmBits.tsx` (delete `RepeatPicker` and its now-unused helpers `WEEK_ORDER`/`WEEKDAYS`/`WEEKENDS`/`sameSet`, if `useRepeatSummary` doesn't use them).

**Interfaces:**
- Consumes: `daysToRepeat` (Task 1), `repeatDays` (existing, `utils/time.ts`).
- Produces: `DayCircles({ repeat, customDays, onChange }: { repeat: RepeatMode; customDays: Weekday[]; onChange: (repeat: RepeatMode, customDays: Weekday[]) => void })`.

- [ ] **Step 1: Failing test.** Append to `src/test/repeat.test.ts`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { DayCircles } from '@/components/DayCircles';
import { I18nContext, translate } from '@/i18n';

describe('DayCircles', () => {
  it('turning Saturday off on an every-day alarm leaves Sun–Fri custom', () => {
    const onChange = vi.fn();
    render(
      <I18nContext.Provider value={{ lang: 'en', t: (k, v) => translate('en', k, v) }}>
        <DayCircles repeat="daily" customDays={[]} onChange={onChange} />
      </I18nContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Saturday' }));
    expect(onChange).toHaveBeenCalledWith('custom', [0, 1, 2, 3, 4, 5]);
  });
});
```

(Add `vi` to the vitest import. If the `I18nContext` value shape differs from `{ lang, t }`, mirror what `App.tsx` builds with `useMemo<I18n>`. Check `src/i18n/index.ts` and match it exactly.)

- [ ] **Step 2:** Run `npx vitest run src/test/repeat.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `src/components/DayCircles.tsx`:

```tsx
import type { RepeatMode, Weekday } from '@/types';
import { useT } from '@/i18n';
import { repeatDays } from '@/utils/time';
import { daysToRepeat } from '@/utils/repeat';
import { cx } from './ui';

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** M T W T F S S — tap to toggle. None selected means once. */
export function DayCircles({
  repeat,
  customDays,
  onChange,
}: {
  repeat: RepeatMode;
  customDays: Weekday[];
  onChange: (repeat: RepeatMode, customDays: Weekday[]) => void;
}) {
  const t = useT();
  const on = repeatDays({ repeat, customDays });
  const toggle = (d: Weekday) => {
    const next = on.includes(d) ? on.filter((x) => x !== d) : [...on, d];
    const r = daysToRepeat(next);
    onChange(r.repeat, r.customDays);
  };
  return (
    <div className="flex justify-between gap-1" role="group" aria-label={t('editor.section.repeat')}>
      {WEEK_ORDER.map((d) => {
        const active = on.includes(d);
        const name = t(`day.${d}` as 'day.0');
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            aria-label={name}
            onClick={() => toggle(d)}
            className={cx(
              'grid h-11 w-11 place-items-center rounded-full text-sm font-semibold transition active:scale-95',
              active ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted hover:text-fg',
            )}
          >
            {name.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}
```

Check that `t('day.6')` is the full name ("Saturday"). If `day.N` holds short names, use the key that holds full names for `aria-label`, and keep the first letter for the visible text.

- [ ] **Step 4:** Run `npx vitest run src/test/repeat.test.ts && npx tsc -b`. Expected: PASS. `tsc` is clean except an unused `RepeatPicker` import in the editor; Task 3 removes it.
- [ ] **Step 5:** Delete `RepeatPicker` from `alarmBits.tsx`. Commit `feat: day circles`.

---

### Task 3: `prepareSave` + the new editor layout

**Files:** Create `src/utils/alarmSave.ts`, `src/test/alarmSave.test.ts`. Modify `src/components/AlarmEditor.tsx`, `src/pages/Alarms.tsx`, `src/i18n/en.ts`.

**Interfaces:**
- Produces: `prepareSave(draft: Alarm): Alarm` (`enabled: true`, `lastFiredKey: undefined`, `snoozedUntil: undefined`, `strongAlert.maxDurationMinutes` clamped to `[1, MAX_ALERT_DURATION_MINUTES]`).
- Editor: `AlarmEditor({ alarm, isNew, onClose, onDelete }: { …; onDelete: (id: string) => void })`.

- [ ] **Step 1: Failing test** `src/test/alarmSave.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS, MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { prepareSave } from '@/utils/alarmSave';

describe('prepareSave', () => {
  it('saving turns the alarm on and re-arms a spent one-off, even with no time change', () => {
    const spent = makeAlarm(DEFAULT_SETTINGS, { repeat: 'once', enabled: false, lastFiredKey: 'k' });
    const saved = prepareSave(spent);
    expect(saved.enabled).toBe(true);
    expect(saved.lastFiredKey).toBeUndefined();
  });
  it('clamps the strong-alert cap', () => {
    const a = makeAlarm(DEFAULT_SETTINGS, { strongAlert: { enabled: true, maxDurationMinutes: 999 } });
    expect(prepareSave(a).strongAlert.maxDurationMinutes).toBe(MAX_ALERT_DURATION_MINUTES);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/test/alarmSave.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `src/utils/alarmSave.ts`:

```ts
import type { Alarm } from '@/types';
import { MAX_ALERT_DURATION_MINUTES } from '@/data/defaults';
import { clamp } from './time';

/** What Save writes: the alarm on and armed fresh, like the iPhone and Pixel clocks. */
export function prepareSave(draft: Alarm): Alarm {
  return {
    ...draft,
    enabled: true,
    lastFiredKey: undefined,
    snoozedUntil: undefined,
    strongAlert: {
      ...draft.strongAlert,
      maxDurationMinutes: clamp(draft.strongAlert.maxDurationMinutes, 1, MAX_ALERT_DURATION_MINUTES),
    },
  };
}
```

- [ ] **Step 4:** Run `npx vitest run src/test/alarmSave.test.ts`. Expected: PASS 2/2.
- [ ] **Step 5: Editor layout** in `src/components/AlarmEditor.tsx`:
  - `save` becomes `updateAlarm(draft.id, prepareSave(draft)); onClose();`.
  - Add the `onDelete: (id: string) => void` prop. `remove` becomes `onClose(); onDelete(draft.id);`. Remove the `deleteAlarm` use from `remove` (keep it in `cancel` for a new draft; that's not undoable).
  - Main section, in order: `TimePicker`; `Field label={t('editor.section.repeat')}` containing `<DayCircles …/>` (replacing `RepeatPicker`); the Label field; `PickerRow` Sound; `Field label={t('editor.snooze')}` with `Segmented` of `[5,10,15,20]` plus the current value if it isn't one of those (keep the existing `snoozeOptions`).
  - **Remove** the main-section volume `Slider`, the fade-in `Field`, the Category field and the `RowToggle` Enabled, and move the first three into the `Collapsible` "More options". Its order: Volume slider, Fade-in, Vibration, Wake-up task (+ difficulty/rounds/QR), Strong alert, Pre-alarm, After-stop, Category, Importance, Ring during quiet hours. Remove the snooze `Field` from inside the Collapsible (it's in the main section now).
  - Footer row (editing only, `!isNew`): `Preview` (the existing test button, label `t('editor.preview')`) and `Delete alarm` (calls `remove`). For a new alarm only `Preview` shows.
- [ ] **Step 6: Wire Delete with Undo** in `src/pages/Alarms.tsx`: `<AlarmEditor … onDelete={remove} />`. `remove` already does `deleteAlarm(id, { undoable: true })` and shows the toast.
- [ ] **Step 7: Strings.** In `src/i18n/en.ts` add `'editor.preview': 'Preview',`.
- [ ] **Step 8:** Run `npx tsc -b && npm test --silent`. Expected: clean, and all tests pass.
- [ ] **Step 9:** Commit `feat: simpler alarm editor — days, label, sound, snooze up front`.

---

### Task 4: Timer state + `timerView`

**Files:** Modify `src/store/useStore.ts`. Create `src/utils/timer.ts`, `src/test/timer.test.ts`. Modify `src/test/store.test.ts`.

**Interfaces:**
- Store: `timerDurationMs: number | null` (persisted alongside `timerEndsAt`); `startTimer(ms: number): void` sets `timerEndsAt = now + ms`, `timerDurationMs = ms`; `cancelTimer()` clears both.
- `timerView(endsAt: number, durationMs: number | null, now: number): { label: string; progress: number }`. `label` is `m:ss`, or `h:mm:ss` at ≥ 1 h, clamped at `0:00`. `progress` is 1 → 0, remaining / duration, clamped to [0, 1], and 1 when `durationMs` is null or ≤ 0.

> **Breaking signature:** `startTimer` changes from minutes to milliseconds. Its only callers are `QuickTimer.Timer` (deleted in Task 5) and the v1.6.0 test in `store.test.ts`, if any. Grep `startTimer(` and update every call.

- [ ] **Step 1: Failing tests** `src/test/timer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { timerView } from '@/utils/timer';

describe('timerView', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(timerView(1_000 + 299_000, 300_000, 1_000).label).toBe('4:59');
    expect(timerView(3_723_000, 4_000_000, 0).label).toBe('1:02:03');
  });
  it('never goes negative', () => {
    expect(timerView(1_000, 60_000, 5_000)).toEqual({ label: '0:00', progress: 0 });
  });
  it('a timer from an older version (no duration) shows a full ring, not NaN', () => {
    expect(timerView(60_000, null, 0).progress).toBe(1);
  });
  it('progress runs from 1 to 0', () => {
    expect(timerView(100_000, 100_000, 50_000).progress).toBeCloseTo(0.5);
  });
});
```

Append to `src/test/store.test.ts` (inside `describe('alarm CRUD', …)`):

```ts
  it('startTimer records the end and the length; cancel clears both', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useStore.getState().startTimer(90_000);
    expect(useStore.getState().timerEndsAt).toBe(1_090_000);
    expect(useStore.getState().timerDurationMs).toBe(90_000);
    useStore.getState().cancelTimer();
    expect(useStore.getState().timerEndsAt).toBeNull();
    expect(useStore.getState().timerDurationMs).toBeNull();
    vi.useRealTimers();
  });
```

- [ ] **Step 2:** Run `npx vitest run src/test/timer.test.ts src/test/store.test.ts`. Expected: FAIL (module missing; `timerDurationMs` undefined).
- [ ] **Step 3: Implement.**
  - `src/utils/timer.ts`:

```ts
import { pad2 } from './time';

/** What the Timer tab shows for a running timer. */
export function timerView(
  endsAt: number,
  durationMs: number | null,
  now: number,
): { label: string; progress: number } {
  const left = Math.max(0, endsAt - now);
  const total = Math.ceil(left / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label = h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  const progress = durationMs && durationMs > 0 ? Math.min(1, Math.max(0, left / durationMs)) : 1;
  return { label, progress };
}
```

  - Store changes:
    - Add `timerDurationMs: number | null;` to `StoreState` next to `timerEndsAt`, initial `timerDurationMs: null,`, and to `partialize`.
    - Change `startTimer: (minutes: number) => void` to `startTimer: (ms: number) => void`.
    - Implementation: `startTimer: (ms) => set({ timerEndsAt: Date.now() + ms, timerDurationMs: ms }),` and `cancelTimer: () => set({ timerEndsAt: null, timerDurationMs: null }),`.
    - In `merge`, nothing is needed: a missing field stays `null` via `...current`.
    - In `App.tsx`'s timer effect, `s.cancelTimer()` already clears it.
- [ ] **Step 4:** Run `npx vitest run src/test/timer.test.ts src/test/store.test.ts`. Expected: PASS. Then `npx tsc -b`: the expected error is `QuickTimer.tsx` calling `startTimer(mins)`. Fix the call to `startTimer(mins * 60_000)` for now; Task 5 deletes it.
- [ ] **Step 5:** Commit `feat(store): timer length for the countdown ring`.

---

### Task 5: Timer tab

**Files:** Rewrite `src/pages/TimerPage.tsx`. Modify `src/components/QuickTimer.tsx` (delete `Timer`). Modify `src/i18n/en.ts`.

**Interfaces:** Consumes `timerView` and `startTimer(ms)`/`cancelTimer()` (Task 4), and `TimePicker` (existing, `hour24` mode).

- [ ] **Step 1: Strings** in `src/i18n/en.ts`: `'timer.ringsAt': 'Rings at {time}'`, `'timer.customTitle': 'Custom timer'`, `'timer.hm': '{h} h {m} min'`, `'timer.minutesShort': '{n} min'`, `'timer.hour': '1 hour'`.
- [ ] **Step 2: Implement** `src/pages/TimerPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { Button, Sheet } from '@/components/ui';
import { TimePicker } from '@/components/TimePicker';
import { timerView } from '@/utils/timer';
import { formatAlarmTime } from '@/utils/time';
import { audioService } from '@/services';

const PRESETS = [1, 5, 10, 15, 30, 60];
const R = 108; // ring radius
const C = 2 * Math.PI * R;

export function TimerPage() {
  const t = useT();
  const endsAt = useStore((s) => s.timerEndsAt);
  const duration = useStore((s) => s.timerDurationMs);
  const hour24 = useStore((s) => s.settings.hour24);
  const startTimer = useStore((s) => s.startTimer);
  const cancelTimer = useStore((s) => s.cancelTimer);
  const ringing = useStore((s) => s.ringing);
  const [now, setNow] = useState(Date.now());
  const [custom, setCustom] = useState<{ h: number; m: number } | null>(null);

  const running = endsAt != null && endsAt > now && !ringing;
  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = (ms: number) => {
    if (!audioService.isUnlocked()) void audioService.unlock();
    setNow(Date.now());
    startTimer(ms);
  };

  return (
    <div className="space-y-6 pb-24">
      <h1 className="pt-6 text-[1.75rem] font-semibold tracking-tight">{t('timer.title')}</h1>

      {running && endsAt != null ? (
        <div className="flex flex-col items-center gap-6 pt-4">
          {(() => {
            const v = timerView(endsAt, duration, now);
            const end = new Date(endsAt);
            return (
              <>
                <div className="relative grid h-64 w-64 place-items-center">
                  <svg viewBox="0 0 240 240" className="absolute inset-0 -rotate-90" aria-hidden="true">
                    <circle cx="120" cy="120" r={R} fill="none" strokeWidth="8" className="stroke-surface-2" />
                    <circle
                      cx="120"
                      cy="120"
                      r={R}
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      className="stroke-accent"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - v.progress)}
                      style={{ transition: 'stroke-dashoffset 0.25s linear' }}
                    />
                  </svg>
                  <span className="tnum text-5xl font-light" role="timer" aria-live="off">
                    {v.label}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {t('timer.ringsAt', { time: formatAlarmTime(end.getHours(), end.getMinutes(), hour24) })}
                </p>
                <Button variant="secondary" size="lg" onClick={cancelTimer}>
                  {t('timer.cancel')}
                </Button>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m * 60_000)}
              className="glass flex h-20 items-center justify-center rounded-2xl text-lg font-semibold transition active:scale-[0.97]"
            >
              {m === 60 ? t('timer.hour') : t('timer.minutesShort', { n: m })}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustom({ h: 0, m: 20 })}
            className="col-span-3 h-14 rounded-2xl bg-accent-soft text-base font-semibold text-accent"
          >
            {t('timer.custom')}
          </button>
        </div>
      )}

      {custom && (
        <Sheet
          open
          onClose={() => setCustom(null)}
          title={t('timer.customTitle')}
          footer={
            <Button
              variant="primary"
              full
              disabled={custom.h === 0 && custom.m === 0}
              onClick={() => {
                start((custom.h * 60 + custom.m) * 60_000);
                setCustom(null);
              }}
            >
              {t('timer.start')} · {t('timer.hm', { h: custom.h, m: custom.m })}
            </Button>
          }
        >
          <TimePicker hour={custom.h} minute={custom.m} hour24 onChange={(h, m) => setCustom({ h, m })} />
        </Sheet>
      )}
    </div>
  );
}
```

  Check that `Button` accepts `disabled`. If it doesn't, guard inside `onClick` instead.

- [ ] **Step 3:** In `src/components/QuickTimer.tsx`, delete the `Timer` component and any imports only it used. Run `grep -rn "Timer }" src` and expect no remaining import of `Timer` from QuickTimer.
- [ ] **Step 4:** Run `npx tsc -b && npm test --silent`. Expected: clean, and all tests pass.
- [ ] **Step 5:** Commit `feat: timer tab with presets, custom and countdown ring`.

---

### Task 6: Verify and release v1.8.0

- [ ] **Step 1: Browser at 412×915, dark and light.** Check that:
  - The editor's main section shows only time, days, label, sound and snooze.
  - "More options" contains every setting from Review Focus 5.
  - Clearing all days shows "Once" in the list after saving.
  - The Timer tab shows its presets, Custom opens the h/m reel, and the ring counts down with "Rings at …".
  - Cancel returns to the presets.
- [ ] **Step 2: Emulator APK.**
  - Edit a spent one-off alarm and save without changing the time. It shows on and arms natively (`dumpsys alarm`, `pending alarms` section).
  - Start a 1-minute timer, lock the phone, and confirm it rings natively.
  - Use the editor's Delete, then Undo.
- [ ] **Step 3:** Version 1.8.0 (`npm version 1.8.0 --no-git-tag-version`, `src/version.ts`). Commit `chore: v1.8.0`.
- [ ] **Step 4:** Final whole-branch review (one fresh reviewer, opus), fix Critical/Important with tests, then PR → CI → squash-merge → tag `v1.8.0` → Release with the APK.
