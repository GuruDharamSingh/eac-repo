// ============================================================================
// Record mode's playhead (2026-11-18): a tiny store outside React state, so the
// stage can follow every frame while the settings panel re-renders only a few
// times a second (usePlayback's `hz`).
// ============================================================================

import * as React from "react";

export interface PlaybackState {
  /** The playhead, ms from the start of the timeline. */
  ms: number;
  playing: boolean;
  /** A live take (MediaRecorder) or a frame-by-frame render (the render drives the playhead itself). */
  take: "idle" | "recording" | "rendering";
}

export type Playback = ReturnType<typeof createPlayback>;

export function createPlayback() {
  let state: PlaybackState = { ms: 0, playing: false, take: "idle" };
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<PlaybackState>) {
      state = { ...state, ...patch };
      for (const fn of subs) fn();
    },
    subscribe(fn: () => void): () => void {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}

/** A still playhead for places that aren't in record mode. */
export const STILL_PLAYBACK = createPlayback();

/** True while the timeline is running (Play, a take or a render): shaders then follow its clock. */
export const isRunning = (s: PlaybackState) => s.playing || s.take !== "idle";
/** True while the playhead should advance in real time (Play or a live take; a render sets it per frame). */
export const isClocked = (s: PlaybackState) => s.playing || s.take === "recording";

/**
 * Follow a slice of the playback. `hz` throttles re-renders (the settings panel uses 4); without
 * it the component re-renders on every change (the stage).
 */
export function usePlayback<T>(pb: Playback, pick: (s: PlaybackState) => T, hz?: number): T {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const pickRef = React.useRef(pick);
  pickRef.current = pick;
  const shown = React.useRef<T>(pick(pb.get()));
  React.useEffect(() => {
    let lastAt = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const show = () => { lastAt = performance.now(); shown.current = pickRef.current(pb.get()); force(); };
    const off = pb.subscribe(() => {
      const v = pickRef.current(pb.get());
      if (Object.is(v, shown.current)) return;
      if (!hz) return show();
      const gap = 1000 / hz;
      const since = performance.now() - lastAt;
      if (since >= gap) show();
      else if (!pending) pending = setTimeout(() => { pending = null; show(); }, gap - since);
    });
    return () => { off(); if (pending) clearTimeout(pending); };
  }, [pb, hz]);
  return hz ? shown.current : pick(pb.get());
}
