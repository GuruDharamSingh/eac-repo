"use client";
import { useState } from "react";
import { useWorkspace } from "../store";

/** The editing bar on the server: where the saving stands, and publishing (with the warning when people are partway through). */
export function ServerDraftBar() {
  const w = useWorkspace();
  const s = w.server;
  const [err, setErr] = useState<string | null>(null);
  if (!s || !w.course) return null;
  const live = w.course.status === "published";
  const out = s.save.publish;
  const waiting = out && out.changeKind === "structural" && !out.adopted;
  return (
    <div className="ws-draftbar" role="region" aria-label="Draft">
      <span className={`ws-pill ${live ? "ws-pill-live" : ""}`}>{live ? "Open to the group" : "Not open yet"}</span>
      <span className="ws-draft-note" role="status">
        {s.save.saving ? "Saving…" : s.save.error ? s.save.error : s.save.unpublished ? "Changes saved as a draft. Participants see them when you publish." : s.save.hasPublished ? "Everything is published." : "Nothing is published yet."}
      </span>
      <span className="ws-grow" />
      <button type="button" className="ws-btn ws-btn-small ws-btn-primary" disabled={s.save.saving || (!s.save.unpublished && s.save.hasPublished)}
        onClick={async () => { setErr(null); const e = await s.publish(); if (e) setErr(e); }}>
        Publish changes
      </button>
      {err ? <span className="ws-draft-note" role="alert">{err}</span> : null}
      {waiting ? (
        <div className="ws-draft-warn" role="alert">
          <span>{out.partway === 0 ? "You changed the steps." : `${out.partway} ${out.partway === 1 ? "person is" : "people are"} partway through.`} The new version is published but the group is still on the old one.</span>
          <button type="button" className="ws-btn ws-btn-small" onClick={async () => { setErr(null); const e = await s.adopt(); if (e) setErr(e); }}>Move the group to the new version</button>
        </div>
      ) : out ? <span className="ws-draft-note" role="status">Published version {out.versionNo}.</span> : null}
    </div>
  );
}
