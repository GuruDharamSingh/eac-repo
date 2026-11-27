"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./store";
import type { Course } from "./types";

/** Four questions in a sheet from the right. */
export function NewWorkshopSheet({ onClose }: { onClose: () => void }) {
  const w = useWorkspace();
  const [title, setTitle] = useState("");
  const [line, setLine] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState<Course["where"]>("In person");
  const [sessions, setSessions] = useState(6);
  const [ongoing, setOngoing] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    w.createCourse({ title, line, when, where, sessions: ongoing ? 1 : Math.max(1, sessions), ongoing });
    onClose();
  };

  return (
    <div className="ws-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="ws-newsheet" onSubmit={submit} aria-label="New workshop">
        <h2>New workshop</h2>
        <label className="ws-q">
          <span>What is it called?</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clay and Breath" />
        </label>
        <label className="ws-q">
          <span>Say it in one line</span>
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Six evenings of slow hand-building." />
        </label>
        <label className="ws-q">
          <span>When does it start?</span>
          <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Thu 14 Jan, 7:00 pm" />
          <small>A date like 14 Jan lets the sessions be dated weekly.</small>
        </label>
        <fieldset className="ws-q">
          <legend>Where?</legend>
          <div className="ws-seg">
            {(["In person", "Online", "Both"] as const).map((o) => (
              <button key={o} type="button" className="ws-mode" aria-pressed={where === o} onClick={() => setWhere(o)}>{o}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="ws-q">
          <legend>How many sessions?</legend>
          <div className="ws-seg">
            <button type="button" className="ws-mode" aria-pressed={!ongoing} onClick={() => setOngoing(false)}>A number of sessions</button>
            <button type="button" className="ws-mode" aria-pressed={ongoing} onClick={() => setOngoing(true)}>Ongoing (no end date)</button>
          </div>
          {ongoing ? <small>One ongoing session with a step that repeats every day or week. You can add more later.</small> : (
            <input type="number" aria-label="Number of sessions" min={1} max={24} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} />
          )}
        </fieldset>
        <div className="ws-row">
          <button type="submit" className="ws-btn ws-btn-primary" disabled={!title.trim()}>Create workshop</button>
          <button type="button" className="ws-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
