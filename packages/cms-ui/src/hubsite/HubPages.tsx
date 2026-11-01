import * as React from "react";

// ============================================================================
// The hub as cards that open PAGES (owner, 2026-10-08): each card is a plain
// link to its own route, and each route leads with a breadcrumb back
// ("Hub › Publish › Writing"). No SurfaceProvider is needed — nothing here
// opens a popup — so these render on the server.
//
//   HubCrumbs      the breadcrumb row
//   HubPageFrame   crumbs + title + intro + body, at the hub's width
//   HubCardGrid    the grid
//   HubLinkCard    one card: glyph, title, blurb, an optional live line
// ============================================================================

export interface HubCrumb {
  label: string;
  /** Omitted on the last crumb: it is the page you are on. */
  href?: string;
}

export function HubCrumbs({ items }: { items: HubCrumb[] }) {
  return (
    <nav className="eac-hp-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`}>
              {c.href && !last ? (
                <a href={c.href}>{c.label}</a>
              ) : (
                <span aria-current={last ? "page" : undefined}>{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface HubPageFrameProps {
  crumbs: HubCrumb[];
  title: string;
  intro?: React.ReactNode;
  /** Right of the title: a button or two. */
  actions?: React.ReactNode;
  /** Full hub width (1180px) instead of the reading width. */
  wide?: boolean;
  children: React.ReactNode;
}

export function HubPageFrame({ crumbs, title, intro, actions, wide, children }: HubPageFrameProps) {
  return (
    <main className={`eac-hp${wide ? " eac-hp--wide" : ""}`}>
      <HubCrumbs items={crumbs} />
      <header className="eac-hp-head">
        <div>
          <h1 className="eac-hp-title">{title}</h1>
          {intro ? <div className="eac-hp-intro">{intro}</div> : null}
        </div>
        {actions ? <div className="eac-hp-actions">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

export function HubCardGrid({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <ul className={className ? `eac-hp-grid ${className}` : "eac-hp-grid"} aria-label={label}>
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child, i) => (
          <li key={i}>{child}</li>
        ))}
    </ul>
  );
}

export interface HubLinkCardProps {
  href: string;
  title: string;
  blurb?: string;
  /** One character or a short symbol, drawn in the corner. */
  glyph?: string;
  /** A live line under the blurb: "3 documents · latest: Minutes". */
  meta?: React.ReactNode;
  /** Opens another site: new tab and an "↗" cue. */
  external?: boolean;
  /** Drawn larger, across two columns where there is room. */
  lead?: boolean;
}

export function HubLinkCard({ href, title, blurb, glyph, meta, external, lead }: HubLinkCardProps) {
  return (
    <a
      className={`eac-hp-card${lead ? " eac-hp-card--lead" : ""}`}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      <span className="eac-hp-card-top">
        {glyph ? (
          <span className="eac-hp-card-glyph" aria-hidden>
            {glyph}
          </span>
        ) : (
          <span />
        )}
        <span className="eac-hp-card-cue" aria-hidden>
          {external ? "↗" : "→"}
        </span>
      </span>
      <span className="eac-hp-card-title">{title}</span>
      {blurb ? <span className="eac-hp-card-blurb">{blurb}</span> : null}
      {meta ? <span className="eac-hp-card-meta">{meta}</span> : null}
    </a>
  );
}
