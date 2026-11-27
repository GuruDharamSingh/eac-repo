"use client";
import { useId, useState } from "react";
import { useWorkspace } from "../store";
import type { Entry, EntryVisibility, Step } from "../types";
import { TimerView } from "../sheet/timer";
import "../sheet/sheet.css";

const VIS_WORDS: Record<EntryVisibility, { label: string; help: string }> = {
  me: { label: "Only me", help: "Kept in your journal. No one else sees it, not even the guide." },
  guide: { label: "Private", help: "You and the guide read it. No one else." },
  circle: { label: "Shared", help: "Everyone in this workshop reads it, and the guide." },
};
const day = (iso: string) => iso.slice(0, 10);

export function VisPicker({ value, onChange }: { value: EntryVisibility; onChange: (v: EntryVisibility) => void }) {
  const { doing } = useWorkspace();
  const name = useId();
  if (!doing) return null;
  return (
    <fieldset className="ws-sh-fieldset">
      <legend className="ws-sh-label">Who can read this</legend>
      {doing.visChoices.map((v) => (
        <div key={v} className="ws-sh-check">
          <input type="radio" id={`${name}-${v}`} name={name} checked={value === v} onChange={() => onChange(v)} />
          <label htmlFor={`${name}-${v}`}><strong>{VIS_WORDS[v].label}</strong> {VIS_WORDS[v].help}</label>
        </div>
      ))}
    </fieldset>
  );
}

function useSaver() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => void | Promise<string | null>): Promise<boolean> => {
    setBusy(true); setError(null);
    const err = (await fn()) ?? null;
    setBusy(false);
    if (err) setError(err);
    return !err;
  };
  return { busy, error, run };
}

function Entered({ e, onEdit, what }: { e: Entry; onEdit: () => void; what: string }) {
  const vis = e.visibility ? VIS_WORDS[e.visibility].label : "Only me";
  return (
    <div className="ws-ro-entered">
      <p className="ws-sh-saved" role="status">You entered {what} on {day(e.editedAt ?? e.at)}{e.editedAt ? " (edited)" : ""}. Who can read it: {vis}.</p>
      {e.minutes ? <p className="ws-sh-meta">{e.minutes} minutes</p> : null}
      {e.text ? <div className="ws-sh-body">{e.text}</div> : null}
      <button type="button" className="ws-sh-btn" onClick={onEdit}>Edit</button>
    </div>
  );
}

function ReflectionForm({ step }: { step: Step }) {
  const { entries, addEntry, doing, viewer } = useWorkspace();
  const mine = entries.find((e) => e.stepId === step.id && e.kind === "reflection" && e.personId === viewer.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [vis, setVis] = useState<EntryVisibility>(doing?.defaultVisibility ?? "me");
  const s = useSaver();
  const id = useId();
  if (mine && !editing) return <Entered e={mine} what="a reflection" onEdit={() => { setText(mine.text ?? ""); setVis(mine.visibility ?? "me"); setEditing(true); }} />;
  return (
    <div>
      <label htmlFor={id} className="ws-sh-label">Your reflection</label>
      <textarea id={id} className="ws-sh-input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      <VisPicker value={vis} onChange={setVis} />
      <div className="ws-sh-row">
        <button type="button" className="ws-sh-btn ws-sh-primary" disabled={!text.trim() || s.busy}
          onClick={async () => { if (await s.run(() => addEntry({ moduleId: "", stepId: step.id, kind: "reflection", text: text.trim(), visibility: vis }))) { setEditing(false); setText(""); } }}>
          {mine ? "Save changes" : "Save to journal"}
        </button>
        {editing ? <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => setEditing(false)}>Cancel</button> : null}
      </div>
      {s.error ? <p className="ws-sh-meta" role="alert">{s.error}</p> : null}
    </div>
  );
}

function PracticeForm({ step }: { step: Step }) {
  const { entries, addEntry, doing, viewer } = useWorkspace();
  const mine = entries.find((e) => e.stepId === step.id && e.kind === "practice" && e.personId === viewer.id);
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(step.minutes ?? 10));
  const [note, setNote] = useState("");
  const [vis, setVis] = useState<EntryVisibility>(doing?.defaultVisibility ?? "me");
  const s = useSaver();
  const id = useId();
  const n = Number(minutes);
  if (mine && !editing) return <Entered e={mine} what="a practice log" onEdit={() => { setMinutes(String(mine.minutes ?? 10)); setNote(mine.text ?? ""); setVis(mine.visibility ?? "me"); setEditing(true); }} />;
  return (
    <div>
      <TimerView id={`step-${step.id}`} minutes={step.minutes ?? 10} label={`Timer for ${step.title}`} />
      <label htmlFor={`${id}-m`} className="ws-sh-label">Minutes practised</label>
      <input id={`${id}-m`} className="ws-sh-input ws-sh-short" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      <label htmlFor={`${id}-n`} className="ws-sh-label">A note (optional)</label>
      <textarea id={`${id}-n`} className="ws-sh-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      <VisPicker value={vis} onChange={setVis} />
      <div className="ws-sh-row">
        <button type="button" className="ws-sh-btn ws-sh-primary" disabled={!(n > 0) || s.busy}
          onClick={async () => { if (await s.run(() => addEntry({ moduleId: "", stepId: step.id, kind: "practice", minutes: Math.round(n), text: note.trim() || undefined, visibility: vis }))) { setEditing(false); setNote(""); } }}>
          {mine ? "Save changes" : "Log practice"}
        </button>
        {editing ? <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => setEditing(false)}>Cancel</button> : null}
      </div>
      {s.error ? <p className="ws-sh-meta" role="alert">{s.error}</p> : null}
    </div>
  );
}

function CompleteRow({ step }: { step: Step }) {
  const { done, viewer, completeStep } = useWorkspace();
  const s = useSaver();
  const isDone = (done[viewer.id] ?? []).includes(step.id);
  if (isDone) return <p className="ws-sh-saved" role="status">Step complete.</p>;
  if (step.completion === "derived") return <p className="ws-sh-meta">This one ticks itself when it is done on the network.</p>;
  if (step.completion === "response") return <p className="ws-sh-meta">Saving your reflection completes this step.</p>;
  return (
    <div>
      <button type="button" className="ws-sh-btn ws-sh-primary" disabled={s.busy} onClick={() => s.run(() => completeStep(step.id))}>Mark step complete</button>
      {s.error ? <p className="ws-sh-meta" role="alert">{s.error}</p> : null}
    </div>
  );
}

/** What a seated participant can do on one step. Nothing is drawn for anyone else. */
export function DoControls({ step }: { step: Step }) {
  const { canDo, doing } = useWorkspace();
  if (!canDo || !doing) return null;
  const acc = doing.access[step.id];
  if (acc && !acc.allowed) return <p className="ws-sh-meta" role="status">Locked. {acc.reason ?? "Not open yet."}</p>;
  return (
    <div className="ws-ro-do">
      {step.kind === "reflection" ? <ReflectionForm step={step} /> : null}
      {step.kind === "practice" ? <PracticeForm step={step} /> : null}
      <CompleteRow step={step} />
    </div>
  );
}
