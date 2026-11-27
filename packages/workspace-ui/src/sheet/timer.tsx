"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import "./sheet.css";

// Timers live at module level so they keep running while the sheet changes view.
interface T { total: number; base: number; startedAt: number | null }
const timers = new Map<string, T>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snap = () => version;

function remainingOf(t: T, now: number) {
  return t.startedAt == null ? t.base : t.base - (now - t.startedAt) / 1000;
}

export function useTimer(key: string, minutes: number) {
  useSyncExternalStore(subscribe, snap, snap);
  const [now, setNow] = useState(() => Date.now());
  let t = timers.get(key);
  if (!t || (t.total !== minutes * 60 && t.startedAt == null && t.base === t.total)) {
    t = { total: minutes * 60, base: minutes * 60, startedAt: null };
    timers.set(key, t);
  }
  const running = t.startedAt != null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [running]);
  const remaining = Math.max(0, Math.ceil(remainingOf(t, running ? now : Date.now())));
  const cur = t;
  return {
    remaining, running, total: cur.total, expired: remaining <= 0,
    start() {
      const c = timers.get(key); if (!c || c.startedAt != null) return;
      if (c.base <= 0) c.base = c.total;
      c.startedAt = Date.now(); emit();
    },
    pause() {
      const c = timers.get(key); if (!c || c.startedAt == null) return;
      c.base = Math.max(0, remainingOf(c, Date.now())); c.startedAt = null; emit();
    },
    reset() {
      const c = timers.get(key); if (!c) return;
      c.base = c.total; c.startedAt = null; emit();
    },
  };
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function TimerView({ id, minutes, label }: { id: string; minutes: number; label?: string }) {
  const t = useTimer(id, minutes);
  return (
    <div className={`ws-hm-timer${t.expired ? " is-zero" : ""}`} role="group" aria-label={label ?? "Timer"}>
      <div className="ws-hm-timerface" role="timer" aria-live="off">{mmss(t.remaining)}</div>
      <div className="ws-hm-timerbtns">
        {t.running
          ? <button type="button" className="ws-sh-btn" onClick={t.pause}>Pause</button>
          : <button type="button" className="ws-sh-btn ws-sh-primary" onClick={t.start}>{t.remaining < t.total && !t.expired ? "Resume" : "Start"}</button>}
        <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={t.reset}>Reset</button>
      </div>
      {t.expired ? <p className="ws-hm-timerdone" role="status">Time is up.</p> : null}
    </div>
  );
}

/** A free timer for any step: the participant picks the minutes. */
export function FreeTimer() {
  const [mins, setMins] = useState(10);
  const [uid] = useState(() => Math.random().toString(36).slice(2, 7));
  return (
    <div>
      <div className="ws-sh-field">
        <label htmlFor={`ws-ft-${uid}`} className="ws-sh-label">Minutes</label>
        <input id={`ws-ft-${uid}`} className="ws-sh-input ws-sh-short" type="number" min={1} max={240} value={mins}
          onChange={(e) => setMins(Math.max(1, Math.min(240, Number(e.target.value) || 1)))} />
      </div>
      <TimerView id="free" minutes={mins} label="Free timer" />
    </div>
  );
}
