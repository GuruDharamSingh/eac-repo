'use client';

// The recording as text, for finding and cutting (render.mjs transcripts,
// migration 229) and its sound level drawn on the Recording row (migration
// 232). Words are in source seconds, like the cuts: a word is "cut" when its
// middle is outside every kept part. Selecting words and cutting them takes
// half of the gap on each side, so the join keeps one natural pause.

import * as React from 'react';
import type { ReelSegment } from '../types';
import type { TranscriptState } from './TextFields';
import type { VideoTranscript } from './types';

type Word = { w: string; s: number; e: number; b?: number };

/** At most this many columns are drawn; longer recordings are max-pooled down. */
const WAVE_COLUMNS = 12000;

/** The waveform over the filmstrip: an SVG stretched to the track, so zoom costs nothing. */
export function Waveform({ peaks, source }: { peaks: VideoTranscript['peaks']; source: number }) {
  const path = React.useMemo(() => {
    if (!peaks?.data || !(source > 0)) return null;
    let bytes: Uint8Array;
    try {
      const bin = atob(peaks.data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return null;
    }
    // The peaks cover the audio, which can be a little shorter or longer than the clip.
    const span = Math.min(bytes.length, Math.round(source * peaks.rate));
    const step = Math.max(1, Math.ceil(span / WAVE_COLUMNS));
    const cols = Math.ceil(span / step);
    let d = `M0 255`;
    for (let c = 0; c < cols; c++) {
      let m = 0;
      for (let k = c * step; k < Math.min(span, (c + 1) * step); k++) if (bytes[k] > m) m = bytes[k];
      d += `V${255 - m}h1`;
    }
    return { d: `${d}V255Z`, w: (source * peaks.rate) / step };
  }, [peaks, source]);
  if (!path) return null;
  return (
    <svg className="tl-wave" viewBox={`0 0 ${path.w} 255`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path.d} />
    </svg>
  );
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s - m * 60)).padStart(2, '0')}`;
};

/** Whether a word is still in the edit (its middle inside a kept part). */
function kept(w: Word, segs: ReelSegment[]): boolean {
  const mid = (w.s + w.e) / 2;
  return segs.some((g) => mid >= g.from && mid < g.to);
}

/** The stretch to cut for words i..j: from the middle of the gap before to the middle of the gap after. */
export function wordSpan(words: Word[], i: number, j: number): { a: number; b: number } {
  const prev = words[i - 1];
  const next = words[j + 1];
  const a = prev ? (prev.e + words[i].s) / 2 : words[i].s;
  const b = next ? (words[j].e + next.s) / 2 : words[j].e;
  return { a, b };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, '').trim();

export function WordsPanel({
  state,
  segs,
  srcAt,
  seekSource,
  cut,
  putBack,
  close,
}: {
  state: TranscriptState;
  segs: ReelSegment[];
  /** Playhead in source seconds; null past the clip. */
  srcAt: number | null;
  seekSource(sec: number): void;
  cut(a: number, b: number): void;
  putBack(a: number, b: number): void;
  close(): void;
}) {
  const { tr, running, error, start, available } = state;
  const words = React.useMemo<Word[]>(() => (tr?.status === 'done' ? tr.words ?? [] : []), [tr]);
  const [query, setQuery] = React.useState('');
  const [hit, setHit] = React.useState(0);
  // Selection: an anchor word and the word the pointer or Shift+click reached.
  const [sel, setSel] = React.useState<{ a: number; b: number } | null>(null);
  const dragging = React.useRef(false);
  const box = React.useRef<HTMLDivElement>(null);

  const keptFlags = React.useMemo(() => words.map((w) => kept(w, segs)), [words, segs]);
  const current = srcAt === null ? -1 : words.findIndex((w, i) => srcAt >= w.s && srcAt < (words[i + 1]?.s ?? w.e));

  // Search on whole words in sequence, ignoring case and punctuation.
  const matches = React.useMemo(() => {
    const q = norm(query).split(/\s+/).filter(Boolean);
    if (!q.length) return [] as number[];
    const flat = words.map((w) => norm(w.w));
    const out: number[] = [];
    for (let i = 0; i + q.length <= flat.length; i++) {
      let ok = true;
      for (let k = 0; k < q.length && ok; k++) ok = k === q.length - 1 ? flat[i + k].startsWith(q[k]) : flat[i + k] === q[k];
      if (ok) out.push(i);
    }
    return out;
  }, [query, words]);
  const qLen = norm(query).split(/\s+/).filter(Boolean).length;
  const inMatch = React.useMemo(() => {
    const s = new Set<number>();
    for (const m of matches) for (let k = 0; k < qLen; k++) s.add(m + k);
    return s;
  }, [matches, qLen]);

  const reveal = (i: number) => {
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    const c = box.current;
    if (!el || !c) return;
    // Scroll the list only, never the page.
    const top = el.offsetTop - c.offsetTop;
    if (top < c.scrollTop || top > c.scrollTop + c.clientHeight - 24) c.scrollTop = top - c.clientHeight / 3;
  };
  const goHit = (k: number) => {
    if (!matches.length) return;
    const n = ((k % matches.length) + matches.length) % matches.length;
    setHit(n);
    setSel({ a: matches[n], b: matches[n] + qLen - 1 });
    seekSource(Math.max(0, words[matches[n]].s - 0.3));
    reveal(matches[n]);
  };

  // Follow the playhead while nothing is selected.
  React.useEffect(() => {
    if (current >= 0 && !sel && !dragging.current) reveal(current);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const lo = sel ? Math.min(sel.a, sel.b) : -1;
  const hi = sel ? Math.max(sel.a, sel.b) : -1;
  const selCount = sel ? hi - lo + 1 : 0;
  const selKept = sel ? keptFlags.slice(lo, hi + 1).filter(Boolean).length : 0;
  const span = sel ? wordSpan(words, lo, hi) : null;

  function onKey(e: React.KeyboardEvent) {
    if (!sel || !span) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      if (selKept) cut(span.a, span.b);
      setSel(null);
    } else if (e.key === 'Escape') setSel(null);
  }

  // Paragraphs: whisper's segment starts, or a pause of 1.5 s or more.
  const paras: number[][] = [];
  words.forEach((w, i) => {
    if (!paras.length || (i > 0 && (w.b || w.s - words[i - 1].e >= 1.5))) paras.push([]);
    paras[paras.length - 1].push(i);
  });

  return (
    <section className="vs-slot tl-inspect wd" onKeyDown={onKey}>
      <header>
        <b>Words</b>
        <button type="button" className="vs-link" onClick={close}>
          Close
        </button>
      </header>
      {!available ? (
        <p className="vs-faint">The words need the renderer’s speech-to-text, which is not available here.</p>
      ) : !tr || tr.status === 'failed' ? (
        <div className="vs-row">
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => void start()}>
            Listen to the recording
          </button>
          <span className="vs-faint">Writes out what is said, once; the same pass finds the pauses and draws the sound.</span>
          {tr?.status === 'failed' && <span className="studio-err">{tr.error}</span>}
          {error && <span className="studio-err">{error}</span>}
        </div>
      ) : running ? (
        <p className="vs-faint">Listening to the recording… {tr.status === 'queued' ? 'waiting for the renderer' : `${Math.round(tr.progress * 100)}%`}</p>
      ) : !words.length ? (
        <p className="vs-faint">No speech was heard in this recording.</p>
      ) : (
        <>
          <div className="vs-row wd-bar">
            <input
              type="search"
              className="wd-find"
              placeholder="Find words…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHit(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goHit(e.shiftKey ? hit - 1 : matches.length && sel && matches[hit] === lo ? hit + 1 : hit);
                }
              }}
            />
            {query.trim() && (
              <span className="vs-faint">
                {matches.length ? `${hit + 1} of ${matches.length}` : 'Not found'}
              </span>
            )}
            {matches.length > 1 && (
              <>
                <button type="button" className="studio-btn" onClick={() => goHit(hit - 1)} aria-label="Previous">
                  ↑
                </button>
                <button type="button" className="studio-btn" onClick={() => goHit(hit + 1)} aria-label="Next">
                  ↓
                </button>
              </>
            )}
            <span className="tl-grow" />
            {sel && span && (
              <>
                <span className="vs-faint">
                  {selCount} {selCount === 1 ? 'word' : 'words'} · {(span.b - span.a).toFixed(1)} s
                </span>
                {selKept > 0 && (
                  <button
                    type="button"
                    className="studio-btn studio-btn--primary"
                    onClick={() => {
                      cut(span.a, span.b);
                      setSel(null);
                    }}
                  >
                    Cut {selCount === 1 ? 'it' : 'them'}
                  </button>
                )}
                {selKept < selCount && (
                  <button
                    type="button"
                    className="studio-btn"
                    onClick={() => {
                      putBack(span.a, span.b);
                      setSel(null);
                    }}
                  >
                    Put back
                  </button>
                )}
                <button type="button" className="vs-link" onClick={() => setSel(null)}>
                  Clear
                </button>
              </>
            )}
          </div>
          <div className="wd-text" ref={box} tabIndex={-1}>
            {paras.map((p) => (
              <p key={p[0]}>
                <button type="button" className="sb-time" title="Go here" onClick={() => seekSource(words[p[0]].s)}>
                  {fmt(words[p[0]].s)}
                </button>{' '}
                {p.map((i) => (
                  <React.Fragment key={i}>
                    <span
                      data-i={i}
                      className="wd-w"
                      data-cut={keptFlags[i] ? undefined : 'true'}
                      data-now={i === current ? 'true' : undefined}
                      data-sel={i >= lo && i <= hi ? 'true' : undefined}
                      data-hit={inMatch.has(i) ? 'true' : undefined}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        box.current?.focus({ preventScroll: true });
                        if (e.shiftKey && sel) setSel({ a: sel.a, b: i });
                        else {
                          dragging.current = true;
                          setSel({ a: i, b: i });
                          seekSource(words[i].s);
                        }
                      }}
                      onPointerEnter={() => {
                        if (dragging.current && sel) setSel({ a: sel.a, b: i });
                      }}
                    >
                      {words[i].w}
                    </span>{' '}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
          <p className="vs-faint">
            Click a word to go there; drag or Shift+click to select, then Cut (or Delete). Struck-through words are cut; select them and Put back.
          </p>
        </>
      )}
    </section>
  );
}
