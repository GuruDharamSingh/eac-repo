"use client";

import { useState, useTransition } from "react";
import type { OrgRole } from "@elkdonis/services";
import { addPurelandMember, removePurelandMember, setPurelandRole } from "@/lib/pureland-actions";

interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
}

/** Owners: who may play, and who else may manage. Server actions re-check every call. */
export function ManageMembers({
  selfId,
  roles,
  members,
}: {
  selfId: string;
  roles: { role: OrgRole; label: string }[];
  members: Member[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const result = await action();
      setMessage(result.ok ? (result.message ? { ok: true, text: result.message } : null) : { ok: false, text: result.error ?? "Failed." });
    });

  return (
    <div className="pl-members">
      <form
        className="pl-add"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const result = await addPurelandMember(email, role);
            if (result.ok) setEmail("");
            return result;
          });
        }}
      >
        <input type="email" required placeholder="their@email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
        <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} aria-label="Role">
          {roles.map((r) => (
            <option key={r.role} value={r.role}>{r.label}</option>
          ))}
        </select>
        <button className="pl-button" type="submit" disabled={pending}>Add</button>
      </form>
      {message && <p className={message.ok ? "pl-note" : "pl-error"}>{message.text}</p>}

      <table className="pl-table">
        <thead>
          <tr><th>Person</th><th>Role</th><th /></tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId}>
              <td>
                <div>{m.name || m.email}</div>
                {m.name && <div className="pl-note">{m.email}</div>}
              </td>
              <td>
                {m.userId === selfId ? (
                  <span>{roles.find((r) => r.role === m.role)?.label ?? m.role} (you)</span>
                ) : (
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => run(() => setPurelandRole(m.userId, e.target.value as OrgRole))}
                    aria-label={`Role of ${m.email}`}
                  >
                    {roles.map((r) => (
                      <option key={r.role} value={r.role}>{r.label}</option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                {m.userId !== selfId && (
                  <button
                    type="button"
                    className="pl-link"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${m.name || m.email} from Pureland?`)) run(() => removePurelandMember(m.userId));
                    }}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
