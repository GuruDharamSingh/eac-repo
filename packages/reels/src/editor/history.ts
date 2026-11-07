'use client';

// Undo and redo for a reel's edit (VideoKind). Each change pushes the edit
// before it; changes less than `gap` ms apart (one drag, a run of typing) are
// one step. Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and Ctrl+Y redo, outside text
// fields (they keep their own undo).

import * as React from 'react';

export interface EditHistory {
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useEditHistory<T>(value: T | null, apply: (next: T) => void, gap = 700, limit = 100) {
  const past = React.useRef<T[]>([]);
  const future = React.useRef<T[]>([]);
  const last = React.useRef(0);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);

  /** Record `value` as a step (unless the last change was moments ago) and apply `next`. */
  const change = (next: T) => {
    const now = Date.now();
    if (value !== null && now - last.current > gap) {
      past.current.push(value);
      if (past.current.length > limit) past.current.shift();
    }
    last.current = now;
    future.current = [];
    apply(next);
  };
  const step = (from: React.MutableRefObject<T[]>, to: React.MutableRefObject<T[]>) => {
    const prev = from.current.pop();
    if (prev === undefined || value === null) return;
    to.current.push(value);
    last.current = 0;
    apply(prev);
    redraw();
  };
  const history: EditHistory = {
    undo: () => step(past, future),
    redo: () => step(future, past),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
  /** Forget everything (another reel was opened). */
  const reset = () => {
    past.current = [];
    future.current = [];
    last.current = 0;
  };

  const keys = React.useRef(history);
  keys.current = history;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) keys.current.undo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') keys.current.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { change, history, reset };
}
