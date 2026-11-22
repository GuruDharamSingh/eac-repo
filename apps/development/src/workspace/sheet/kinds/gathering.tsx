"use client";
import { useState } from "react";
import { CommonFields, Prompt, TextField, type DoProps, type KindDef } from "./shared";

function GatheringDo({ step }: DoProps) {
  const [going, setGoing] = useState(false);
  return (
    <div>
      <Prompt step={step} />
      <dl className="ws-sh-dl">
        <dt>When</dt><dd>{step.when || "To be set"}</dd>
        <dt>Where</dt><dd>{step.where || "To be set"}</dd>
      </dl>
      <div className="ws-sh-row">
        <button type="button" className="ws-sh-btn" aria-pressed={going} onClick={() => setGoing(!going)}>{going ? "Going" : "RSVP"}</button>
        <button type="button" className="ws-sh-btn ws-sh-btn-quiet" disabled title="Prototype: not connected">Join the room</button>
      </div>
    </div>
  );
}

export const gathering: KindDef = {
  label: "Gathering",
  Do: (p) => <GatheringDo {...p} />,
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <TextField label="When" value={p.step.when} onChange={(v) => p.patch({ when: v })} />
      <TextField label="Where" value={p.step.where} onChange={(v) => p.patch({ where: v })} />
    </>
  ),
};
