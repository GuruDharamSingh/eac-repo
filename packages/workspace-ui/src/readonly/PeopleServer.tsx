"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../store";
import type { InviteWire } from "../types";

/** Settings > People on the server: who is in, add a member by name, and invite links. No emails are sent. */
export function PeopleServer() {
  const w = useWorkspace();
  const s = w.server;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteWire[] | null>(null);
  const [label, setLabel] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const load = async () => { if (s) setInvites(await s.listInvites()); };
  useEffect(() => { if (s?.canEdit) void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const search = async () => { setMsg(null); setFound(await s.searchMembers(q)); };
  return (
    <section aria-label="People">
      <h2 className="ws-h2">People</h2>
      <ul className="ws-materials">
        {w.people.map((p) => (
          <li key={p.id} className="ws-material">
            <span className="ws-avatar">{p.initials}</span>
            <span className="ws-material-name">{p.name}</span>
            <span className="ws-badge">{p.role === "guide" ? "Guide" : "Participant"}</span>
          </li>
        ))}
        {w.people.length === 0 ? <li className="ws-muted">Nobody is in this group yet.</li> : null}
      </ul>

      <h3 className="ws-h3">Add someone who is already a member</h3>
      <div className="ws-row">
        <input type="text" aria-label="Search members by name" value={q} placeholder="Part of a name" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} />
        <button type="button" className="ws-btn ws-btn-small" disabled={q.trim().length < 2} onClick={search}>Search</button>
      </div>
      <ul className="ws-materials">
        {found.map((p) => (
          <li key={p.id} className="ws-material">
            <span className="ws-material-name">{p.name}</span>
            <button type="button" className="ws-btn ws-btn-small" onClick={async () => { const e = await s.addMember(p.id); setMsg(e ?? `${p.name} is in the group.`); if (!e) setFound(found.filter((x) => x.id !== p.id)); }}>Add to the group</button>
          </li>
        ))}
      </ul>
      {msg ? <p className="ws-muted" role="status">{msg}</p> : null}
      <p className="ws-muted">No email is sent. They will find the workspace under Workspaces when they sign in.</p>

      <h3 className="ws-h3">Invite link</h3>
      <p className="ws-muted">Anyone with an account who follows the link joins the group. Links expire after 30 days, and you can switch one off.</p>
      <div className="ws-row">
        <input type="text" aria-label="A name for this link" value={label} placeholder="A name for this link (optional)" onChange={(e) => setLabel(e.target.value)} />
        <button type="button" className="ws-btn ws-btn-small" onClick={async () => { const r = await s.createInvite({ label: label.trim() || undefined }); if (r.link) { setLink(r.link); setLabel(""); void load(); } else setMsg(r.error ?? "That did not work."); }}>Make a link</button>
      </div>
      {link ? <p role="status">Copy this link now; it is shown once: <input type="text" readOnly value={link} aria-label="The invite link" onFocus={(e) => e.currentTarget.select()} style={{ width: "100%" }} /></p> : null}
      {invites === null ? <p className="ws-muted">Invite links are not switched on yet.</p> : invites.length === 0 ? <p className="ws-muted">No links yet.</p> : (
        <ul className="ws-materials">
          {invites.map((i) => (
            <li key={i.id} className="ws-material">
              <span className="ws-material-name">{i.label || "Invite link"} · used {i.uses}{i.maxUses ? ` of ${i.maxUses}` : ""} times</span>
              <span className="ws-badge">{i.revoked ? "Off" : i.expiresAt && Date.parse(i.expiresAt) < Date.now() ? "Expired" : "On"}</span>
              {!i.revoked ? <button type="button" className="ws-linkbtn" onClick={async () => { await s.revokeInvite(i.id); void load(); }}>Switch off</button> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
