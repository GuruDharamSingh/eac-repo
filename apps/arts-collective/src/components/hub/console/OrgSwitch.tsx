"use client";

import * as React from "react";
import Link from "next/link";

/**
 * Which of your organisations the page is showing: one compact control instead of the row of
 * large org cards. It names the current organisation and your part in it; with more than one
 * it opens a short list of the others, each a plain link to `?org=<slug>` (the same address
 * the old strip wrote, so the server page needs nothing new). With one organisation there is
 * nothing to switch to and it is just the name.
 */
export interface OrgSwitchItem {
  slug: string;
  name: string;
  /** user_organizations.role: owner, guide, member, viewer. */
  role: string;
}

/** Never "viewer" to a person: the relation is called following. */
const ROLE_WORD: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Following",
};

const href = (slug: string) => `/hub/organization?org=${encodeURIComponent(slug)}`;

export function OrgSwitch({ orgs, current }: { orgs: OrgSwitchItem[]; current: string }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const here = orgs.find((o) => o.slug === current) ?? orgs[0];

  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!here) return null;
  const role = ROLE_WORD[here.role] ?? here.role;

  if (orgs.length < 2) {
    return (
      <div className="orgp-org">
        <h1 className="orgp-org-solo">
          <span className="orgp-org-name">{here.name}</span>
          <span className="orgp-org-role">{role}</span>
        </h1>
      </div>
    );
  }

  return (
    <div className="orgp-org" ref={root}>
      <h1 className="orgp-org-h">
        <button
          type="button"
          className="orgp-org-btn"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${here.name}, ${role}. Change organization`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="orgp-org-name">{here.name}</span>
          <span className="orgp-org-role">{role}</span>
          <span className="orgp-org-caret" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>
      </h1>
      <ul id={listId} className="orgp-org-list" hidden={!open}>
        {orgs.map((o) => {
          const isHere = o.slug === here.slug;
          return (
            <li key={o.slug}>
              {isHere ? (
                <span className="orgp-org-item is-here" aria-current="true">
                  <span className="orgp-org-name">{o.name}</span>
                  <span className="orgp-org-role">{ROLE_WORD[o.role] ?? o.role}</span>
                </span>
              ) : (
                <Link className="orgp-org-item" href={href(o.slug)} onClick={() => setOpen(false)}>
                  <span className="orgp-org-name">{o.name}</span>
                  <span className="orgp-org-role">{ROLE_WORD[o.role] ?? o.role}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
