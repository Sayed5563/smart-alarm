# Architecture notes

Short explanations of the decisions that aren't obvious from the code.

## 1. One timer, not one per alarm

`AlarmScheduler` never creates an interval per alarm. Instead:

1. `utils/schedule.ts` is a **pure** function set. `nextEventForAlarm(alarm,
   settings, now)` returns the single soonest event that alarm will produce —
   accounting for repeat rules, an active snooze, the pre‑alarm, and quiet
   hours. `nextEvent(...)` folds that over every active alarm.
2. The scheduler arms **one** `setTimeout`, capped at 30 seconds, then
   recomputes. Short caps mean background throttling, device sleep and
   system‑clock changes can never push us more than ~30s off, without the cost
   of thousands of timers.
3. A 20‑second heartbeat plus `visibilitychange` / `focus` / `online` listeners
   force an immediate `sync()` so a throttled timer can't make us miss an alarm.
4. Fires are de‑duplicated by a `alarmId:kind:minuteKey` set so a resync storm
   can't double‑ring within the same minute.

Because the scheduler only depends on `configure(getState, onDue)` it is trivial
to unit test (`peek()` returns the next event without arming anything) and to
replace with a native implementation.

## 2. The store is the single source of truth

`useStore` (Zustand + `persist`) holds everything. The scheduler reads a
snapshot through `getState()` and re‑syncs on every store change
(`useStore.subscribe`). Side effects (audio, vibration, notifications) live in
React effects in `App.tsx` and `AlarmRinging.tsx`, not in the store, so the
store stays serialisable and testable.

`ringing` and `lastToast` are in‑memory only (stripped by `partialize` and reset
by `merge`).

## 3. The ringing state machine

`AlarmRinging` is the only place that orchestrates a live alarm.

```
beginRing(alarm, kind)
   │  history entry created (outcome: 'missed' until resolved)
   ▼
ringing  ──Snooze──▶  addSnooze(): snoozedUntil = now + N,  ringing = null
   │                  (recurring schedule untouched; snoozeCount++)
   │
   └──Stop──▶  wakeUpTask == none ? doStop()
                                  : show task  ──solved──▶ doStop()
                                               └─failed──▶ recordTaskFailure()
   doStop():
      stop audio + vibration
      afterStop.enabled ?
         phase = 'after-stop'
           behavior 'stoppable'    → show "Stop after‑sound" → finish()
           behavior 'must-finish'  → wait for sound 'ended'  → finish()
      : finish()
   finish(outcome): clear safety timer, stop all audio, endRing(outcome)
```

Safety: a hard `GLOBAL_MAX_MS` (15 min) caps every alarm; Strong Alert can only
*shorten* it (`min(GLOBAL_MAX_MS, maxDurationMinutes*60000)`), never extend.
The pre‑alarm caps at 3 minutes, the after‑sound at 3 minutes.

## 4. Wallpaper brightness drives contrast — not the theme mode

The only content that sits directly on the wallpaper is the big clock and a few
section labels; everything else is inside a `.glass` card with its own
background. If we coloured that bare text by *theme mode*, a light theme with a
dark wallpaper would be unreadable.

So `<html data-wallpaper-scrim="dark|light">` (set pre‑paint in `index.html` and
maintained by `App.tsx`) drives **all** surface / text / border tokens. Theme
mode still chooses the *default* wallpaper (`'default'` → Ink in dark, Paper in
light) and the accent colour. Picking any non‑default (dark) wallpaper flips the
chrome to its dark treatment, which is what you want.

## 5. Audio without files

`AudioService.renderRecipe()` turns a tiny `SoundRecipe` (wave, note list, note
duration, envelope, optional detune/tremolo) into an `AudioBuffer` via
`OfflineAudioContext`, cached per sound id, then looped with a
`AudioBufferSourceNode`. Uploaded sounds are `decodeAudioData`'d into the same
kind of buffer. One code path, gapless loops, easy `stop()` with a short gain
ramp. `unlock()` (called from a user gesture) resumes the context and plays a
1‑sample silent buffer.

## 6. `useNow` — one clock for the whole app

A module‑level `Set` of listeners driven by a single `setTimeout` that
re‑aligns to the wall clock every tick (`1000 - (Date.now() % 1000)`), so it
never drifts and recovers instantly after sleep. Components choose `'second'` or
`'minute'` granularity; minute‑granularity components don't re‑render every
second.

## 7. Validation everywhere data crosses a trust boundary

- `sanitizeAlarm()` runs on every persisted alarm at load and on every imported
  alarm.
- `isPlausibleExportBundle()` gates imports before anything is applied.
- `validateUpload()` checks MIME type and size for audio (≤ 8 MB) and images
  (≤ 12 MB pre‑resize) before touching storage.
- Store setters clamp `volume`, `snoozeMinutes`, `maxDurationMinutes`.

## 8. i18n / RTL readiness

`t(key, vars)` looks up `LANGUAGES[code].dict`, falls back to English, and does
`{var}` interpolation. Layout uses logical Tailwind utilities and
`document.documentElement.dir` is set from the active language, so a future
`ar` entry with `dir: 'rtl'` mirrors the UI with no component changes.
