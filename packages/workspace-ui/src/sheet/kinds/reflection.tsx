"use client";
import { useContext, useState } from "react";
import { AudienceCtx } from "../../audience";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, Saved, type DoProps, type KindDef } from "./shared";

function ReflectionDo({ step, moduleId, intervalKey, mediaLabel: extraMedia }: DoProps) {
  const { addEntry } = useWorkspace();
  const aud = useContext(AudienceCtx);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    const r = await addEntry({ ...(intervalKey ? { intervalKey } : {}), ...(extraMedia ? { mediaLabel: extraMedia } : {}), moduleId, stepId: step.id, kind: "reflection", text: text.trim(), ...(aud ? { visibility: aud.vis } : {}) });
    if (typeof r === "string") { setErr(r); return; }
    setSaved(true); setText("");
  };
  return (
    <div>
      <Prompt step={step} />
      <Field label="Your reflection">
        {(id) => <textarea id={id} className="ws-sh-input" rows={5} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} />}
      </Field>
      <button type="button" className="ws-sh-btn" disabled={!text.trim()} onClick={save}>
        Save to journal
      </button>
      {saved && <Saved>Saved to your journal.</Saved>}
      {err ? <p className="ws-sh-meta" role="alert">{err}</p> : null}
    </div>
  );
}

export const reflection: KindDef = {
  label: "Reflection",
  Do: (p) => <ReflectionDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
