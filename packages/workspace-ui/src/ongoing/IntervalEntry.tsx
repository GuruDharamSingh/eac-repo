"use client";

import { useContext, useEffect, useState } from "react";
import { useWorkspace } from "../store";
import { Frame } from "../Frame";
import { AudienceCtx } from "../audience";
import { VisPicker } from "../readonly/DoControls";
import type { Entry, EntryVisibility, Module, Step } from "../types";
import { KINDS } from "../sheet/kinds";
import { useTimer } from "../sheet/timer";
import { fmtTime } from "./util";
import "./ongoing.css";

const PRETEND = [
  { id: "audio", title: "Record audio", label: "Audio recording (pretend)" },
  { id: "video", title: "Record video", label: "Video recording (pretend)" },
  { id: "picture", title: "Add a picture", label: "Picture (pretend)" },
] as const;

function Icon({ id }: { id: (typeof PRETEND)[number]["id"] }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (id === "audio") return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
  if (id === "video") return <svg {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>;
  return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>;
}

/** The entry form for the repeating step. Once the viewer has entered it collapses to one line. */
export function IntervalEntry({ m, step, intervalKey, open, closedMessage }: {
  m: Module; step: Step; intervalKey: string; open: boolean; closedMessage: string;
}) {
  const { entries, viewer, doing } = useWorkspace();
  const mine = entries
    .filter((e) => e.personId === viewer.id && e.moduleId === m.id && e.intervalKey === intervalKey)
    .sort((a, b) => b.at.localeCompare(a.at));
  const [editing, setEditing] = useState(false);
  // Who may read this entry (a seated person's own choices; the same ones the steps offer).
  const [vis, setVis] = useState<EntryVisibility>(mine[0]?.visibility ?? doing?.defaultVisibility ?? "me");
  useEffect(() => { setVis(mine[0]?.visibility ?? doing?.defaultVisibility ?? "me"); }, [intervalKey, mine[0]?.id, mine[0]?.visibility, doing?.defaultVisibility]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = mine.length;
  const stamp = mine[0]?.editedAt ?? "";
  useEffect(() => { setEditing(false); }, [count, stamp, intervalKey]);

  if (count > 0 && !editing) {
    return (
      <Frame title="Your entry" className="ws-ong-done" bodyClassName="ws-ong-donebody" label="Your entry">
        <span>You entered at {fmtTime(mine[0].at)}{mine[0].editedAt ? ", edited" : ""}</span>
        <span aria-hidden="true"> · </span>
        {doing && mine[0].visibility ? <><span className="ws-ong-muted">{VIS_SHORT[mine[0].visibility]}</span><span aria-hidden="true"> · </span></> : null}
        {open ? <button type="button" className="ws-ong-link" onClick={() => setEditing(true)}>Edit</button> : <span className="ws-ong-muted">closed</span>}
      </Frame>
    );
  }
  if (!open) {
    return <Frame title="Your entry" label="Your entry"><p className="ws-ong-closed" role="status">{closedMessage}</p></Frame>;
  }
  const Do = KINDS[step.kind].Do;
  return (
    <Frame title="Your entry" label="Your entry">
      <AudienceCtx.Provider value={doing ? { vis } : null}>
        {step.kind === "practice"
          ? <PracticeForm m={m} step={step} intervalKey={intervalKey} was={editing ? mine[0] : undefined} />
          : Do({ step, moduleId: m.id, hasVideo: false, done: false, intervalKey })}
      </AudienceCtx.Provider>
      {doing ? <div className="ws-ong-aud"><VisPicker value={vis} onChange={setVis} /></div> : null}
      {editing ? <button type="button" className="ws-ong-link" onClick={() => setEditing(false)}>Cancel</button> : null}
    </Frame>
  );
}

const VIS_SHORT: Record<EntryVisibility, string> = { me: "Only you can read it", guide: "You and the guide read it", circle: "Shared with the group" };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function PracticeForm({ m, step, intervalKey, was }: { m: Module; step: Step; intervalKey: string; was?: Entry }) {
  const { addEntry, readOnly: ro } = useWorkspace();
  const aud = useContext(AudienceCtx);
  const [err, setErr] = useState<string | null>(null);
  const limit = step.timeLimit && step.timeLimit > 0 ? step.timeLimit : step.minutes && step.minutes > 0 ? step.minutes : 10;
  const t = useTimer(`ong-${step.id}`, limit);
  const [mins, setMins] = useState(String(was?.minutes ?? limit));
  const [note, setNote] = useState(was?.text ?? "");
  const [media, setMedia] = useState<string | null>(was?.mediaLabel ?? null);
  const elapsed = t.total - t.remaining;
  useEffect(() => {
    if (t.running || elapsed > 0) setMins(String(Math.max(1, Math.ceil(elapsed / 60))));
  }, [t.running, elapsed]);
  const n = Number(mins);
  const log = async () => { setErr(null); const r = await addEntry({ intervalKey, mediaLabel: media ?? undefined, moduleId: m.id, stepId: step.id, kind: "practice", minutes: n, text: note.trim() || undefined, ...(aud ? { visibility: aud.vis } : {}) }); if (typeof r === "string") setErr(r); };
  return (
    <div className="ws-ong-form">
      <div className={`ws-ong-tstrip${t.expired ? " is-zero" : ""}`} role="group" aria-label="Timer and minutes">
        <span className="ws-ong-tface" role="timer" aria-live="off">{mmss(t.remaining)}</span>
        <label className="ws-ong-tmin">Minutes
          <input className="ws-ong-input" type="number" min={1} max={240} value={mins} onChange={(e) => setMins(e.target.value)} />
        </label>
        <div className="ws-ong-tbtns">
          {t.running
            ? <button type="button" className="ws-ong-btn" onClick={t.pause}>Pause</button>
            : <button type="button" className="ws-ong-btn" onClick={t.start}>{t.remaining < t.total && !t.expired ? "Resume" : "Start"}</button>}
          <button type="button" className="ws-ong-btn" onClick={t.reset}>Reset</button>
        </div>
      </div>
      <textarea className="ws-ong-input ws-ong-write" rows={7} aria-label="Your note" placeholder="How was it?" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="ws-ong-formrow">
        {ro ? null : PRETEND.map((p) => (
          <button key={p.id} type="button" className="ws-ong-icon" aria-label={p.title} title={p.title} aria-pressed={media === p.label} onClick={() => setMedia(media === p.label ? null : p.label)}><Icon id={p.id} /></button>
        ))}
        <span className="ws-ong-sp" />
        <button type="button" className="ws-ong-btn" disabled={!(n > 0)} onClick={log}>{was ? "Save changes" : "Log practice"}</button>
      </div>
      {ro ? null : <p className="ws-ong-fine" role={media ? "status" : undefined}>{media ? `Attached: ${media}. ` : ""}Pretend controls: nothing is captured or uploaded.</p>}
      {err ? <p className="ws-ong-fine" role="alert">{err}</p> : null}
    </div>
  );
}
