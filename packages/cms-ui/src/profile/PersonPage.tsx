import * as React from "react";

/**
 * PersonPage — a person's page on one site, from their network profile.
 *
 * Structure taken from IFAC's /artists/[slug] (the interim standard,
 * docs/open/PERSON_PAGES_BRIEF_2026-09-26.md decision 4): an intro (name,
 * role, back link, claim prompt), a two-column body (sidebar with portrait,
 * bio and links; featured work beside it), then the person's sections in the
 * org's order.
 *
 * A server component with no data access: the host loads the page through
 * `getPersonPage` (@elkdonis/services) and passes the rendered sections as
 * slots, because links (thread routes, writing readers, galleries) and some
 * sections (store, editor panels) are site-specific. Colours come from
 * `--eac-person-*` custom properties, which default to inheriting the site;
 * see person-page.css.
 */

export interface PersonPageLink {
  label?: string | null;
  url: string;
}

export interface PersonPagePerson {
  displayName: string;
  /** Org role title, else the person's headline. */
  role?: string | null;
  /** Plain text; blank lines separate paragraphs. */
  bio?: string | null;
  /**
   * HTML bio, rendered as given. The caller sanitises it (`sanitizeRichText`
   * from @elkdonis/utils): this component does not. Wins over `bio`.
   */
  bioHtml?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  verified?: boolean;
  socialLinks?: PersonPageLink[];
}

export interface PersonPageProps {
  person: PersonPagePerson;
  /** "← Artists" and the like. */
  back?: { href: string; label: string } | null;
  /** Under the role: claim prompt, notices. */
  intro?: React.ReactNode;
  /** Owner tools, above the body (inline editor bar). */
  editor?: React.ReactNode;
  /** Below the links in the sidebar ("Email for pricing"). */
  sidebarExtra?: React.ReactNode;
  /**
   * The featured-work column. Omit to render `portfolio` read-only; pass
   * null to drop the column (the sidebar then spans the body).
   */
  featured?: React.ReactNode | null;
  portfolio?: { url: string; title?: string | null }[];
  /** Shown in the featured column when there is no work. Null hides the column instead. */
  emptyFeatured?: string | null;
  /** Section keys in display order (from getPersonPage's `sections`). */
  order?: string[];
  /** Rendered section per key; null/undefined keys are skipped. */
  slots?: Record<string, React.ReactNode>;
  /** Link to the person's root page on ArtDirect. */
  networkLink?: { href: string; label?: string } | null;
  /** Anything after the sections (IFAC's network feed). */
  after?: React.ReactNode;
  className?: string;
}

function paragraphs(bio: string | null | undefined): string[] {
  if (!bio) return [];
  return bio
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function linkLabel(link: PersonPageLink): string {
  if (link.label) return link.label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

export function PersonPage({
  person,
  back,
  intro,
  editor,
  sidebarExtra,
  featured,
  portfolio = [],
  emptyFeatured = "Work coming soon.",
  order = [],
  slots = {},
  networkLink,
  after,
  className,
}: PersonPageProps) {
  const bio = paragraphs(person.bio);
  const links = (person.socialLinks ?? []).filter((l) => l.url);

  let featuredColumn: React.ReactNode = null;
  if (featured !== undefined) {
    featuredColumn = featured;
  } else if (portfolio.length > 0) {
    featuredColumn = (
      <ul className="eac-person-work">
        {portfolio.map((item, i) => (
          <li key={`${item.url}-${i}`}>
            <img src={item.url} alt={item.title ?? ""} loading="lazy" />
            {item.title && <span>{item.title}</span>}
          </li>
        ))}
      </ul>
    );
  } else if (emptyFeatured) {
    featuredColumn = <p className="eac-person-empty">{emptyFeatured}</p>;
  }

  const rendered = order
    .map((key) => ({ key, node: slots[key] }))
    .filter((s) => s.node !== null && s.node !== undefined && s.node !== false);

  return (
    <div className={["eac-person-page", className].filter(Boolean).join(" ")} data-person-page="">
      <header className="eac-person-intro">
        {back && (
          <a className="eac-person-back" href={back.href}>
            {back.label}
          </a>
        )}
        <h1 className="eac-person-name">{person.displayName}</h1>
        {(person.role || person.city) && (
          <p className="eac-person-role">
            {[person.role, person.city].filter(Boolean).join(" · ")}
            {person.verified && <span className="eac-person-verified"> · Verified</span>}
          </p>
        )}
        {intro}
      </header>

      {editor && <div className="eac-person-editor">{editor}</div>}

      <div className={featuredColumn ? "eac-person-body" : "eac-person-body eac-person-body--single"}>
        <aside className="eac-person-sidebar eac-person-panel">
          {person.avatarUrl && (
            <img className="eac-person-portrait" src={person.avatarUrl} alt={person.displayName} />
          )}
          {person.bioHtml ? (
            <div className="eac-person-bio" data-trait="bio" dangerouslySetInnerHTML={{ __html: person.bioHtml }} />
          ) : bio.length > 0 && (
            <div className="eac-person-bio" data-trait="bio">
              {bio.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {sidebarExtra}
          {links.length > 0 && (
            <ul className="eac-person-links">
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {linkLabel(l)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {networkLink && (
            <p className="eac-person-network">
              <a href={networkLink.href}>{networkLink.label ?? "Full page on ArtDirect"}</a>
            </p>
          )}
        </aside>
        {featuredColumn && <section className="eac-person-featured eac-person-panel">{featuredColumn}</section>}
      </div>

      {rendered.map(({ key, node }) => (
        <div key={key} className="eac-person-slot" data-person-section={key}>
          {node}
        </div>
      ))}

      {after}
    </div>
  );
}

/** A titled panel for a section. */
export function PersonSectionPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="eac-person-section eac-person-panel">
      <div className="eac-person-section-head">
        <h2 className="eac-person-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface PersonListItem {
  href: string;
  title: string;
  /** Date, place, "on <org>". */
  meta?: string | null;
  excerpt?: string | null;
  /** Opens on another site. */
  external?: boolean;
  draft?: boolean;
}

/** Posts or events as a list of links. */
export function PersonThreadList({
  title,
  items,
  empty,
}: {
  title: string;
  items: PersonListItem[];
  /** Shown to the owner when there is nothing; omit to render nothing. */
  empty?: string | null;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <PersonSectionPanel title={title}>
      {items.length === 0 ? (
        <p className="eac-person-empty">{empty}</p>
      ) : (
        <ul className="eac-person-list">
          {items.map((item) => (
            <li key={item.href}>
              <a href={item.href} {...(item.external ? { rel: "noreferrer" } : {})}>
                {item.title}
              </a>
              {item.draft && <span className="eac-person-draft">Draft</span>}
              {item.meta && <p className="eac-person-meta">{item.meta}</p>}
              {item.excerpt && <p className="eac-person-excerpt">{item.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </PersonSectionPanel>
  );
}

export interface PersonGalleryCard {
  href: string;
  title: string;
  coverUrl?: string | null;
  meta?: string | null;
  draft?: boolean;
}

/** Gallery pages as cards (read-only; IFAC keeps its own editable section). */
export function PersonGalleryCards({ title = "Galleries", items }: { title?: string; items: PersonGalleryCard[] }) {
  if (items.length === 0) return null;
  return (
    <PersonSectionPanel title={title}>
      <ul className="eac-person-cards">
        {items.map((g) => (
          <li key={g.href}>
            <a className="eac-person-card" href={g.href}>
              {g.coverUrl ? (
                <img className="eac-person-card-cover" src={g.coverUrl} alt="" loading="lazy" />
              ) : (
                <span className="eac-person-card-cover eac-person-card-cover--blank" aria-hidden="true" />
              )}
              <span className="eac-person-card-body">
                <span className="eac-person-card-title">{g.title}</span>
                {g.meta && <span className="eac-person-meta">{g.meta}</span>}
                {g.draft && <span className="eac-person-draft">Hidden</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </PersonSectionPanel>
  );
}
