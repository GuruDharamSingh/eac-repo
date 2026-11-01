"use client";

import * as React from "react";

// ============================================================================
// Who may act for a store — the `store_member` roll, edited from an org's
// manage page, the network hub, or the store's own desk. One panel for all
// three (ORG_STORE_BRIEF R9), plain CSS on the host's tokens (store.css).
//
// The roll is deliberately NOT the org's membership (migration 094): being a
// member of the org should not let you price its work. Owners and guides of
// the org, and store owners, edit it; everyone on it can see it.
//
// Presentational: the host passes the server actions.
// ============================================================================

export type StoreTeamRole = "owner" | "manager" | "staff";

export interface StoreTeamMember {
  userId: string;
  role: StoreTeamRole;
  displayName?: string | null;
  email?: string | null;
}

export interface StoreTeamPanelProps {
  members: StoreTeamMember[];
  canEdit: boolean;
  selfUserId?: string | null;
  /** Seat someone by email. Returns an error message, or nothing on success. */
  onAdd?: (email: string, role: StoreTeamRole) => Promise<{ ok: boolean; error?: string }>;
  onRemove?: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Heading above the list. Default "Store team". */
  heading?: React.ReactNode;
  className?: string;
}

const ROLE_LABEL: Record<StoreTeamRole, string> = {
  owner: "owner — also the team",
  manager: "manager — also sales",
  staff: "staff — list & edit work",
};

export function StoreTeamPanel({
  members,
  canEdit,
  selfUserId,
  onAdd,
  onRemove,
  heading = "Store team",
  className,
}: StoreTeamPanelProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StoreTeamRole>("staff");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!onAdd || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onAdd(email.trim(), role);
      if (!r.ok) setError(r.error ?? "Could not add them.");
      else setEmail("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (!onRemove) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onRemove(userId);
      if (!r.ok) setError(r.error ?? "Could not remove them.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={["eac-store-team", className].filter(Boolean).join(" ")}>
      {heading && <h2 className="eac-store-team__heading">{heading}</h2>}
      <ul className="eac-store-team__list">
        {members.length === 0 && (
          <li className="eac-store-team__empty">Nobody on the roll yet.</li>
        )}
        {members.map((m) => (
          <li key={m.userId} className="eac-store-team__row">
            <div className="eac-store-team__who">
              <span className="eac-store-team__name">
                {m.displayName?.trim() || m.email || "Member"}
                {selfUserId && m.userId === selfUserId && (
                  <span className="eac-store-team__you"> (you)</span>
                )}
              </span>
              {m.email && m.displayName && (
                <span className="eac-store-team__email">{m.email}</span>
              )}
            </div>
            <div className="eac-store-team__right">
              <span className="eac-store-team__role">{m.role}</span>
              {canEdit && onRemove && (
                <button
                  type="button"
                  className="eac-store-team__remove"
                  disabled={busy}
                  onClick={() => remove(m.userId)}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && onAdd && (
        <form className="eac-store-team__add" onSubmit={add}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            className="eac-store-team__input"
            aria-label="Email of the person to add"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as StoreTeamRole)}
            className="eac-store-team__select"
            aria-label="Role"
          >
            {(Object.keys(ROLE_LABEL) as StoreTeamRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button type="submit" className="eac-store-team__button" disabled={busy}>
            Add
          </button>
          {error && <p className="eac-store-team__error">{error}</p>}
        </form>
      )}
    </section>
  );
}
