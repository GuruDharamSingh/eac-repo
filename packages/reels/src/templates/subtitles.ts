// Subtitles for the clip template: transcript words → cues, and the cue
// showing at a source time. Cues are in source seconds (types.ts ReelCue),
// so cuts made after the subtitles still line up.

import type { ReelCue, ReelWord } from '../types';

/** A cue is closed at a phrase start, a pause, or when it would grow past these. */
const MAX_CHARS = 64;
const MAX_SECONDS = 5.5;
const PAUSE = 0.8;

let seq = 0;
const cueId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Group transcript words into subtitle lines. */
export function cuesFromWords(words: ReelWord[]): ReelCue[] {
  const cues: ReelCue[] = [];
  let cur: ReelWord[] = [];
  const close = () => {
    if (!cur.length) return;
    cues.push({ id: cueId(), from: cur[0].s, to: Math.max(cur[cur.length - 1].e, cur[0].s + 0.6), text: cur.map((w) => w.w).join(' '), words: cur });
    cur = [];
  };
  for (const w of words) {
    if (cur.length) {
      const last = cur[cur.length - 1];
      const chars = cur.reduce((n, x) => n + x.w.length + 1, 0) + w.w.length;
      const sentenceEnd = /[.?!]$/.test(last.w) && chars > 24;
      if (w.b || w.s - last.e > PAUSE || chars > MAX_CHARS || w.e - cur[0].s > MAX_SECONDS || sentenceEnd) close();
    }
    cur.push(w);
  }
  close();
  // A cue runs until the next one starts when the gap is short, so lines do not flicker.
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i + 1].from - cues[i].to < 0.5) cues[i].to = cues[i + 1].from;
  }
  return cues;
}

/** The cue on screen at source second `t`, if any. */
export function cueAt(cues: ReelCue[] | undefined, t: number): ReelCue | undefined {
  if (!cues?.length) return undefined;
  // Cues are few hundred at most; a linear scan per frame is fine.
  for (const c of cues) if (t >= c.from && t < c.to) return c;
  return undefined;
}

/** Whether a cue's text still matches its words (an edited line drops the word highlight). */
export const cueWordsMatch = (c: ReelCue) => !!c.words?.length && c.words.map((w) => w.w).join(' ') === c.text;

/** SubRip (.srt) text for cues already mapped to output seconds. */
export function toSrt(cues: Array<{ from: number; to: number; text: string }>): string {
  const ts = (x: number) => {
    const ms = Math.max(0, Math.round(x * 1000));
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return cues.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join('\n');
}
