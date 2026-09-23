import * as React from "react";

// ============================================================================
// Your organisations, with a door into each — the network hub's switcher
// (Brief A slice 4).
//
// OrgStrip answers "which org am I in?" on an org's own /center. This is the
// same answer with more said per org — your role, its tier, a fact or two —
// and more than one door: its hub (where you work) and its site (where the
// public sees it). The host decides every href; an "Open site" the host
// cannot vouch for (no verified domain — *.arts-collective.com has no DNS in
// production) is simply not passed, so no dead link is drawn.
//
// A server component: links only, no state.
// ============================================================================

export interface OrgSwitcherAction {
  label: string;
  href: string;
  /** Opens in a new tab — another site. */
  external?: boolean;
  primary?: boolean;
}

export interface OrgSwitcherItem {
  orgId: string;
  orgName: string;
  /** `user_organizations.role`. Never shown as "viewer". */
  role: string;
  /** `organizations.tier`, when the host wants it said. */
  tier?: string | null;
  /** The org the viewer is working in right now. */
  isCurrent: boolean;
  /** Short facts: "12 members", "4 published". */
  facts?: string[];
  actions: OrgSwitcherAction[];
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Following",
};

const TIER_LABEL: Record<string, string> = {
  partner: "Partner",
  supported: "Supported",
  free: "Free",
};

export function OrgSwitcher({ orgs, title = "Your organisations" }: { orgs: OrgSwitcherItem[]; title?: string }) {
  if (orgs.length === 0) return null;
  return (
    <section aria-label={title} className="grid gap-3">
      <h2 className="m-0 font-[family-name:var(--sf-font-record)] text-[0.7rem] uppercase tracking-[0.16em] text-[color:var(--sf-muted)]">
        {title}
      </h2>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((o) => (
          <li
            key={o.orgId}
            aria-current={o.isCurrent ? "true" : undefined}
            className={
              "flex flex-col justify-between gap-3 rounded-[var(--sf-radius)] border bg-[color:var(--sf-bg)] p-4 text-[color:var(--sf-fg)] " +
              (o.isCurrent ? "border-2 border-[color:var(--sf-fg)]" : "border-[color:var(--sf-line)]")
            }
          >
            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[0.72rem]">
                <span className="rounded-full border border-[color:var(--sf-fg)] px-2 py-0.5 font-semibold">
                  {ROLE_LABEL[o.role] ?? o.role}
                </span>
                {o.tier && (
                  <span className="rounded-full border border-[color:var(--sf-muted)] px-2 py-0.5 text-[color:var(--sf-muted)]">
                    {TIER_LABEL[o.tier] ?? o.tier}
                  </span>
                )}
                {o.isCurrent && <span className="ml-auto font-semibold">✓ Working here</span>}
              </div>
              <span className="font-[family-name:var(--sf-font-title)] text-[1.2rem] leading-tight">{o.orgName}</span>
              {o.facts && o.facts.length > 0 && (
                <span className="text-[0.8rem] text-[color:var(--sf-muted)]">{o.facts.join(" · ")}</span>
              )}
            </div>
            {o.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {o.actions.map((a) => (
                  <a
                    key={a.label}
                    href={a.href}
                    className={"eac-btn" + (a.primary ? " eac-btn--primary" : "")}
                    {...(a.external ? { target: "_blank", rel: "noopener" } : {})}
                  >
                    {a.label}
                    {a.external ? " ↗" : ""}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
