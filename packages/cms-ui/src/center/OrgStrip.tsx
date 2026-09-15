import * as React from "react";

// ============================================================================
// "Where you are" — the viewer's orgs, as one idiom wherever they are shown.
//
// A person on this network belongs to several organisations at once, and the
// question "which one am I standing in, and what am I in the others?" comes
// up on /center and again on the network hub's Organization tab. It was a
// list of pills in one place and a <select> in the other; this is the one
// answer both now use.
//
// Past `minToSlide` orgs the strip slides, reusing the same slider the
// network feed uses — one slider on a page, not two. Below that they stack as
// pills, where a slider would be ceremony for two items.
//
// A server component on purpose: these are links, and nothing here holds
// state. The page that renders it decides where each card goes.
// ============================================================================

export interface OrgStripItem {
  orgId: string;
  orgSlug: string;
  orgName: string;
  /** `user_organizations.role` — owner · guide · member · viewer. */
  role: string;
  /** The org whose site (or tab) the viewer is currently on. */
  isCurrent: boolean;
  /** Where the card goes. Null renders it as plain text — the one you are on. */
  href: string | null;
  /** A line under the name: "2 RSVPs", "hub →", whatever the host wants said. */
  note?: string | null;
}

/** Never "viewer" to a person: the relation is called following. */
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Following",
};

export function OrgStrip({
  orgs,
  minToSlide = 3,
}: {
  orgs: OrgStripItem[];
  /** Fewer than this many stack as pills instead of sliding. */
  minToSlide?: number;
}) {
  if (orgs.length === 0) return null;

  if (orgs.length >= minToSlide) {
    return (
      <div className="eac-center-slider" role="list">
        {orgs.map((o) => (
          <div role="listitem" key={o.orgId} className="eac-center-org-slide">
            <OrgCard org={o} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="eac-center-orgs">
      {orgs.map((o) => (
        <OrgPill key={o.orgId} org={o} />
      ))}
    </ul>
  );
}

/** The line under the name. Empty means no element at all, not an empty one. */
function noteFor(org: OrgStripItem, withRole: boolean): string {
  return [withRole ? ROLE_LABEL[org.role] ?? org.role : null, org.note]
    .filter(Boolean)
    .join(" · ");
}

/** The card form: the name large, the relation above it, the current one marked. */
function OrgCard({ org }: { org: OrgStripItem }) {
  const body = (
    <>
      <span className="eac-face-kicker">
        {org.isCurrent ? "You are here" : ROLE_LABEL[org.role] ?? org.role}
      </span>
      <span className="eac-center-org-slide-name">{org.orgName}</span>
      {noteFor(org, org.isCurrent) && (
        <span className="eac-center-org-note">{noteFor(org, org.isCurrent)}</span>
      )}
    </>
  );
  const cls = `eac-face eac-center-org-card${org.isCurrent ? " is-current" : ""}`;
  return org.href ? (
    <a className={cls} data-kind="neutral" href={org.href}>
      {body}
    </a>
  ) : (
    <div className={cls} data-kind="neutral">
      {body}
    </div>
  );
}

/** The pill form: the same facts on one line, for one or two orgs. */
function OrgPill({ org }: { org: OrgStripItem }) {
  const body = (
    <>
      <span className="eac-center-org-name">
        {org.isCurrent && <span aria-hidden>✓ </span>}
        {org.orgName}
      </span>
      <span className="eac-center-org-note">{noteFor(org, true)}</span>
    </>
  );
  return (
    <li className={`eac-center-org-pill${org.isCurrent ? " is-current" : ""}`}>
      {org.href ? <a href={org.href}>{body}</a> : <span>{body}</span>}
    </li>
  );
}
