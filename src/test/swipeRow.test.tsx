import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SwipeRow } from '@/components/SwipeRow';

// jsdom has no PointerEvent (fireEvent would drop clientX) or pointer capture.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}
HTMLElement.prototype.setPointerCapture ??= () => {};

function setup() {
  const open = vi.fn();
  const del = vi.fn();
  render(
    <SwipeRow onDelete={del} deleteLabel="Delete">
      <button onClick={open}>Open alarm</button>
    </SwipeRow>,
  );
  const row = screen.getByText('Open alarm').parentElement!;
  const drag = (dx: number, dy: number) => {
    fireEvent.pointerDown(row, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 200 + dx / 2, clientY: 100 + dy / 2, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 200 + dx, clientY: 100 + dy, pointerId: 1 });
  };
  return { open, del, drag };
}

describe('SwipeRow', () => {
  it('the row content is a real button: a click (keyboard, TalkBack) opens it', () => {
    const { open } = setup();
    fireEvent.click(screen.getByText('Open alarm'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('the click that ends a swipe does not open it, and reveals Delete', () => {
    const { open, del, drag } = setup();
    drag(-120, 4);
    fireEvent.click(screen.getByText('Open alarm'));
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('tapping an open row closes it instead of opening the alarm', () => {
    const { open, drag } = setup();
    drag(-120, 4);
    fireEvent.pointerDown(screen.getByText('Open alarm'), { clientX: 50, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(screen.getByText('Open alarm'), { clientX: 50, clientY: 100, pointerId: 2 });
    fireEvent.click(screen.getByText('Open alarm'));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});
