"use client";
import { CommonFields, Prompt, TextField, type KindDef } from "./shared";

export const reading: KindDef = {
  label: "Reading",
  Do: ({ step }) => (
    <div>
      <Prompt step={step} />
      <div className="ws-sh-body">{step.body || "Nothing to read yet."}</div>
    </div>
  ),
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <TextField label="Reading text" long value={p.step.body} onChange={(v) => p.patch({ body: v })} />
    </>
  ),
};
