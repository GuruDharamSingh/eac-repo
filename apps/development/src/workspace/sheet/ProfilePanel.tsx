"use client";
import { useId } from "react";
import { useWorkspace } from "../store";
import "./sheet.css";

export function ProfilePanel() {
  const { viewer, course, updatePerson, setSheet, setOpenStep, select } = useWorkspace();
  const id = useId();
  const participant = viewer.role === "participant";
  const sharing = viewer.shareJournal !== false;
  const now = course?.journals === "concurrent" ? "Concurrent now" : course?.journals === "public" ? "Public now" : "Private now";
  return (
    <aside className="ws-sh" aria-label="Your profile">
      <header className="ws-sh-head">
        <div className="ws-sh-headrow">
          <h2 className="ws-sh-title">Your profile</h2>
          <button type="button" className="ws-sh-btn" onClick={() => { setOpenStep(null); setSheet("home"); }}>Overview</button>
        </div>
      </header>
      <div className="ws-sh-scroll">
        <div className="ws-hm-pic">
          <span className="ws-hm-avatar ws-hm-avatar--big" aria-hidden="true">{viewer.initials}</span>
          <div>
            <div className="ws-hm-picname">{viewer.pictureLabel ? viewer.pictureLabel : "No picture yet"}</div>
            <label className="ws-sh-btn ws-hm-file">
              Add a picture
              <input type="file" accept="image/*" className="ws-sh-sr"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) updatePerson(viewer.id, { pictureLabel: f.name }); }} />
            </label>
            <p className="ws-sh-meta">Prototype: only the file name is kept; nothing is uploaded.</p>
          </div>
        </div>
        <div className="ws-sh-field">
          <label htmlFor={`${id}-n`} className="ws-sh-label">Name</label>
          <input id={`${id}-n`} className="ws-sh-input" type="text" value={viewer.name}
            onChange={(e) => updatePerson(viewer.id, { name: e.target.value, initials: e.target.value.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || viewer.initials })} />
        </div>
        <div className="ws-sh-field">
          <label htmlFor={`${id}-b`} className="ws-sh-label">Short bio</label>
          <textarea id={`${id}-b`} className="ws-sh-input" rows={4} value={viewer.bio ?? ""} placeholder="A line or two about you"
            onChange={(e) => updatePerson(viewer.id, { bio: e.target.value })} />
        </div>
        <p className="ws-sh-meta">Role: {viewer.role === "guide" ? "Guide (host)" : "Participant"}</p>
        {participant && (
          <div className="ws-hm-setting">
            <div className="ws-sh-check">
              <input id={`${id}-s`} type="checkbox" role="switch" checked={sharing} aria-describedby={`${id}-sd`}
                onChange={(e) => updatePerson(viewer.id, { shareJournal: e.target.checked })} />
              <label htmlFor={`${id}-s`}>Share my journal entries with the group</label>
            </div>
            <p className="ws-sh-meta" id={`${id}-sd`}>
              This only applies when the workshop&apos;s journals are Concurrent. {course ? `They are ${now}.` : ""}
            </p>
          </div>
        )}
        <div className="ws-sh-add">
          <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => select("settings")}>All settings</button>
        </div>
      </div>
    </aside>
  );
}
export default ProfilePanel;
