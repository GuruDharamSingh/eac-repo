"use client";
import { useWorkspace } from "../../store";
import { CommonFields, Prompt, TextField, type DoProps, type KindDef } from "./shared";

function WatchDo({ step, hasVideo }: DoProps) {
  const { setTheater } = useWorkspace();
  return (
    <div>
      <Prompt step={step} />
      <p className="ws-sh-meta">{step.videoLabel || "Video"}{step.duration ? ` · ${step.duration}` : ""}</p>
      {hasVideo ? (
        <button type="button" className="ws-sh-btn" onClick={() => setTheater(true)}>Open theater</button>
      ) : (
        <p className="ws-sh-meta">This session has no video yet.</p>
      )}
    </div>
  );
}

export const watch: KindDef = {
  label: "Watch",
  Do: (p) => <WatchDo {...p} />,
  Edit: (p) => (
    <>
      <CommonFields {...p} />
      <TextField label="Video label" value={p.step.videoLabel} onChange={(v) => p.patch({ videoLabel: v })} />
      <TextField label="Duration" placeholder="12 min" value={p.step.duration} onChange={(v) => p.patch({ duration: v })} />
    </>
  ),
};
