"use client";

import { useState } from "react";
import { useWorkspace } from "./store";
import { SAMPLE_NOW } from "./sample";
import { KINDS, KIND_ORDER } from "./sheet/kinds";
import { NEW_KINDS } from "./types";
import type { Module, Step } from "./types";

function dueText(due?: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const text = d.toLocaleString("en-CA", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return { text: `Due ${text}`, overdue: d.getTime() < new Date(SAMPLE_NOW).getTime() };
}

/** The module's steps in the main pane, in every mode. */
export function MainSteps({ m }: { m: Module }) {
  const w = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const doneIds = w.done[w.viewer.id] ?? [];
  const nDone = m.steps.filter((s) => doneIds.includes(s.id)).length;
  const label = `Steps · ${nDone} of ${m.steps.length}`;
  const large = (id: string) => { w.setOpenStep(id); w.setFrame("step"); };
  const due = (s: Step) => {
    const d = dueText(s.due);
    return (
      <>
        {d ? <span className={`ws-ms-due${d.overdue && !doneIds.includes(s.id) ? " ws-ms-overdue" : ""}`}>{d.text}</span> : null}
        {s.timeLimit ? <span className="ws-ms-due">{s.timeLimit} min</span> : null}
      </>
    );
  };

  if (w.mode === "edit") {
    return (
      <section className="ws-ms" aria-label="Steps">
        <button type="button" className="ws-btn ws-btn-mod ws-ms-toggle" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {label} {expanded ? "▾" : "▸"}
        </button>
        {m.steps.length === 0 ? <p className="ws-muted">No steps yet. Open the list to add one.</p> : null}
        {m.steps.length > 0 ? (
          <ol className="ws-ms-list">
            {m.steps.map((s, i) => {
              const isOpen = expanded && open === s.id;
              const K = KINDS[s.kind];
              return (
                <li key={s.id} className="ws-ms-row">
                  <div className="ws-ms-head">
                    {expanded ? (
                      <span className="ws-ms-move">
                        <button type="button" className="ws-linkbtn" aria-label="Move up" disabled={i === 0} onClick={() => w.moveStep(m.id, s.id, -1)}>↑</button>
                        <button type="button" className="ws-linkbtn" aria-label="Move down" disabled={i === m.steps.length - 1} onClick={() => w.moveStep(m.id, s.id, 1)}>↓</button>
                      </span>
                    ) : null}
                    <span className="ws-badge">{K.label}</span>
                    <span className="ws-ms-title">{s.title}</span>
                    {due(s)}
                    <button type="button" className="ws-linkbtn" onClick={() => large(s.id)}>Open large</button>
                    {expanded ? (
                      <button type="button" className="ws-linkbtn" aria-expanded={isOpen} aria-label="Edit this step" onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? "▾" : "▸"}</button>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <div className="ws-ms-edit">
                      {K.Edit({ step: s, patch: (p) => w.updateStep(m.id, s.id, p) })}
                      <button type="button" className="ws-linkbtn ws-danger" onClick={() => { w.removeStep(m.id, s.id); setOpen(null); }}>Remove this step</button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
        {expanded ? (
          adding ? (
            <div className="ws-ms-kinds" role="group" aria-label="Kind of step">
              {KIND_ORDER.map((k) => (
                <button key={k} type="button" className="ws-btn ws-btn-small" onClick={() => { const id = w.addStep(m.id, k); setOpen(id); setAdding(false); }}>
                  {KINDS[k].label}{NEW_KINDS.includes(k) ? <span className="ws-ms-new">new</span> : null}
                </button>
              ))}
              <button type="button" className="ws-linkbtn" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="ws-btn ws-btn-small" onClick={() => setAdding(true)}>+ Add step</button>
          )
        ) : null}
      </section>
    );
  }

  const firstUndone = m.steps.findIndex((s) => !doneIds.includes(s.id));
  const blocked = (i: number) => m.steps.slice(0, i).some((s) => s.required && !doneIds.includes(s.id));
  const guide = w.mode === "guide";
  const learners = w.people.filter((p) => p.role === "participant");
  return (
    <section className="ws-ms" aria-label="Steps">
      <h2 className="ws-h2">{guide ? "Steps" : label}</h2>
      {m.steps.length === 0 ? <p className="ws-muted">No steps in this module.</p> : null}
      <ol className="ws-ms-list">
        {m.steps.map((s, i) => {
          const isDone = doneIds.includes(s.id);
          const current = i === firstUndone;
          const locked = !guide && !isDone && !current && blocked(i);
          const count = learners.filter((p) => (w.done[p.id] ?? []).includes(s.id)).length;
          const state = isDone ? "Done" : current ? "Current" : locked ? "Locked" : "Open";
          return (
            <li key={s.id} className="ws-ms-row">
              <div className="ws-ms-head">
                {guide ? (
                  <span className="ws-badge">{count} of {learners.length} done</span>
                ) : (
                  <span className={`ws-badge ws-ms-${state.toLowerCase()}`}>{state}</span>
                )}
                <span className="ws-badge">{KINDS[s.kind].label}</span>
                <button
                  type="button" className="ws-ms-title ws-ms-pick" disabled={locked}
                  onClick={() => { w.setOpenStep(s.id); w.setSheet("steps"); }}
                >{s.title}</button>
                {due(s)}
                {!locked ? <button type="button" className="ws-linkbtn" onClick={() => large(s.id)}>Open large</button> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
