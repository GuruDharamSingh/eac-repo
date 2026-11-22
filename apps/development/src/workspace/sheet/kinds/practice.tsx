"use client";
import { useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, Saved, type DoProps, type KindDef } from "./shared";

function PracticeDo({ step, moduleId }: DoProps) {
  const { addEntry } = useWorkspace();
  const [minutes, setMinutes] = useState("10");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const n = Number(minutes);
  return (
    <div>
      <Prompt step={step} />
      <Field label="Minutes practised">
        {(id) => <input id={id} className="ws-sh-input ws-sh-short" type="number" min={1} value={minutes} onChange={(e) => { setMinutes(e.target.value); setSaved(false); }} />}
      </Field>
      <Field label="A note (optional)">
        {(id) => <textarea id={id} className="ws-sh-input" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />}
      </Field>
      <button type="button" className="ws-sh-btn" disabled={!(n > 0)}
        onClick={() => { addEntry({ moduleId, stepId: step.id, kind: "practice", minutes: n, text: note.trim() || undefined }); setSaved(true); setNote(""); }}>
        Log practice
      </button>
      {saved && <Saved>Logged in your journal.</Saved>}
    </div>
  );
}

export const practice: KindDef = {
  label: "Practice",
  Do: (p) => <PracticeDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
