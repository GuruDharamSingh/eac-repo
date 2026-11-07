'use client';

// Inspector parts for the clip timeline's two text kinds (templates/clip.tsx):
//   TextFields      free text anywhere in the frame
//   SubtitlesPanel  speech-to-text → cues, every line editable as text, the
//                   style of all of them, and a .srt for the platforms
// Cues are in source seconds (types.ts ReelCue): a cut made later hides the
// lines inside it, and putting the part back shows them again.

import * as React from 'react';
import { FPS, segmentFrames } from '../templates/clip';
import { cuesFromWords, toSrt } from '../templates/subtitles';
import type { ReelCue, ReelOverlayItem, ReelSegment } from '../types';
import type { VideoTranscript } from './types';

type Patch = (p: Partial<ReelOverlayItem>) => void;

/** Where a cue shows in the edit: its overlap with each kept part, in output seconds. */
export function cueOutput(cue: Pick<ReelCue, 'from' | 'to'>, segs: ReelSegment[]): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let start = 0;
  for (const g of segs) {
    const a = Math.max(cue.from, g.from);
    const b = Math.min(cue.to, g.to);
    if (b - a > 0.05) out.push({ from: start + a - g.from, to: start + b - g.from });
    start += segmentFrames(g) / FPS;
  }
  return out;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};

function StyleFields({ item, patch, sizeDefault }: { item: ReelOverlayItem; patch: Patch; sizeDefault: number }) {
  const size = item.size ?? sizeDefault;
  return (
    <div className="vs-row">
      <label className="vs-field">
        Font
        <select value={item.font ?? 'sans'} onChange={(e) => patch({ font: e.target.value as ReelOverlayItem['font'] })}>
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Typewriter</option>
        </select>
      </label>
      <label className="vs-field">
        Size ({size}%)
        <input type="range" min={2} max={20} step={0.2} value={size} onChange={(e) => patch({ size: Number(e.target.value) })} />
      </label>
      <label className="vs-field">
        Colour
        <input type="color" value={item.color ?? '#f3efe7'} onChange={(e) => patch({ color: e.target.value })} />
      </label>
      <label className="vs-check">
        <input type="checkbox" checked={item.weight === 'bold'} onChange={(e) => patch({ weight: e.target.checked ? 'bold' : 'normal' })} />
        Bold
      </label>
    </div>
  );
}

/** Nine places to put text, plus fine sliders. */
const SPOTS: Array<[string, number, number]> = [
  ['↖', 18, 14], ['↑', 50, 14], ['↗', 82, 14],
  ['←', 18, 50], ['•', 50, 50], ['→', 82, 50],
  ['↙', 18, 86], ['↓', 50, 86], ['↘', 82, 86],
];

export function TextFields({ item, patch }: { item: ReelOverlayItem; patch: Patch }) {
  const x = item.x ?? 50;
  const y = item.y ?? 50;
  return (
    <>
      <label className="vs-field">
        Text
        <textarea rows={3} maxLength={400} value={item.text ?? ''} onChange={(e) => patch({ text: e.target.value })} />
      </label>
      <StyleFields item={item} patch={patch} sizeDefault={6} />
      <div className="vs-row">
        <div className="tx-spots" role="group" aria-label="Place">
          {SPOTS.map(([label, sx, sy]) => (
            <button
              key={label}
              type="button"
              className="studio-btn"
              aria-pressed={Math.abs(x - sx) < 1 && Math.abs(y - sy) < 1}
              onClick={() => patch({ x: sx, y: sy, align: sx < 40 ? 'left' : sx > 60 ? 'right' : 'center' })}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="vs-field">
            Across ({Math.round(x)}%)
            <input type="range" min={0} max={100} step={1} value={x} onChange={(e) => patch({ x: Number(e.target.value) })} />
          </label>
          <label className="vs-field">
            Down ({Math.round(y)}%)
            <input type="range" min={0} max={100} step={1} value={y} onChange={(e) => patch({ y: Number(e.target.value) })} />
          </label>
        </div>
      </div>
      <div className="vs-row">
        <label className="vs-field">
          Align
          <select value={item.align ?? 'center'} onChange={(e) => patch({ align: e.target.value as ReelOverlayItem['align'] })}>
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="vs-check">
          <input type="checkbox" checked={!!item.box} onChange={(e) => patch({ box: e.target.checked })} />
          Dark box behind
        </label>
      </div>
    </>
  );
}

/** A recording's transcript as the timeline sees it: fetched once, polled while it runs. */
export interface TranscriptState {
  /** Speech-to-text is offered here at all. */
  available: boolean;
  tr: VideoTranscript | null;
  running: boolean;
  error: string | null;
  start(): Promise<void>;
}

export function useTranscript(transcript?: { start(): Promise<VideoTranscript | null>; get(): Promise<VideoTranscript | null> }): TranscriptState {
  const [tr, setTr] = React.useState<VideoTranscript | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setTr(null);
    if (!transcript) return;
    let stop = false;
    void transcript.get().then((t) => !stop && setTr(t));
    return () => {
      stop = true;
    };
  }, [transcript]);
  const running = tr?.status === 'queued' || tr?.status === 'running';
  React.useEffect(() => {
    if (!running || !transcript) return;
    const t = window.setInterval(() => void transcript.get().then(setTr), 3000);
    return () => window.clearInterval(t);
  }, [running, transcript]);
  const start = React.useCallback(async () => {
    setError(null);
    const t = await transcript?.start();
    if (!t) return setError('Could not start. Is the clip saved?');
    setTr(t);
  }, [transcript]);
  return { available: !!transcript, tr, running, error, start };
}

export interface SubtitlesPanelProps {
  item: ReelOverlayItem;
  patch: Patch;
  segs: ReelSegment[];
  /** Playhead in source seconds (null past the clip). */
  srcAt: number | null;
  seekSource(sec: number): void;
  /** Cut a stretch of the source out of the edit. */
  cutSource(from: number, to: number): void;
  /** Add a free text overlay (a line turned into text). */
  addText(item: Omit<ReelOverlayItem, 'id'>): void;
  transcript: TranscriptState;
  name?: string;
}

export function SubtitlesPanel({ item, patch, segs, srcAt, seekSource, cutSource, addText, transcript, name }: SubtitlesPanelProps) {
  const cues = React.useMemo(() => item.cues ?? [], [item.cues]);
  const { tr, running, error: err, start, available } = transcript;
  const listRef = React.useRef<HTMLOListElement>(null);

  const setCues = (next: ReelCue[]) => patch({ cues: next.slice().sort((a, b) => a.from - b.from) });
  const patchCue = (id: string, p: Partial<ReelCue>) => setCues(cues.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const useWords = () => {
    if (!tr?.words?.length) return;
    if (cues.length && !window.confirm('Replace the lines you have with the transcript?')) return;
    setCues(cuesFromWords(tr.words));
  };

  // Keep the line under the playhead in view.
  const current = srcAt === null ? undefined : cues.find((c) => srcAt >= c.from && srcAt < c.to);
  React.useEffect(() => {
    if (!current) return;
    listRef.current?.querySelector(`[data-cue="${current.id}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadSrt() {
    const out = cues.flatMap((c) => cueOutput(c, segs).map((r) => ({ ...r, text: c.text })));
    const blob = new Blob([toSrt(out)], { type: 'application/x-subrip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(name || 'subtitles').replace(/[^\w.-]+/g, '-')}.srt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      {available && (
        <div className="vs-row sb-transcript">
          {!tr || tr.status === 'failed' ? (
            <button type="button" className="studio-btn studio-btn--primary" onClick={() => void start()}>
              {tr?.status === 'failed' ? 'Try again' : 'Make subtitles from speech'}
            </button>
          ) : running ? (
            <span className="vs-faint">
              Listening to the recording… {tr.status === 'queued' ? 'waiting for the renderer' : `${Math.round(tr.progress * 100)}%`}
            </span>
          ) : (
            <>
              <span className="vs-faint">Transcript ready: {tr.words?.length ?? 0} words.</span>
              <button type="button" className="studio-btn studio-btn--primary" onClick={useWords}>
                {cues.length ? 'Replace lines with the transcript' : 'Use the transcript'}
              </button>
              <button type="button" className="vs-link" onClick={() => void start()}>
                Listen again
              </button>
            </>
          )}
          {tr?.status === 'failed' && <span className="studio-err">{tr.error}</span>}
          {err && <span className="studio-err">{err}</span>}
        </div>
      )}
      {!available && <p className="vs-faint">Speech-to-text is not available here; add lines by hand.</p>}

      <StyleFields item={item} patch={patch} sizeDefault={4.2} />
      <div className="vs-row">
        <label className="vs-field">
          Place
          <select value={item.place ?? 'bottom'} onChange={(e) => patch({ place: e.target.value as 'top' | 'bottom' })}>
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </label>
        <label className="vs-check">
          <input type="checkbox" checked={item.box !== false} onChange={(e) => patch({ box: e.target.checked })} />
          Dark box behind
        </label>
        <label className="vs-check">
          <input type="checkbox" checked={!!item.highlight} onChange={(e) => patch({ highlight: e.target.checked ? '#f2c14e' : '' })} />
          Colour each word as it is spoken
        </label>
        {item.highlight ? <input type="color" aria-label="Spoken word colour" value={item.highlight} onChange={(e) => patch({ highlight: e.target.value })} /> : null}
      </div>

      <div className="vs-row">
        <b>{cues.length} lines</b>
        <button
          type="button"
          className="studio-btn"
          disabled={srcAt === null}
          onClick={() => {
            if (srcAt === null) return;
            const c: ReelCue = { id: `c${Date.now().toString(36)}`, from: Number(srcAt.toFixed(2)), to: Number((srcAt + 2).toFixed(2)), text: '' };
            setCues([...cues, c]);
          }}
        >
          + Line at playhead
        </button>
        <button type="button" className="studio-btn" disabled={!cues.length} onClick={downloadSrt}>
          Download .srt
        </button>
      </div>
      <ol className="sb-cues" ref={listRef}>
        {cues.map((c) => {
          const shown = cueOutput(c, segs);
          const edited = !!c.words?.length && c.words.map((w) => w.w).join(' ') !== c.text;
          return (
            <li key={c.id} data-cue={c.id} data-current={current?.id === c.id ? 'true' : undefined} data-cut={shown.length ? undefined : 'true'}>
              <button type="button" className="sb-time" title="Go to this line" onClick={() => seekSource(c.from + 0.01)}>
                {shown.length ? fmt(shown[0].from) : 'cut'}
              </button>
              <textarea
                rows={1}
                value={c.text}
                maxLength={240}
                // Editing keeps the words until the text no longer matches; then the line shows plain.
                onChange={(e) => patchCue(c.id, { text: e.target.value })}
                aria-label={`Line at ${fmt(c.from)} in the recording`}
              />
              <span className="sb-acts">
                <button type="button" className="vs-link" title="Start this line at the playhead" disabled={srcAt === null || srcAt >= c.to} onClick={() => srcAt !== null && patchCue(c.id, { from: Number(srcAt.toFixed(2)) })}>
                  ⇤
                </button>
                <button type="button" className="vs-link" title="End this line at the playhead" disabled={srcAt === null || srcAt <= c.from} onClick={() => srcAt !== null && patchCue(c.id, { to: Number(srcAt.toFixed(2)) })}>
                  ⇥
                </button>
                <button
                  type="button"
                  className="vs-link"
                  title="Turn this line into a text overlay"
                  disabled={!shown.length}
                  onClick={() => addText({ kind: 'text', at: Number(shown[0].from.toFixed(1)), seconds: Number(Math.max(0.5, shown[0].to - shown[0].from).toFixed(1)), text: c.text, x: 50, y: 50, size: 6 })}
                >
                  T
                </button>
                <button type="button" className="vs-link" title="Cut this stretch out of the clip" disabled={!shown.length} onClick={() => cutSource(c.from, c.to)}>
                  ✂
                </button>
                <button type="button" className="vs-link" title="Delete this line" onClick={() => setCues(cues.filter((x) => x.id !== c.id))}>
                  ×
                </button>
              </span>
              {edited && <small className="vs-faint">edited: shown as plain text</small>}
            </li>
          );
        })}
      </ol>
      <p className="vs-faint">
        Lines follow the recording: cut a stretch and its lines go with it. ✂ cuts a line’s stretch out of the clip; T makes it a free text overlay.
      </p>
    </>
  );
}
