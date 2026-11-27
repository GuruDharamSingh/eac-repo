"use client";

import { useRef } from "react";
import { useWorkspace } from "./store";
import { KINDS } from "./sheet/kinds";
import { isLocked } from "./sheet/StepsSheet";
import { TimerView } from "./sheet/timer";
import { fmtDue } from "./sheet/deadline";
import { StepView } from "./readonly/StepView";
import { Frame } from "./Frame";
import type { Module, Step } from "./types";

const Icon = ({ d }: { d: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CHECK = "M3 8.5l3.2 3L13 4.5";
const LOCK = "M5 7V5.5a3 3 0 016 0V7M4 7h8v6H4z";
const LEFT = "M10 3L5 8l5 5";
const RIGHT = "M6 3l5 5-5 5";

/**
 * The module's steps as a compact numbered list (one line each), a header strip for the selected step, and the
 * step itself in the page: its words, and for a seated participant the doing controls. Used by every mode but editing.
 */
export function StepsPane({ m }: { m: Module }) {
  const w = useWorkspace();
  const listRef = useRef<HTMLOListElement>(null);
  const mine = w.done[w.viewer.id] ?? [];
  const lockedAt = (s: Step, i: number) => {
    if (mine.includes(s.id)) return false;
    if (w.readOnly) return w.canDo && w.doing?.access[s.id]?.allowed === false;
    return w.mode === "participant" && isLocked(m.steps, i, mine);
  };
  if (m.steps.length === 0) return <section className="ws-ms" aria-label="Steps"><Frame level={2} title="Steps"><p className="ws-muted">No steps in this section yet.</p></Frame></section>;
  const idx = Math.max(0, m.steps.findIndex((s) => s.id === w.openStep));
  const sel = m.steps[idx];
  const selLocked = lockedAt(sel, idx);
  const pick = (i: number) => { const s = m.steps[i]; if (s && !lockedAt(s, i)) w.setOpenStep(s.id); };
  const move = (dir: 1 | -1) => { for (let i = idx + dir; i >= 0 && i < m.steps.length; i += dir) if (!lockedAt(m.steps[i], i)) { w.setOpenStep(m.steps[i].id); return; } };
  const hasPrev = m.steps.some((s, i) => i < idx && !lockedAt(s, i));
  const hasNext = m.steps.some((s, i) => i > idx && !lockedAt(s, i));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };
  const showDone = (w.readOnly && w.canDo) || (!w.readOnly && w.mode === "participant");
  const nDone = m.steps.filter((s) => mine.includes(s.id)).length;
  const isDone = mine.includes(sel.id);
  const reason = w.doing?.access[sel.id]?.reason;
  return (
    <section className="ws-ms ws-sp" aria-label="Steps">
      <Frame level={2} title={`Steps${showDone ? ` · ${nDone} of ${m.steps.length}` : ""}`} className="ws-frame-steps">
      <ol ref={listRef} className="ws-sl" tabIndex={0} aria-label="Steps in this session. Use the arrow keys to move." onKeyDown={onKey}>
        {m.steps.map((s, i) => {
          const done = showDone && mine.includes(s.id);
          const locked = lockedAt(s, i);
          return (
            <li key={s.id}>
              <button type="button" tabIndex={-1} disabled={locked} aria-current={i === idx ? "step" : undefined}
                className={`ws-sl-row${i === idx ? " is-on" : ""}${locked ? " is-locked" : ""}`} onClick={() => { pick(i); listRef.current?.focus(); }}>
                <span className="ws-sl-n">{i + 1}</span>
                <span className="ws-sl-t">{s.title}</span>
                <span className="ws-badge is-kind">{KINDS[s.kind].label}</span>
                <span className="ws-sl-i">{done ? <Icon d={CHECK} /> : locked ? <Icon d={LOCK} /> : null}</span>
                {done || locked ? <span className="ws-sh-sr">{done ? "done" : "locked"}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      </Frame>
      <section className="ws-frame ws-frame-step" aria-label="The selected step">
      <div className="ws-frame-head ws-sp-head" role="group" aria-label="Selected step">
        <button type="button" className="ws-sh-btn ws-sh-btn-quiet" aria-label="Previous step" disabled={!hasPrev} onClick={() => move(-1)}><Icon d={LEFT} /></button>
        <span className="ws-sp-count">Step {idx + 1} of {m.steps.length}</span>
        <strong className="ws-sp-title">{sel.title}</strong>
        <span className="ws-badge is-kind">{KINDS[sel.kind].label}</span>
        <button type="button" className="ws-sh-btn ws-sh-btn-quiet" aria-label="Next step" disabled={!hasNext} onClick={() => move(1)}><Icon d={RIGHT} /></button>
      </div>
      <div className="ws-frame-body ws-sp-body">
        {selLocked ? <p className="ws-sh-meta" role="status">Locked. {reason ?? "Not open yet."}</p> : <StepBody m={m} step={sel} done={isDone} />}
      </div>
      </section>
    </section>
  );
}

function StepBody({ m, step, done }: { m: Module; step: Step; done: boolean }) {
  const w = useWorkspace();
  // Read only, or a guide looking: the words, plus the doing controls for a seated participant.
  if (w.readOnly || w.mode !== "participant") return <StepView step={step} />;
  const def = KINDS[step.kind];
  return (
    <div>
      {step.due ? <p className="ws-sh-meta">Due {fmtDue(step.due)}</p> : null}
      {step.timeLimit ? <TimerView id={`step-${step.id}`} minutes={step.timeLimit} label={`Timer for ${step.title}`} /> : null}
      {def.Do({ step, moduleId: m.id, hasVideo: !!m.hasVideo, done })}
      <div className="ws-sh-foot">
        {done ? <span className="ws-sh-saved">Step complete.</span> : <button type="button" className="ws-sh-btn ws-sh-primary" onClick={() => w.completeStep(step.id)}>Mark step complete</button>}
      </div>
    </div>
  );
}
