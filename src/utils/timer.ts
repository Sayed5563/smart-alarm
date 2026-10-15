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
