"use client";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../store";
import { KINDS } from "./kinds";
import { TimerView } from "./timer";
import { fmtDue, describeDue } from "./deadline";
import { isLocked } from "./StepsSheet";
import "./sheet.css";
import "../journal/journal.css"; // reuses the frame look-alike (ws-j-frame, ws-j-rail ...)

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** The open step shown large, in a local look-alike of the surface frame (head / rail / body / foot). */
export function StepFrame() {
  const w = useWorkspace();
  const { course, mode, selected, viewer, done, openStep, setOpenStep, setFrame, completeStep, updateStep, removeStep } = w;
  const ref = useRef<HTMLDivElement>(null);
  const mod = course?.modules.find((m) => m.id === selected) ?? course?.modules.find((m) => m.steps.some((s) => s.id === openStep)) ?? null;
  const step = mod?.steps.find((s) => s.id === openStep) ?? mod?.steps[0] ?? null;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(".ws-j-close")?.focus();
    return () => { prev?.focus?.(); };
  }, []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); setFrame(null); return; }
      if (ev.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const a = document.activeElement as HTMLElement | null;
      if (!a || !ref.current.contains(a)) { ev.preventDefault(); items[0].focus(); }
      else if (ev.shiftKey && a === items[0]) { ev.preventDefault(); items[items.length - 1].focus(); }
      else if (!ev.shiftKey && a === items[items.length - 1]) { ev.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [setFrame]);

  if (!course || !mod || !step) return null;
  const def = KINDS[step.kind];
  const mine = done[viewer.id] ?? [];
  const isDone = mine.includes(step.id);
  const edit = mode === "edit";
  const participant = mode === "participant";
  const due = step.due ? describeDue(step.due) : null;

  return (
    <div className="ws-j-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setFrame(null); }}>
      <div className="ws-j-frame" role="dialog" aria-modal="true" aria-label={`Step: ${step.title}`} ref={ref}>
        <header className="ws-frame__head ws-j-frame__head">
          <div className="ws-j-headings">
            <div className="ws-j-kicker">{def.label} · {mod.title}</div>
            <h2 className="ws-j-frame__title">{step.title || "Untitled step"}</h2>
          </div>
          {step.due && due ? <span className="ws-hm-dueTag">Due {fmtDue(step.due)} · {due.text}</span> : null}
          <div className="ws-j-grow" />
          <button type="button" className="ws-j-icon ws-j-close" aria-label="Close" onClick={() => setFrame(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </header>
        <div className="ws-j-frame__mid">
          <nav className="ws-frame__rail ws-j-rail" aria-label="Steps in this session">
            <ul className="ws-j-people">
              {mod.steps.map((s, i) => {
                const locked = participant && !mine.includes(s.id) && isLocked(mod.steps, i, mine);
                const on = s.id === step.id;
                return (
                  <li key={s.id}>
                    <button type="button" disabled={locked} className={`ws-j-person${on ? " is-on" : ""}`} aria-current={on ? "step" : undefined} onClick={() => setOpenStep(s.id)}>
                      <span className="ws-j-person__name">{s.title || "Untitled step"}</span>
                      <span className="ws-j-person__note">{mine.includes(s.id) ? "done" : locked ? "locked" : KINDS[s.kind].label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ws-frame__body ws-j-frame__body ws-hm-framebody">
            {edit ? (
              <>
                {def.Edit({ step, patch: (p) => updateStep(mod.id, step.id, p) })}
                <div><button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => { removeStep(mod.id, step.id); setFrame(null); }}>Remove this step</button></div>
              </>
            ) : (
              <>
                {def.Do({ step, moduleId: mod.id, hasVideo: !!mod.hasVideo, done: isDone })}
              </>
            )}
          </div>
        </div>
        <footer className="ws-frame__foot ws-j-frame__foot">
          {step.timeLimit && !edit ? <TimerView id={`step-${step.id}`} minutes={step.timeLimit} label={`Timer for ${step.title}`} /> : null}
          <div className="ws-j-grow" />
          {participant ? (
            isDone ? <span className="ws-sh-saved">Step complete.</span>
              : <button type="button" className="ws-j-btn is-accent" onClick={() => completeStep(step.id)}>Mark step complete</button>
          ) : null}
          <button type="button" className="ws-j-btn" onClick={() => setFrame(null)}>Back to the sheet</button>
        </footer>
      </div>
    </div>
  );
}
export default StepFrame;
