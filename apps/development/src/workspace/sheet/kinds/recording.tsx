"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, Saved, type DoProps, type KindDef } from "./shared";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Prototype: a fake recorder, a timer only. No microphone is used.
function RecordingDo({ step, moduleId }: DoProps) {
  const { addEntry } = useWorkspace();
  const [state, setState] = useState<"idle" | "recording" | "stopped">("idle");
  const [secs, setSecs] = useState(0);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);
  return (
    <div>
      <Prompt step={step} />
      <p className="ws-sh-timer">{fmt(secs)}</p>
      <div className="ws-sh-row">
        {state === "idle" && <button type="button" className="ws-sh-btn" onClick={() => { setSecs(0); setSaved(false); setState("recording"); }}>Record</button>}
        {state === "recording" && <button type="button" className="ws-sh-btn" onClick={() => setState("stopped")}>Stop</button>}
        {state === "stopped" && <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => { setSecs(0); setState("idle"); }}>Retake</button>}
      </div>
      {state === "stopped" && (
        <>
          <Field label="Label for this recording">
            {(id) => <input id={id} className="ws-sh-input" type="text" value={label} placeholder="Voice note" onChange={(e) => setLabel(e.target.value)} />}
          </Field>
          <button type="button" className="ws-sh-btn"
            onClick={() => { addEntry({ moduleId, stepId: step.id, kind: "recording", mediaLabel: `${label.trim() || "Voice note"} (${fmt(secs)})` }); setSaved(true); setState("idle"); setSecs(0); setLabel(""); }}>
            Add to journal
          </button>
        </>
      )}
      <p className="ws-sh-meta">Prototype: nothing is recorded, this is a timer.</p>
      {saved && <Saved>Added to your journal.</Saved>}
    </div>
  );
}

export const recording: KindDef = {
  label: "Recording",
  Do: (p) => <RecordingDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
