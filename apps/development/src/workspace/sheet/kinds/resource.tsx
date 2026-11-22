"use client";
import { CommonFields, Prompt, TextField, type KindDef } from "./shared";

export const resource: KindDef = {
  label: "Resource",
  Do: ({ step }) => (
    <div>
      <Prompt step={step} />
      <div className="ws-sh-resrow">
        <span>{step.fileName || step.href || "Nothing attached yet"}</span>
        {step.href && <a className="ws-sh-btn" href={step.href} target="_blank" rel="noreferrer">Open</a>}
        {!step.href && step.fileName && <button type="button" className="ws-sh-btn" disabled title="Prototype: no file stored">Download</button>}
      </div>
    </div>
  ),
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <TextField label="File name" value={p.step.fileName} onChange={(v) => p.patch({ fileName: v })} />
      <TextField label="Link" placeholder="https://" value={p.step.href} onChange={(v) => p.patch({ href: v })} />
    </>
  ),
};
