"use client";

import * as React from "react";

// ============================================================================
// "Asking to be shown" — the organiser's half of Where you show.
//
// Members are shown on their org's site by default; someone who hid
// themselves asks to come back, and an owner or guide answers here
// (migration 149, Brief A). The host passes the pending asks and a `decide`
// bound to its own server action, which re-checks the decider's role. With
// nothing pending this renders nothing at all.
// ============================================================================

export interface ListingRequestItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Their public page, when the host knows it. */
  href?: string | null;
  createdAt: string;
}

export function ListingRequests({
  requests,
  orgName,
  decide,
}: {
  requests: ListingRequestItem[];
  orgName: string;
  decide: (requestId: string, decision: "approve" | "decline") => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [items, setItems] = React.useState(requests);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setItems(requests), [requests]);

  if (items.length === 0) return null;

  async function answer(id: string, decision: "approve" | "decline") {
    setBusy(id);
    setError(null);
    const result = await decide(id, decision).catch(() => ({ ok: false as const, error: "Could not save that." }));
    setBusy(null);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setItems((list) => list.filter((r) => r.id !== id));
  }

  return (
    <section
      aria-label="Asking to be shown"
      className="grid gap-3 rounded-[var(--sf-radius)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] p-4 text-[color:var(--sf-fg)]"
    >
      <div className="grid gap-1">
        <h2 className="m-0 text-[1.05rem] font-semibold">
          Asking to be shown on {orgName} <span className="text-[color:var(--sf-muted)]">· {items.length}</span>
        </h2>
        <p className="m-0 text-[0.85rem] text-[color:var(--sf-muted)]">
          Members show by default. These people hid themselves and would like to be listed again.
        </p>
      </div>
      <ul className="m-0 grid list-none gap-0 p-0">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-3 first:border-t-0"
          >
            <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
              {r.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              {r.href ? (
                <a className="truncate font-semibold underline underline-offset-2" href={r.href} target="_blank" rel="noopener">
                  {r.displayName}
                </a>
              ) : (
                <span className="truncate font-semibold">{r.displayName}</span>
              )}
              <span className="text-[0.8rem] text-[color:var(--sf-muted)]">
                asked {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </span>
            {/* Own row on a phone, so the name is not squeezed to a letter. */}
            <span className="flex w-full justify-end gap-2 sm:w-auto">
              <button
                type="button"
                className="eac-btn"
                disabled={busy === r.id}
                onClick={() => void answer(r.id, "decline")}
              >
                Not now
              </button>
              <button
                type="button"
                className="eac-btn eac-btn--primary"
                disabled={busy === r.id}
                onClick={() => void answer(r.id, "approve")}
              >
                {busy === r.id ? "…" : "Show them"}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 text-[0.85rem] text-[color:var(--sf-danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
