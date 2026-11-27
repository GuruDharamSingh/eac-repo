"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./store";
import type { Module } from "./types";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const secs = (t?: string) => {
  const m = /^(\d+):(\d{2})$/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

/** The cover expanded for a video, fake player bar, timestamped notes. */
export function Theater({ m }: { m: Module }) {
  const w = useWorkspace();
  const watch = m.steps.find((s) => s.kind === "watch");
  const total = secs(watch?.duration) || 1122;
  const [t, setT] = useState(390);
  const [playing, setPlaying] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((x) => (x + 1 >= total ? (setPlaying(false), total) : x + 1)), 1000);
    return () => window.clearInterval(id);
  }, [playing, total]);

  const notes = w.entries
    .filter((e) => e.moduleId === m.id && e.kind === "note" && e.personId === w.viewer.id)
    .sort((a, b) => secs(a.timestamp) - secs(b.timestamp));
  const doneIds = w.done[w.viewer.id] ?? [];
  const nDone = m.steps.filter((s) => doneIds.includes(s.id)).length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    w.addEntry({ kind: "note", moduleId: m.id, stepId: watch?.id, timestamp: mmss(t), text: text.trim() });
    setText("");
  };

  return (
    <div className="ws-theater">
      <div className="ws-theater-top">
        <span className="ws-muted">{w.course?.title} · {m.title}</span>
        <button type="button" className="ws-btn ws-btn-small" onClick={() => w.setTheater(false)}>Exit theater</button>
      </div>
      <div className="ws-screen">
        <span className="ws-cover-label">[video: {watch?.videoLabel ?? m.coverLabel ?? "session video"}, {mmss(total)}]</span>
      </div>
      <div className="ws-player">
        <button type="button" className="ws-btn ws-btn-small" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
        <span className="ws-time">{mmss(t)}</span>
        <input type="range" min={0} max={total} value={t} aria-label="Position" onChange={(e) => setT(Number(e.target.value))} className="ws-scrub" />
        <span className="ws-time">{mmss(total)}</span>
      </div>
      <h2 className="ws-h2">Your notes on this video <span className="ws-muted ws-small">Only you see these</span></h2>
      <ul className="ws-notes">
        {notes.length === 0 ? <li className="ws-muted">No notes yet.</li> : null}
        {notes.map((n) => (
          <li key={n.id}>
            <button type="button" className="ws-stamp" onClick={() => setT(secs(n.timestamp))}>{n.timestamp}</button>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
      <form className="ws-noteform" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Add a note at ${mmss(t)}`} aria-label={`Add a note at ${mmss(t)}`} />
        <button type="submit" className="ws-btn ws-btn-mod" disabled={!text.trim()}>Add</button>
      </form>
      <div className="ws-actions">
        <button type="button" className="ws-btn ws-btn-mod" onClick={() => w.setSheet("steps")}>Steps · {nDone} of {m.steps.length}</button>
      </div>
    </div>
  );
}
