"use client";
import { useState } from "react";
import { CommonFields, Prompt, StringList, type DoProps, type KindDef } from "./shared";

function SetupDo({ step }: DoProps) {
  const [ticked, setTicked] = useState<number[]>([]);
  const items = step.items ?? [];
  return (
    <div>
      <Prompt step={step} />
      {items.map((it, i) => (
        <div key={i} className="ws-sh-check">
          <input type="checkbox" id={`${step.id}-s${i}`} checked={ticked.includes(i)}
            onChange={() => setTicked(ticked.includes(i) ? ticked.filter((x) => x !== i) : [...ticked, i])} />
          <label htmlFor={`${step.id}-s${i}`}>{it}</label>
        </div>
      ))}
      {items.length === 0 && <p className="ws-sh-meta">No items yet.</p>}
    </div>
  );
}

export const setup: KindDef = {
  label: "Set up",
  Do: (p) => <SetupDo {...p} />,
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <StringList label="Checklist item" addLabel="Add item" items={p.step.items ?? []} onChange={(items) => p.patch({ items })} />
    </>
  ),
};
