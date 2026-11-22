"use client";
import { useId, type ReactNode } from "react";
import type { Step, StepKind } from "../../types";
import { fromLocalInput, toLocalInput } from "../deadline";
import "../sheet.css";

export interface DoProps { step: Step; moduleId: string; hasVideo: boolean; done: boolean; }
export interface EditProps { step: Step; patch: (p: Partial<Step>) => void; }
export interface KindDef { label: string; Do: (p: DoProps) => ReactNode; Edit: (p: EditProps) => ReactNode; }
export type KindMap = Record<StepKind, KindDef>;

export function Field(props: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="ws-sh-field">
      <label htmlFor={id} className="ws-sh-label">{props.label}</label>
      {props.children(id)}
    </div>
  );
}

export function TextField(props: { label: string; value: string | undefined; onChange: (v: string) => void; long?: boolean; placeholder?: string }) {
  return (
    <Field label={props.label}>
      {(id) => props.long ? (
        <textarea id={id} className="ws-sh-input" rows={4} value={props.value ?? ""} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input id={id} className="ws-sh-input" type="text" value={props.value ?? ""} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
    </Field>
  );
}

/** Title, prompt and required: shared by every kind Edit view. */
export function CommonFields({ step, patch }: EditProps) {
  const rid = useId();
  return (
    <>
      <TextField label="Title" value={step.title} onChange={(v) => patch({ title: v })} />
      <TextField label="Prompt or instructions" value={step.prompt} long onChange={(v) => patch({ prompt: v })} />
      <div className="ws-sh-check">
        <input id={rid} type="checkbox" checked={!!step.required} onChange={(e) => patch({ required: e.target.checked })} />
        <label htmlFor={rid}>Required to finish the session</label>
      </div>
      <div className="ws-sh-pair">
        <Field label="Deadline">
          {(id) => <input id={id} className="ws-sh-input" type="datetime-local" value={toLocalInput(step.due)} onChange={(e) => patch({ due: fromLocalInput(e.target.value) })} />}
        </Field>
        <Field label="Time limit (minutes)">
          {(id) => <input id={id} className="ws-sh-input" type="number" min={1} max={600} placeholder="None" value={step.timeLimit ?? ""}
            onChange={(e) => { const n = Number(e.target.value); patch({ timeLimit: e.target.value && n > 0 ? Math.round(n) : undefined }); }} />}
        </Field>
      </div>
    </>
  );
}

/** Editable list of strings, optionally with a radio to mark one as correct. */
export function StringList(props: { label: string; items: string[]; onChange: (items: string[]) => void; correct?: number; onCorrect?: (i: number) => void; addLabel: string }) {
  const name = useId();
  const { items } = props;
  return (
    <fieldset className="ws-sh-fieldset">
      <legend className="ws-sh-label">{props.label}</legend>
      {items.map((it, i) => (
        <div key={i} className="ws-sh-listrow">
          {props.onCorrect && (
            <>
              <input type="radio" name={name} id={`${name}-r${i}`} checked={props.correct === i} onChange={() => props.onCorrect?.(i)} />
              <label htmlFor={`${name}-r${i}`} className="ws-sh-sr">Correct answer: option {i + 1}</label>
            </>
          )}
          <input className="ws-sh-input" type="text" aria-label={`${props.label} ${i + 1}`} value={it}
            onChange={(e) => props.onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="ws-sh-btn ws-sh-btn-quiet" aria-label={`Remove ${props.label} ${i + 1}`}
            onClick={() => props.onChange(items.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="ws-sh-btn" onClick={() => props.onChange([...items, ""])}>+ {props.addLabel}</button>
    </fieldset>
  );
}

export function Prompt({ step }: { step: Step }) {
  return step.prompt ? <p className="ws-sh-prompt">{step.prompt}</p> : null;
}

export function Saved({ children }: { children: ReactNode }) {
  return <p className="ws-sh-saved" role="status">{children}</p>;
}
