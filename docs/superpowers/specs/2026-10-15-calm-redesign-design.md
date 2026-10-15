# Calm & minimal redesign — design

Date: 2026-10-15 · App version at start: v1.6.0

## Goal

Make Smart Alarm feel professional, premium, simple and easy to use, in the
style of the iPhone / Pixel clock apps. Nothing is deleted. Features the user
doesn't use day to day move under **Settings → Advanced**.

**Success:** a new alarm takes three taps (+, set time, Save). Every screen has
one obvious main action. No screen shows browser-only or developer-level
options by default.

## What the user chose

- Style: **calm & minimal**. Keep the warm sunrise alarm screen.
- Kept up front: **quick timer** and the **+5 / +10 / +15 min** quick alarms.
- Moved under Advanced (kept working, not deleted): wake-up tasks (as a
  default), profiles, quiet hours, history & stats.
- Main screen top: **small clock + next alarm** (no giant clock).

## 1. Navigation

Three tabs: **Alarms · Timer · Settings** (`Route` = `alarms | timer | settings`).

- The `history` route stays reachable from Settings → Advanced. Deep links to
  `#/home` and `#/history` go to `#/alarms` and `#/settings/advanced/history`,
  so old bookmarks still open something sensible.
- `home` is removed. The Alarms tab is the landing screen.

## 2. Alarms screen (`pages/Alarms.tsx`, replaces Home + Alarms)

Top to bottom:

1. **Header.** Small current time and date (`Thu 15 Oct · 9:54`, muted). Below
   it, the large title **"Alarms"** and the subtitle **"Next in 7 h 20 min"**
   (or "No alarms on"). The subtitle uses the amber accent.
2. **Quick alarms.** One row of chips: `+5 min` `+10 min` `+15 min`. Each
   creates a one-off alarm (existing `quickSet`) and shows a toast with Undo.
3. **Alarm list.** One row per alarm, sorted by time of day (not next-ring
   order, so the list doesn't reshuffle):
   - big light time (`6:45` + small `AM`), label · repeat summary (`Gym · Mon,
     Wed, Fri`, `Every day`, `Weekdays`, `Once`), and small icon badges for an
     active wake-up task / after-stop sound.
   - an on/off switch on the right. A disabled row is dimmed.
   - **tap** → editor. **Swipe left** → red Delete. Deleting shows a toast
     with **Undo** (store keeps the deleted alarm for 5 s).
   - Spent one-off alarms (`repeat: 'once'` that already rang) show as off.
4. **Empty state.** Moon icon, "No alarms yet", and a primary "Add alarm"
   button.
5. **+ button.** Round amber floating button, bottom right above the tab bar.

Removed from this screen: the giant clock, "Test alarm" (now *Preview* in the
editor), the timer row (now its own tab), and the web "Enable alarm sounds"
card. On the web that card becomes a one-line banner shown only when audio is
locked.

## 3. Timer tab (`pages/Timer.tsx`, from `QuickTimer.Timer`)

- **Idle.** A 3×2 grid of presets (1, 5, 10, 15, 30, 60 min) and a "Custom"
  button that opens a minutes/seconds wheel (reuses `TimePicker` styling).
- **Running.** A large countdown ring (SVG, stroke shrinks smoothly) with
  `mm:ss` in the centre, the end time below ("Rings at 10:42"), and a Cancel
  button. Backed by the existing store `timerEndsAt`, so it survives switching
  tabs, and natively it rings with the phone locked (v1.6.0).

## 4. Editor (`components/AlarmEditor.tsx`)

A full-height sheet. Header: Cancel · "New alarm" / "Edit alarm" · **Save**
(amber).

Main section, always visible:

1. **Time wheel**, large.
2. **Days.** Seven round letter toggles `M T W T F S S`. None selected = once.
   The `repeat` / `customDays` model stays the same. The toggles map to it:
   all 7 → `daily`, Mon–Fri → `weekdays`, Sat+Sun → `weekends`, otherwise
   `custom`. The old Once/Weekdays/Weekends/Every-day chips are removed.
3. **Label** (single text field, placeholder "Alarm").
4. **Sound** row → existing `SoundPicker` (shows the sound name).
5. **Snooze** row → 5 / 10 / 15 / 20 min segmented, or Off.

**More options** (a collapsed row, opens in place): volume, fade-in,
vibration, after-stop sound, wake-up task, pre-alarm, category, ring during
quiet hours, strong alert.

Footer (editing only): **Preview** (native test ring, v1.6.0) and **Delete
alarm** (red text, with confirm).

## 5. Settings (`pages/Settings.tsx`)

Short grouped lists, iOS style (rounded group, hairline dividers, a chevron
on rows that open a sub-page):

- **Alarms:** default sound ›, default snooze, default vibration, default
  volume.
- **Appearance:** theme (Light / Dark / System), 24-hour time.
- **Permissions** (phone app only): exact alarms, full-screen alarm, appear
  on top, each with a status dot (green ✓ / amber "Allow").
- **Advanced ›** opens a sub-page: Wake-up task default · Strong alert
  default · Quiet hours › · Profiles › · History › · Clock style, font,
  seconds, accent colour, wallpaper, reduce motion · Backup (export/import) ·
  Reset (danger).
- **About:** version, privacy.

Sub-pages use hash routes (`#/settings/advanced`, `#/settings/advanced/history`)
with a back chevron. `useHashRoute` gains a simple path segment.

## 6. Visual language

- **Colour.** Near-black background (`#06070A`) with graded surfaces. **One
  accent: warm amber**, the default (blue becomes an Advanced option). Danger
  red only for delete/reset.
- **Type.** System sans. Times in a light weight with tabular numbers. Titles
  semibold, 28 px. Body 15 px. Muted text has ~60 % contrast.
- **Surfaces.** Flat rounded groups (`rounded-2xl`) on a solid surface
  colour. The heavy 20 px glass blur is removed from list rows (it costs GPU
  on every scroll). It stays only on the tab bar and on sheets over a
  wallpaper.
- **Motion.** One easing (`--ease-out-soft`), 180–240 ms. Sheets slide up.
  Swipe-to-delete follows the finger. List insert/remove fades. All motion
  respects Reduce motion.
- **Touch.** Targets ≥ 44 px. Pressed states on every row and button.

## Out of scope

The native alarm/ringing screen (already redesigned in v1.5.0, unchanged),
the scheduler, and the data model (no migrations; only UI over the same store).

## Testing

- Unit tests for the new pure helpers: days ↔ `repeat` mapping, the repeat
  summary text, the "next in" text, and the sort-by-time-of-day order.
- Existing 90 tests keep passing.
- Visual check of every screen at 412×915 (S22 width) in the browser, light
  and dark. Then an emulator pass on the APK: add/edit/delete/undo, quick
  alarms, timer, and settings sub-pages with back navigation.

## Delivery

Phased releases, each usable on its own:

1. v1.7.0 — navigation + Alarms screen + swipe/undo.
2. v1.8.0 — editor + Timer tab.
3. v1.9.0 — Settings regrouping + visual polish pass.
