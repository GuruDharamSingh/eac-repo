"use client";

import { useWorkspace } from "./store";

/** Edit mode only: the page is a draft until published. Preview buttons are the mode switch. */
export function DraftBar() {
  const w = useWorkspace();
  const published = w.course?.status === "published";
  return (
    <div className="ws-draftbar" role="region" aria-label="Draft">
      <span className={`ws-pill ${published ? "ws-pill-live" : ""}`}>{published ? "Published" : "Draft"}</span>
      <span className="ws-draft-note">{published ? "Everyone with the link can see this" : "Only editors can see this"}</span>
      <span className="ws-grow" />
      <span className="ws-muted">Preview as</span>
      <button type="button" className="ws-btn ws-btn-small" onClick={() => w.setMode("participant")}>Visitor</button>
      <button type="button" className="ws-btn ws-btn-small" onClick={() => w.setMode("participant")}>Participant</button>
      <button
        type="button" className="ws-btn ws-btn-small ws-btn-primary"
        onClick={() => w.updateCourse({ status: published ? "draft" : "published" })}
      >
        {published ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
