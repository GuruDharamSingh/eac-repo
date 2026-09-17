/**
 * Movement from the on-screen thumbstick.
 *
 * Deliberately a plain mutable object rather than React (or zustand) state: a
 * thumbstick reports on every pointermove, and routing that through a store
 * would re-render the whole room dozens of times a second to move the camera a
 * few centimetres. The DOM control writes here, the frame loop reads it, and
 * nothing re-renders. Module-level like the gallery store, which already
 * assumes one room per page.
 */
export interface TouchMove {
  /** -1 (left) to 1 (right). */
  x: number;
  /** -1 (forward) to 1 (back). */
  y: number;
}

const move: TouchMove = { x: 0, y: 0 };

export function setTouchMove(x: number, y: number): void {
  move.x = x;
  move.y = y;
}

export function clearTouchMove(): void {
  move.x = 0;
  move.y = 0;
}

/** Live object — read its fields, do not hold onto it across frames. */
export function readTouchMove(): Readonly<TouchMove> {
  return move;
}
