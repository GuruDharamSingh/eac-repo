"use client";

import { useWorkspace } from "./store";
import type { Course, JournalVisibility } from "./types";

const VIS: { id: JournalVisibility; label: string; line: string }[] = [
  { id: "private", label: "Private", line: "Each person and the guide can read an entry." },
  { id: "concurrent", label: "Concurrent", line: "Reflections are shared in the group as they are written." },
  { id: "public", label: "Public", line: "Anyone who can see the workshop can read them." },
];

function Later() {
  return <span className="ws-badge">later</span>;
}

export function SettingsPane() {
  const w = useWorkspace();
  const c = w.course;
  if (!c) return null;
  return (
    <main className="ws-pane ws-settings">
      <h1 className="ws-title">Settings</h1>
      {w.mode === "participant" ? <Mine /> : <Owner c={c} />}
    </main>
  );
}

function Owner({ c }: { c: Course }) {
  const w = useWorkspace();
  return (
    <>
      <section aria-label="Journals">
        <h2 className="ws-h2">Journals</h2>
        <fieldset className="ws-q">
          <legend>Who can read journal entries</legend>
          {VIS.map((v) => (
            <label key={v.id} className="ws-check ws-set-opt">
              <input type="radio" name="ws-vis" checked={c.journals === v.id} onChange={() => w.updateCourse({ journals: v.id })} />
              <span><strong>{v.label}</strong><br /><span className="ws-muted">{v.line}</span></span>
            </label>
          ))}
        </fieldset>
        <label className="ws-q">
          <span>Who may comment</span>
          <select className="ws-select" value={c.journalComments} onChange={(e) => w.updateCourse({ journalComments: e.target.value as Course["journalComments"] })}>
            <option value="guide">The guide</option>
            <option value="everyone">Everyone</option>
          </select>
        </label>
      </section>

      <section aria-label="Participants">
        <h2 className="ws-h2">Participants</h2>
        <ul className="ws-materials">
          {w.people.map((p) => (
            <li key={p.id} className="ws-material">
              <span className="ws-avatar">{p.initials}</span>
              <span className="ws-material-name">{p.name}</span>
              <span className="ws-badge">{p.role === "guide" ? "Guide" : "Participant"}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="ws-btn ws-btn-small" disabled>Invite</button> <Later />
      </section>

      <section aria-label="Workshop">
        <h2 className="ws-h2">Workshop</h2>
        <label className="ws-q">
          <span>Status</span>
          <select className="ws-select" value={c.status} onChange={(e) => w.updateCourse({ status: e.target.value as Course["status"] })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label className="ws-q"><span>Price</span><input type="text" value={c.price} onChange={(e) => w.updateCourse({ price: e.target.value })} /></label>
        <label className="ws-q">
          <span>Where</span>
          <select className="ws-select" value={c.where} onChange={(e) => w.updateCourse({ where: e.target.value as Course["where"] })}>
            <option>In person</option><option>Online</option><option>Both</option>
          </select>
        </label>
        <ul className="ws-set-later">
          <li>Waiting list <Later /></li>
          <li>Refund terms <Later /></li>
          <li>Certificate on completion <Later /></li>
        </ul>
      </section>
    </>
  );
}

function Mine() {
  const w = useWorkspace();
  const c = w.course!;
  const me = w.viewer;
  const concurrent = c.journals === "concurrent";
  return (
    <>
      <section aria-label="My journal">
        <h2 className="ws-h2">My journal</h2>
        <label className="ws-check">
          <input type="checkbox" checked={me.shareJournal !== false} disabled={!concurrent} onChange={(e) => w.updatePerson(me.id, { shareJournal: e.target.checked })} />
          Share my journal entries with the group
        </label>
        <p className="ws-muted">
          {concurrent
            ? "Your reflections show in the group's journal while this is on."
            : c.journals === "public"
              ? "This workshop's journals are public, so this choice has no effect."
              : "This only matters when the workshop uses Concurrent journals. Right now journals are private."}
        </p>
      </section>
      <section aria-label="Notifications">
        <h2 className="ws-h2">Notifications</h2>
        <label className="ws-check"><input type="checkbox" disabled /> Email me about new messages <Later /></label>
        <label className="ws-check"><input type="checkbox" disabled /> Remind me before a step is due <Later /></label>
      </section>
      <section aria-label="Profile">
        <h2 className="ws-h2">Profile</h2>
        <button type="button" className="ws-btn" onClick={() => w.setSheet("profile")}>Open my profile in the sheet</button>
      </section>
    </>
  );
}
