"use client";

import * as React from "react";
import type { WordArtDoc } from "./doc";
import { isClocked, isRunning, usePlayback, type Playback } from "./playback";
import {
  MAX_TAKE_MS, TRACKS, addLookKey, addTrackKey, animatedTracks, lookEase, lookKeyTimes, moveTrackKey, removeLookKey, removeTrackKey,
  setLookEase, setTrackKeyEase, timelineEnd, type Ease,
} from "./timeline";

// ============================================================================
// The keyframe strip under the word-art stage (record mode, 2026-11-18).
// Look row: + Key snapshots the design at the playhead; ◆ per key time.
// Lanes (folded): one row per setting that moves. Shot 2: a lane's dots can be
// dragged (or nudged with ←/→) to retime that setting alone, deleted, given
// their own ease, and + adds a key on that lane only.
// Every change goes through onDoc (the editor's commit, so it can be undone).
// ============================================================================

const SNAP = 100;

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
const NEAR = 1;

export function Strip({ doc, playback, onDoc, record, render }: {
  doc: WordArtDoc;
  playback: Playback;
  onDoc: (next: WordArtDoc) => void;
  /** The ● Record control (Task 6); absent = disabled. */
  record?: React.ReactNode;
  /** The Render… control (shot 2). */
  render?: React.ReactNode;
}) {
  const ms = usePlayback(playback, (s) => s.ms);
  const running = usePlayback(playback, isRunning);
  const playing = usePlayback(playback, (s) => s.playing);
  const clocked = usePlayback(playback, isClocked);
  // a take or a render owns the playhead
  const owned = usePlayback(playback, (s) => s.take !== "idle");
  const [lanesOpen, setLanesOpen] = React.useState(false);
  const tl = doc.timeline;
  const times = lookKeyTimes(tl);
  const end = timelineEnd(tl);
  const D = Math.max(end + 3000, 8000, Math.ceil(ms / 1000) * 1000);
  const keyHere = times.find((t) => Math.abs(t - ms) <= NEAR);
  const lanes = animatedTracks(tl);
  const ruler = React.useRef<HTMLDivElement>(null);
  // a selected lane dot (its ease shows in the select), and a dot being dragged
  const [sel, setSel] = React.useState<{ path: string; t: number } | null>(null);
  const [drag, setDrag] = React.useState<{ path: string; from: number; t: number; x0: number; moved: boolean } | null>(null);
  const selKey = sel ? tl?.tracks[sel.path]?.find((k) => Math.abs(k.t - sel.t) <= NEAR) : undefined;
  React.useEffect(() => { if (sel && !selKey) setSel(null); }, [sel, selKey]);
  // a dot nudged from the keyboard is a new element (its time is its key): keep the focus on it
  const root = React.useRef<HTMLDivElement>(null);
  const refocus = React.useRef<{ path: string; t: number } | null>(null);
  React.useEffect(() => {
    const f = refocus.current;
    if (!f) return;
    refocus.current = null;
    root.current?.querySelector<HTMLElement>(`[data-lane="${f.path}"][data-t="${f.t}"]`)?.focus();
  });

  // the clock: while the timeline runs, advance the playhead in real time (keeps going past the last key)
  React.useEffect(() => {
    if (!clocked) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const s = playback.get();
      const next = s.ms + (now - last);
      last = now;
      if (next >= MAX_TAKE_MS) return playback.set({ ms: MAX_TAKE_MS, playing: false });
      playback.set({ ms: next });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clocked, playback]);
  // leaving record mode stops playback
  React.useEffect(() => () => playback.set({ playing: false }), [playback]);

  const seek = (t: number) => {
    if (playback.get().take !== "idle") return; // a take or a render owns the playhead
    playback.set({ ms: Math.round(Math.min(MAX_TAKE_MS, Math.max(0, t))) });
  };
  const fromPointer = (e: React.PointerEvent) => {
    const r = ruler.current?.getBoundingClientRect();
    if (r && r.width > 0) seek(((e.clientX - r.left) / r.width) * D);
  };
  const play = () => {
    if (playing) return playback.set({ playing: false });
    // from the playhead; from 0 when it sits at (or past) the end of the timeline
    if (end > 0 && ms >= end) playback.set({ ms: 0 });
    playback.set({ playing: true });
  };
  const onPlayheadKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1000 : 100;
    if (e.key === "ArrowRight") seek(ms + step);
    else if (e.key === "ArrowLeft") seek(ms - step);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(end);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const pct = (t: number) => `${(t / D) * 100}%`;

  return (
    <div ref={root} className="wa-strip" role="region" aria-label="Keyframe strip">
      <div className="wa-strip__bar">
        <button type="button" className="studio-btn" onClick={play} disabled={running && !playing}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
        {record ?? <button type="button" className="studio-btn" disabled title="Record (coming in this build)">● Record</button>}
        {render}
        <span className="wa-strip__time" aria-live="off">{fmt(ms)}</span>
        <button type="button" className="studio-btn" onClick={() => onDoc(addLookKey(doc, ms))} disabled={running} title="Keep every setting as it is now, at the playhead">+ Key</button>
        <label className="wa-strip__ease" title={selKey && sel ? `${TRACKS[sel.path]?.label} key at ${(sel.t / 1000).toFixed(1)} s` : "The Look key under the playhead"}>
          <span>Ease from this key</span>
          <select
            disabled={(keyHere === undefined && !selKey) || running}
            value={selKey ? selKey.ease : keyHere === undefined ? "smooth" : lookEase(tl, keyHere)}
            onChange={(e) => {
              const ease = e.target.value as Ease;
              if (selKey && sel) onDoc(setTrackKeyEase(doc, sel.path, sel.t, ease));
              else if (keyHere !== undefined) onDoc(setLookEase(doc, keyHere, ease));
            }}
          >
            <option value="smooth">Smooth</option>
            <option value="linear">Linear</option>
            <option value="hold">Hold (jump at the next key)</option>
          </select>
        </label>
      </div>

      <div className="wa-strip__grid">
        <span className="wa-strip__label">Look</span>
        <div
          className="wa-strip__area"
          ref={ruler}
          onPointerDown={(e) => { if (!running) { fromPointer(e); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } }}
          onPointerMove={(e) => { if (!running && e.buttons) fromPointer(e); }}
        >
          <div className="wa-strip__ticks" aria-hidden="true">
            {Array.from({ length: Math.floor(D / 1000) + 1 }, (_, s) => (
              <span key={s} style={{ left: pct(s * 1000) }}>{s % (D > 20000 ? 5 : 1) === 0 ? `${s}s` : ""}</span>
            ))}
          </div>
          {times.map((t) => (
            <button
              key={t}
              type="button"
              data-key={t}
              className={`wa-strip__key${keyHere === t ? " is-here" : ""}`}
              style={{ left: pct(t) }}
              aria-label={`Key at ${(t / 1000).toFixed(1)} s`}
              title={`Key at ${(t / 1000).toFixed(1)} s. Delete removes it.`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { setSel(null); seek(t); }}
              onKeyDown={(e) => {
                if (e.key !== "Delete" && e.key !== "Backspace") return;
                e.preventDefault();
                e.stopPropagation();
                if (!running) onDoc(removeLookKey(doc, t));
              }}
            >◆</button>
          ))}
          <div
          className="wa-strip__playhead"
          role="slider"
          tabIndex={owned ? -1 : 0}
          aria-disabled={owned || undefined}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={MAX_TAKE_MS}
          aria-valuenow={Math.round(ms)}
          aria-valuetext={fmt(ms)}
          style={{ left: pct(ms) }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={onPlayheadKey}
          />
        </div>
        <span aria-hidden="true" />
      </div>

      <button type="button" className="wa-strip__lanes-toggle" aria-expanded={lanesOpen} onClick={() => setLanesOpen((o) => !o)}>
        Lanes ({lanes.length}) {lanesOpen ? "▾" : "▸"}
      </button>
      {lanesOpen && (
        <div className="wa-strip__lanes">
          {lanes.length === 0 && <p className="studio-hint">Settings that change between keys show here.</p>}
          {lanes.length > 0 && <p className="studio-hint">Drag a dot (or ←/→) to retime that setting alone; Delete removes it; + adds a key at the playhead.</p>}
          {lanes.map((path) => {
            const label = TRACKS[path].label;
            return (
              <div key={path} className="wa-strip__grid wa-strip__lane">
                <span className="wa-strip__label" title={label}>{label}</span>
                <div className="wa-strip__lanebar" data-lanebar={path}>
                  {(tl?.tracks[path] ?? []).map((k) => {
                    const dragging = drag && drag.path === path && drag.from === k.t;
                    const t = dragging ? drag.t : k.t;
                    const isSel = sel?.path === path && Math.abs(sel.t - k.t) <= NEAR;
                    return (
                      <button
                        key={k.t}
                        type="button"
                        data-lane={path}
                        data-t={k.t}
                        className={`wa-strip__dot${isSel ? " is-sel" : ""}`}
                        style={{ left: pct(t) }}
                        aria-label={`${label} key at ${(k.t / 1000).toFixed(1)} s`}
                        title={`${label} at ${(k.t / 1000).toFixed(1)} s (${k.ease}). Drag or ←/→ to retime, Delete removes.`}
                        disabled={running}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                          setSel({ path, t: k.t });
                          setDrag({ path, from: k.t, t: k.t, x0: e.clientX, moved: false });
                        }}
                        onPointerMove={(e) => {
                          if (!drag || drag.path !== path || drag.from !== k.t) return;
                          const bar = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                          if (!drag.moved && Math.abs(e.clientX - drag.x0) < 3) return;
                          const nt = Math.round(Math.min(MAX_TAKE_MS, Math.max(0, ((e.clientX - bar.left) / bar.width) * D)) / SNAP) * SNAP;
                          setDrag({ ...drag, t: nt, moved: true });
                        }}
                        onPointerUp={() => {
                          const d = drag;
                          setDrag(null);
                          if (!d || d.path !== path || d.from !== k.t) return;
                          if (d.moved && d.t !== d.from) { onDoc(moveTrackKey(doc, path, d.from, d.t)); setSel({ path, t: d.t }); }
                          else seek(k.t);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Delete" || e.key === "Backspace") {
                            e.preventDefault(); e.stopPropagation();
                            onDoc(removeTrackKey(doc, path, k.t)); setSel(null);
                          } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                            e.preventDefault(); e.stopPropagation();
                            const nt = Math.min(MAX_TAKE_MS, Math.max(0, k.t + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1000 : SNAP)));
                            refocus.current = { path, t: nt };
                            onDoc(moveTrackKey(doc, path, k.t, nt)); setSel({ path, t: nt });
                          }
                        }}
                        onFocus={() => setSel({ path, t: k.t })}
                      />
                    );
                  })}
                </div>
                <button type="button" className="wa-strip__add" aria-label={`Add a ${label} key at the playhead`} title={`Add a ${label} key at ${fmt(ms)}`} disabled={running} onClick={() => onDoc(addTrackKey(doc, path, ms))}>+</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
