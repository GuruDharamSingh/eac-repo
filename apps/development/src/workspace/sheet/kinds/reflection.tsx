"use client";
import { useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, Saved, type DoProps, type KindDef } from "./shared";

function ReflectionDo({ step, moduleId }: DoProps) {
  const { addEntry } = useWorkspace();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <Prompt step={step} />
      <Field label="Your reflection">
        {(id) => <textarea id={id} className="ws-sh-input" rows={5} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} />}
      </Field>
      <button type="button" className="ws-sh-btn" disabled={!text.trim()}
        onClick={() => { addEntry({ moduleId, stepId: step.id, kind: "reflection", text: text.trim() }); setSaved(true); setText(""); }}>
        Save to journal
      </button>
      {saved && <Saved>Saved to your journal.</Saved>}
    </div>
  );
}

export const reflection: KindDef = {
  label: "Reflection",
  Do: (p) => <ReflectionDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
