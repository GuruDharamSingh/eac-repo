"use client";
import { useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, Saved, type DoProps, type KindDef } from "./shared";

// Prototype: only the file NAME is read. Nothing is uploaded.
function PhotoDo({ step, moduleId, intervalKey, mediaLabel: extraMedia }: DoProps) {
  const { addEntry } = useWorkspace();
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const take = (f?: File | null) => { if (f) { setName(f.name); setSaved(false); } };
  return (
    <div>
      <Prompt step={step} />
      <Field label="Choose a photo">
        {(id) => (
          <div className={`ws-sh-drop${over ? " is-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}>
            <span>{name || "Drop a photo here, or pick one"}</span>
            <input id={id} type="file" accept="image/*" onChange={(e) => take(e.target.files?.[0])} />
          </div>
        )}
      </Field>
      <p className="ws-sh-meta">Prototype: the file is not uploaded, only its name is kept.</p>
      <button type="button" className="ws-sh-btn" disabled={!name}
        onClick={() => { addEntry({ ...(intervalKey ? { intervalKey } : {}), ...(extraMedia ? { mediaLabel: extraMedia } : {}), moduleId, stepId: step.id, kind: "photo", mediaLabel: name }); setSaved(true); setName(""); }}>
        Add to journal
      </button>
      {saved && <Saved>Added to your journal.</Saved>}
    </div>
  );
}

export const photo: KindDef = {
  label: "Photo",
  Do: (p) => <PhotoDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
