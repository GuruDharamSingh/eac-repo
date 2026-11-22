"use client";
import { useState } from "react";
import { useWorkspace } from "../store";
import { Messages } from "./Messages";
import "./sheet.css";

export function PeoplePanel() {
  const { people, course, setSheet, setOpenStep } = useWorkspace();
  const [draft, setDraft] = useState("");
  const hostId = course?.guideId;
  const ordered = [...people].sort((a, b) => (a.id === hostId ? -1 : b.id === hostId ? 1 : 0));
  return (
    <aside className="ws-sh" aria-label="People">
      <header className="ws-sh-head">
        <div className="ws-sh-headrow">
          <h2 className="ws-sh-title">People</h2>
          <button type="button" className="ws-sh-btn" onClick={() => { setOpenStep(null); setSheet("home"); }}>Overview</button>
        </div>
      </header>
      <div className="ws-sh-scroll">
        <ul className="ws-sh-list">
          {ordered.map((p) => (
            <li key={p.id} className="ws-hm-person">
              <span className="ws-hm-avatar" aria-hidden="true">{p.initials}</span>
              <div className="ws-hm-personmain">
                <div className="ws-hm-personname">
                  {p.name}
                  <span className={`ws-hm-online${p.online ? " is-on" : ""}`} aria-hidden="true" />
                  <span className="ws-sh-sr">{p.online ? "online" : "offline"}</span>
                </div>
                <div className="ws-sh-meta">{p.id === hostId ? "Host" : p.role === "guide" ? "Guide" : "Participant"}{p.online ? " · online" : ""}</div>
                {p.bio ? <div className="ws-hm-bio">{p.bio}</div> : null}
              </div>
              <button type="button" className="ws-sh-btn" aria-label={`Message ${p.name}`} onClick={() => setDraft(`@${p.name} `)}>Message</button>
            </li>
          ))}
        </ul>
        <Messages value={draft} onChange={setDraft} />
      </div>
    </aside>
  );
}
export default PeoplePanel;
