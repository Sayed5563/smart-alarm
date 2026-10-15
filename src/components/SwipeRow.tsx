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
  const start = useRef<{
    x: number;
    y: number;
    base: number;
    intent: ReturnType<typeof swipeIntent>;
  } | null>(null);

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
