"use client";

import * as React from "react";

// ============================================================================
// An org's beneficiaries: the orgs and charities its listings and checkout
// may direct money to (migration 209; ORG_STORE_BRIEF D5, D6). Owners and
// guides keep the list; a listing form and the checkout read it.
//
// Presentational: the host passes the server actions.
// ============================================================================

export interface BeneficiaryItem {
  id: string;
  kind: "org" | "charity";
  name: string;
  registrationNo?: string | null;
  website?: string | null;
  blurb?: string | null;
  status?: "active" | "suggested" | "retired";
}

export interface BeneficiariesPanelProps {
  /** On the org's list, in order. */
  items: BeneficiaryItem[];
  /** Suggested by buyers, waiting for approval. */
  suggested?: BeneficiaryItem[];
  /** Network orgs that can be added with one click (not already listed). */
  addableOrgs?: BeneficiaryItem[];
  canEdit: boolean;
  onAddCharity?: (input: {
    name: string;
    registrationNo?: string;
    website?: string;
    blurb?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onAddOrg?: (payeeId: string) => Promise<{ ok: boolean; error?: string }>;
  onRemove?: (payeeId: string) => Promise<{ ok: boolean; error?: string }>;
  onApprove?: (payeeId: string) => Promise<{ ok: boolean; error?: string }>;
  heading?: React.ReactNode;
  intro?: React.ReactNode;
  className?: string;
}

export function BeneficiariesPanel({
  items,
  suggested = [],
  addableOrgs = [],
  canEdit,
  onAddCharity,
  onAddOrg,
  onRemove,
  onApprove,
  heading = "Beneficiaries",
  intro,
  className,
}: BeneficiariesPanelProps) {
  const [name, setName] = React.useState("");
  const [reg, setReg] = React.useState("");
  const [site, setSite] = React.useState("");
  const [blurb, setBlurb] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "That did not work.");
      else after?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={["eac-beneficiaries", className].filter(Boolean).join(" ")}>
      {heading && <h2 className="eac-beneficiaries__heading">{heading}</h2>}
      {intro && <p className="eac-beneficiaries__intro">{intro}</p>}

      <ul className="eac-beneficiaries__list">
        {items.length === 0 && (
          <li className="eac-beneficiaries__empty">No beneficiaries listed yet.</li>
        )}
        {items.map((p) => (
          <li key={p.id} className="eac-beneficiaries__row">
            <div className="eac-beneficiaries__who">
              <span className="eac-beneficiaries__name">{p.name}</span>
              <span className="eac-beneficiaries__meta">
                {p.kind === "org" ? "network organisation" : "charity"}
                {p.registrationNo ? ` · ${p.registrationNo}` : ""}
                {p.website ? (
                  <>
                    {" · "}
                    <a href={p.website} target="_blank" rel="noopener">
                      website
                    </a>
                  </>
                ) : null}
              </span>
              {p.blurb && <span className="eac-beneficiaries__blurb">{p.blurb}</span>}
            </div>
            {canEdit && onRemove && (
              <button
                type="button"
                className="eac-beneficiaries__remove"
                disabled={busy}
                onClick={() => run(() => onRemove(p.id))}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && suggested.length > 0 && onApprove && (
        <div className="eac-beneficiaries__suggested">
          <h3>Suggested by buyers</h3>
          <ul className="eac-beneficiaries__list">
            {suggested.map((p) => (
              <li key={p.id} className="eac-beneficiaries__row">
                <div className="eac-beneficiaries__who">
                  <span className="eac-beneficiaries__name">{p.name}</span>
                  {p.website && (
                    <span className="eac-beneficiaries__meta">
                      <a href={p.website} target="_blank" rel="noopener">
                        {p.website}
                      </a>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="eac-beneficiaries__button"
                  disabled={busy}
                  onClick={() => run(() => onApprove(p.id))}
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && addableOrgs.length > 0 && onAddOrg && (
        <div className="eac-beneficiaries__orgs">
          <h3>Network organisations</h3>
          <ul className="eac-beneficiaries__chips">
            {addableOrgs.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="eac-beneficiaries__chip"
                  disabled={busy}
                  onClick={() => run(() => onAddOrg(o.id))}
                >
                  + {o.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && onAddCharity && (
        <form
          className="eac-beneficiaries__add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(
              () =>
                onAddCharity({
                  name: name.trim(),
                  registrationNo: reg.trim() || undefined,
                  website: site.trim() || undefined,
                  blurb: blurb.trim() || undefined,
                }),
              () => {
                setName("");
                setReg("");
                setSite("");
                setBlurb("");
              }
            );
          }}
        >
          <h3>Add a charity</h3>
          <div className="eac-beneficiaries__fields">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Charity name"
              aria-label="Charity name"
            />
            <input
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="Registration no. (optional)"
              aria-label="Registration number"
            />
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="https://…"
              aria-label="Website"
              type="url"
            />
            <input
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="One line on what they do"
              aria-label="Blurb"
            />
          </div>
          <button type="submit" className="eac-beneficiaries__button" disabled={busy}>
            Add charity
          </button>
          {error && <p className="eac-beneficiaries__error">{error}</p>}
        </form>
      )}
      {!onAddCharity && error && <p className="eac-beneficiaries__error">{error}</p>}
    </section>
  );
}
