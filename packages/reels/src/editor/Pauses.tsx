'use client';

// Suggested cuts: the pauses in a recording, from its transcript job
// (render.mjs: ffmpeg silencedetect on the same audio whisper.cpp hears,
// migration 231). A transcript from before that has words only; then the
// gaps between words stand in. Each pause is offered with a little air kept
// at both ends, so speech is not clipped; cutting works on the source like
// any other cut, and "Put it back" on the Recording row undoes it.

import * as React from 'react';
import type { ReelSegment } from '../types';
import type { TranscriptState } from './TextFields';

export interface Pause {
  /** The silence, source seconds. */
  s: number;
  e: number;
  /** The stretch to cut: the silence less the air kept at each end. */
  a: number;
  b: number;
}

/** Pauses at least `min` s long, cut to keep `keep` s at each end; from silences, else word gaps. */
export function findPauses(state: TranscriptState, min: number, keep: number): { list: Pause[]; fromWords: boolean } {
  const tr = state.tr;
  if (!tr || tr.status !== 'done') return { list: [], fromWords: false };
  let raw = tr.pauses ?? null;
  const fromWords = !raw;
  if (!raw) {
    const w = tr.words ?? [];
    raw = [];
    if (w[0] && w[0].s > 0) raw.push({ s: 0, e: w[0].s });
    for (let i = 0; i + 1 < w.length; i++) if (w[i + 1].s > w[i].e) raw.push({ s: w[i].e, e: w[i + 1].s });
  }
  const list = raw
    .filter((p) => p.e - p.s >= min)
    .map((p) => ({ ...p, a: p.s + keep, b: p.e - keep }))
    .filter((p) => p.b - p.a >= 0.2);
  return { list, fromWords };
}

/** The part of a pause still in the edit (not already cut). */
export function keptOf(p: Pause, segs: ReelSegment[]): number {
  let n = 0;
  for (const g of segs) n += Math.max(0, Math.min(p.b, g.to) - Math.max(p.a, g.from));
  return n;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};

export function PausesPanel({
  state,
  segs,
  min,
  keep,
  setMin,
  setKeep,
  cut,
  seekSource,
  close,
}: {
  state: TranscriptState;
  segs: ReelSegment[];
  min: number;
  keep: number;
  setMin(v: number): void;
  setKeep(v: number): void;
  /** Cut these stretches (source seconds) out of the edit. */
  cut(ranges: Array<{ a: number; b: number }>): void;
  seekSource(sec: number): void;
  close(): void;
}) {
  const { list, fromWords } = findPauses(state, min, keep);
  const open = list.filter((p) => keptOf(p, segs) > 0.05);
  const saves = open.reduce((n, p) => n + keptOf(p, segs), 0);
  const { tr, running, error, start, available } = state;
  return (
    <section className="vs-slot tl-inspect pz">
      <header>
        <b>Pauses</b>
        <button type="button" className="vs-link" onClick={close}>
          Close
        </button>
      </header>
      {!available ? (
        <p className="vs-faint">Finding pauses needs the renderer’s speech-to-text, which is not available here.</p>
      ) : !tr || tr.status === 'failed' ? (
        <div className="vs-row">
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => void start()}>
            Find pauses
          </button>
          <span className="vs-faint">Listens to the recording once (the same pass gives subtitles).</span>
          {tr?.status === 'failed' && <span className="studio-err">{tr.error}</span>}
          {error && <span className="studio-err">{error}</span>}
        </div>
      ) : running ? (
        <p className="vs-faint">Listening to the recording… {tr.status === 'queued' ? 'waiting for the renderer' : `${Math.round(tr.progress * 100)}%`}</p>
      ) : (
        <>
          <div className="vs-row">
            <label className="vs-field">
              Pauses longer than {min.toFixed(1)} s
              <input type="range" min={0.4} max={3} step={0.1} value={min} onChange={(e) => setMin(Number(e.target.value))} />
            </label>
            <label className="vs-field">
              Keep {keep.toFixed(2)} s each side
              <input type="range" min={0} max={0.5} step={0.05} value={keep} onChange={(e) => setKeep(Number(e.target.value))} />
            </label>
          </div>
          <div className="vs-row">
            <b>
              {open.length} {open.length === 1 ? 'pause' : 'pauses'} · {fmt(saves)}
            </b>
            <button type="button" className="studio-btn studio-btn--primary" disabled={!open.length} onClick={() => cut(open)}>
              Cut all {open.length} (saves {fmt(saves)})
            </button>
            {fromWords && (
              <span className="vs-faint">From the gaps between words; “Listen again” in Subtitles also measures the silences.</span>
            )}
          </div>
          {open.length > 0 && (
            <ol className="pz-list">
              {open.map((p) => (
                <li key={`${p.s}`}>
                  <button type="button" className="sb-time" title="Go to this pause" onClick={() => seekSource(Math.max(0, p.s - 1))}>
                    {fmt(p.s)}
                  </button>
                  <span>{(p.e - p.s).toFixed(1)} s</span>
                  <button type="button" className="vs-link" onClick={() => cut([p])}>
                    Cut
                  </button>
                </li>
              ))}
            </ol>
          )}
          <p className="vs-faint">Pauses show on the Recording row. A cut pause can be put back by clicking it there.</p>
        </>
      )}
    </section>
  );
}
