"use client";

import { useId } from "react";
import { intervalsAround, useWorkspace } from "../store";
import type { Module } from "../types";
import { KINDS } from "../sheet/kinds";
import { FreeTimer, TimerView } from "../sheet/timer";
import { fmtKey } from "./util";
import { Frame } from "../Frame";
import "./ongoing.css";

/** The top of the sheet while an ongoing session is selected: session card, the step, this interval's material, the timer. */
export function OngoingSheetTop({ m }: { m: Module }) {
  const w = useWorkspace();
  const noteId = useId();
  const ongoing = m.ongoing;
  if (!ongoing) return null;
  const edit = w.mode === "edit";
  const items = intervalsAround(ongoing, w.now);
  const current = items.find((i) => i.state === "current") ?? items[Math.floor(items.length / 2)];
  const key = w.interval ?? current.key;
  const step = m.steps.find((s) => s.id === ongoing.stepId);
  const plan = ongoing.plans.find((p) => p.key === key);
  const label = fmtKey(key, ongoing.every);
  const setPlan = (patch: { note?: string; materials?: Module["materials"] }) => w.planInterval(m.id, key, patch);
  const mats = plan?.materials ?? [];
  return (
    <>
      <Frame title={m.title} collapsible storeKey={`ongoing-${m.id}-head`} label="Session">
        <div className="ws-hm-menu" role="group" aria-label="Session menu">
          <button type="button" className="ws-sh-btn" onClick={() => w.setFrame("journal")}>Open journal</button>
        </div>
      </Frame>

      <Frame title="The step" collapsible storeKey={`ongoing-${m.id}-step`} label="The step">
        {step ? (
          <>
            <div className="ws-ong-steptop"><span className="ws-ong-chip ws-chip-2">{KINDS[step.kind].label}</span><strong>{step.title}</strong></div>
            {step.prompt ? <p className="ws-hm-p ws-prompt">{step.prompt}</p> : null}
          </>
        ) : <p className="ws-sh-meta">No step is set for this session yet.</p>}
      </Frame>

      <Frame title={`Material for ${label}`} collapsible storeKey={`ongoing-${m.id}-material`} label="Material for this interval">
        {edit ? (
          <div className="ws-sh-field">
            <label htmlFor={noteId} className="ws-sh-label">Note to the group</label>
            <textarea id={noteId} className="ws-sh-input" rows={2} value={plan?.note ?? ""} placeholder="A line to go with this interval" onChange={(e) => setPlan({ note: e.target.value })} />
          </div>
        ) : plan?.note ? <p className="ws-hm-p">{plan.note}</p> : null}
        {mats.length === 0 ? <p className="ws-sh-meta">{edit ? "No material yet for this interval." : "No material for this interval."}</p> : (
          <ul className="ws-sh-list">
            {mats.map((mt) => (
              <li key={mt.id} className="ws-ong-mat">
                <span>{mt.name}</span>
                <span className="ws-ong-chip ws-chip-3">{mt.access === "open" ? "Open to everyone" : "Participants only"}</span>
                {edit ? <button type="button" className="ws-ong-link" aria-label={`Remove ${mt.name}`} onClick={() => setPlan({ materials: mats.filter((x) => x.id !== mt.id) })}>Remove</button> : null}
              </li>
            ))}
          </ul>
        )}
        {edit ? (
          <button type="button" className="ws-sh-btn" onClick={() => setPlan({ materials: [...mats, { id: `mt-${Math.random().toString(36).slice(2, 7)}`, name: `Material for ${label} ${mats.length + 1}.pdf`, access: "participants" }] })}>Add material</button>
        ) : null}
      </Frame>

      <Frame title="Timer" collapsible storeKey={`ongoing-${m.id}-timer`} label="Timer">
        {step?.kind === "practice"
          ? <TimerView id={`ong-${step.id}`} minutes={step.timeLimit && step.timeLimit > 0 ? step.timeLimit : step.minutes && step.minutes > 0 ? step.minutes : 10} label="Practice timer" />
          : <FreeTimer />}
      </Frame>
    </>
  );
}

export function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="ws-ong-fold">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
