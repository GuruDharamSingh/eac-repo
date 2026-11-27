"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../store";
import type { Module, Step } from "../types";
import { KINDS } from "./kinds";
import { TimerView } from "./timer";
import { fmtDue } from "./deadline";
import "./sheet.css";

const Icon = ({ d }: { d: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CHECK = "M3 8.5l3.2 3L13 4.5";
const LOCK = "M5 7V5.5a3 3 0 016 0V7M4 7h8v6H4z";

export function isLocked(steps: Step[], i: number, mine: string[]) {
  return steps.slice(0, i).some((s) => s.required && !mine.includes(s.id));
}

/** The steps sheet on its own (sheet === "steps"). */
export function StepsSheet() {
  const w = useWorkspace();
  const { course, mode, selected, viewer, done, setSheet } = w;
  const mod = course?.modules.find((m) => m.id === selected) ?? null;
  const mine = done[viewer.id] ?? [];
  const participant = mode === "participant";
  const doneCount = mod ? mod.steps.filter((s) => mine.includes(s.id)).length : 0;

  return (
    <aside className="ws-sh" aria-label="Steps">
      <header className="ws-sh-head">
        <div className="ws-sh-headrow">
          <h2 className="ws-sh-title">{mod ? mod.title : "Steps"}</h2>
          <div className="ws-sh-headbtns">
            <button type="button" className="ws-sh-btn" onClick={() => { w.setOpenStep(null); setSheet("home"); }}>Overview</button>
            {participant && (
              <button type="button" className="ws-sh-btn" onClick={() => w.setFrame("journal")}>Journal</button>
            )}
          </div>
        </div>
        {participant && mod && mod.steps.length > 0 && (
          <div className="ws-sh-progress">
            <span>{doneCount} of {mod.steps.length}</span>
            <div className="ws-sh-bar" aria-hidden="true"><div style={{ width: `${(doneCount / mod.steps.length) * 100}%` }} /></div>
          </div>
        )}
      </header>
      <div className="ws-sh-scroll">
        <StepsDoing />
      </div>
    </aside>
  );
}

/** The doing list: used inside home and on its own. Chooses by mode. */
export function StepsDoing() {
  const { course, mode, selected, viewer, done } = useWorkspace();
  const mod = course?.modules.find((m) => m.id === selected) ?? null;
  const mine = done[viewer.id] ?? [];
  if (!course) return <p className="ws-sh-meta">No workshop yet.</p>;
  if (!mod) return <ModulePicker />;
  if (mode === "edit") return <ReadList mod={mod} />;
  if (mode === "guide") return <GuideList mod={mod} />;
  return <DoList mod={mod} mine={mine} />;
}

function ModulePicker() {
  const { course, mode, viewer, done, select } = useWorkspace();
  if (!course) return null;
  const mine = done[viewer.id] ?? [];
  return (
    <div>
      <p className="ws-sh-meta">Steps belong to a session. Pick a session to see its steps.</p>
      <ul className="ws-sh-list">
        {course.modules.map((m) => {
          const n = m.steps.filter((s) => mine.includes(s.id)).length;
          return (
            <li key={m.id}>
              <button type="button" className="ws-sh-row-btn" onClick={() => select(m.id)}>
                <span>{m.title}</span>
                <span className="ws-sh-meta">{mode === "participant" ? `${n} of ${m.steps.length}` : `${m.steps.length} steps`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DoList({ mod, mine }: { mod: Module; mine: string[] }) {
  const { completeStep, openStep, setOpenStep, setFrame } = useWorkspace();
  const firstOpen = mod.steps.findIndex((s, i) => !mine.includes(s.id) && !isLocked(mod.steps, i, mine));
  const [picked, setPicked] = useState<string | null>(openStep);
  useEffect(() => { if (openStep) setPicked(openStep); }, [openStep]);
  useEffect(() => { setPicked(openStep); }, [mod.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = mod.steps.find((s) => s.id === picked) ?? mod.steps[firstOpen] ?? null;
  if (mod.steps.length === 0) return <p className="ws-sh-meta">This session has no steps yet.</p>;
  const def = current ? KINDS[current.kind] : null;
  const currentDone = current ? mine.includes(current.id) : false;
  return (
    <div>
      <ol className="ws-sh-list">
        {mod.steps.map((s, i) => {
          const isDone = mine.includes(s.id);
          const locked = !isDone && isLocked(mod.steps, i, mine);
          const isCur = current?.id === s.id;
          return (
            <li key={s.id}>
              <button type="button" disabled={locked} aria-current={isCur ? "step" : undefined}
                className={`ws-sh-step${isCur ? " is-current" : ""}${isDone ? " is-done" : ""}${locked ? " is-locked" : ""}`}
                onClick={() => setPicked(s.id)}>
                <span className="ws-sh-dot" aria-hidden="true">{isDone ? <Icon d={CHECK} /> : locked ? <Icon d={LOCK} /> : null}</span>
                <span className="ws-sh-chip">{KINDS[s.kind].label}</span>
                <span className="ws-sh-steptitle">{s.title}</span>
                <span className="ws-sh-sr">{isDone ? "done" : locked ? "locked" : isCur ? "current" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {current && def && (
        <section className="ws-sh-card" aria-label={`Step: ${current.title}`}>
          <div className="ws-hm-cardhead">
            <h3 className="ws-sh-cardtitle">{current.title}</h3>
            <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => { setOpenStep(current.id); setFrame("step"); }}>Open large</button>
          </div>
          {current.due ? <p className="ws-sh-meta">Due {fmtDue(current.due)}</p> : null}
          {current.timeLimit ? <TimerView id={`step-${current.id}`} minutes={current.timeLimit} label={`Timer for ${current.title}`} /> : null}
          {def.Do({ step: current, moduleId: mod.id, hasVideo: !!mod.hasVideo, done: currentDone })}
          <div className="ws-sh-foot">
            {currentDone ? (
              <span className="ws-sh-saved">Step complete.</span>
            ) : (
              <button type="button" className="ws-sh-btn ws-sh-primary" onClick={() => completeStep(current.id)}>Mark step complete</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Editing: the step editors live on the main page; the sheet shows the list only. */
function ReadList({ mod }: { mod: Module }) {
  return (
    <div>
      <h3 className="ws-sh-sub">Steps for this session</h3>
      {mod.steps.length === 0 ? (
        <p className="ws-sh-meta">No steps yet.</p>
      ) : (
        <ol className="ws-sh-list">
          {mod.steps.map((s) => (
            <li key={s.id} className="ws-sh-guiderow">
              <span className="ws-sh-chip">{KINDS[s.kind].label}</span>
              <span className="ws-sh-steptitle">{s.title || "Untitled step"}{s.required ? " (required)" : ""}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="ws-sh-foot-note">Edit steps on the page.</p>
    </div>
  );
}

function GuideList({ mod }: { mod: Module }) {
  const { people, done } = useWorkspace();
  const group = people.filter((p) => p.role === "participant");
  if (mod.steps.length === 0) return <p className="ws-sh-meta">This session has no steps yet.</p>;
  return (
    <div>
      <p className="ws-sh-meta">Steps as participants see them, with how many have finished each.</p>
      <ol className="ws-sh-list">
        {mod.steps.map((s) => {
          const n = group.filter((p) => (done[p.id] ?? []).includes(s.id)).length;
          return (
            <li key={s.id} className="ws-sh-guiderow">
              <span className="ws-sh-chip">{KINDS[s.kind].label}</span>
              <span className="ws-sh-steptitle">{s.title}{s.required ? " (required)" : ""}</span>
              <span className="ws-sh-meta">{n} of {group.length}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
export default StepsSheet;
