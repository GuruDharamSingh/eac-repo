import type { ReactNode } from "react";

/**
 * The plain, readable alternative to a Silex profile template.
 *
 * Presentational only, and deliberately a SERVER component: a public profile
 * page is the kind of thing that wants to be indexable and cheap, so nothing
 * here is interactive. Everything that needs client state — the inline
 * editor, the work gallery, activity feeds — arrives as a slot, because those
 * are wired to server actions that must be defined in the consuming app.
 * That is what lets ArtDirect and arts-collective share this page while each
 * keeps its own upload and save endpoints.
 *
 * Styling is plain CSS driven by custom properties (see profile.css), not
 * Mantine and not Tailwind utilities, so it renders the same in both a
 * shadcn/Tailwind app and a plain-CSS one. The person's own palette reaches
 * it through the --paper/--ink/--line/--gold tokens that ThemeStyle injects;
 * the fallbacks reproduce the dark ArtDirect defaults, so an unthemed page is
 * unchanged.
 */

export interface ProfileViewLink {
  label?: string | null;
  url: string;
}

/**
 * Deliberately narrow and structural rather than importing Profile from
 * @elkdonis/services: this package stays free of the data layer so it can be
 * rendered from anything that can produce these fields.
 */
export interface ProfileViewPerson {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  pronouns?: string | null;
  city?: string | null;
  verified?: boolean;
  portfolioUrl?: string | null;
  socialLinks?: ProfileViewLink[];
}

export interface ProfileViewProps {
  person: ProfileViewPerson;
  /**
   * True when the viewer owns this page. Keeps the bio and work sections
   * rendered even when empty, so there is something to edit into rather than
   * a page that hides its own affordances.
   */
  isSelf?: boolean;
  /** Inline editor, shown above the statement when isSelf. */
  editor?: ReactNode;
  /** The work grid. Supplied by the app so it carries that app's save action. */
  gallery?: ReactNode;
  /** Anything to append after the standard sections (activity, actions). */
  children?: ReactNode;
}

export function ProfileView({
  person,
  isSelf = false,
  editor,
  gallery,
  children,
}: ProfileViewProps) {
  // A bio is authored as prose with blank-line breaks, not HTML — split it
  // rather than dangerouslySetInnerHTML, since this text is user-supplied.
  const paragraphs = (person.bio ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const links = person.socialLinks ?? [];
  const hasLinks = links.length > 0 || Boolean(person.portfolioUrl);
  const meta = [person.pronouns, person.city].filter(Boolean).join(" · ");

  return (
    <article className="eac-profile">
      <header className="eac-profile-head">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="eac-profile-portrait" src={person.avatarUrl} alt="" />
        ) : (
          <div
            className="eac-profile-portrait eac-profile-portrait--empty"
            aria-hidden
          >
            {person.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="eac-profile-id">
          <h1>{person.displayName}</h1>
          {person.headline && (
            <p className="eac-profile-headline">{person.headline}</p>
          )}
          {(meta || person.verified) && (
            <p className="eac-profile-meta">
              {meta}
              {person.verified && (
                <span className="eac-profile-verified">Verified</span>
              )}
            </p>
          )}
        </div>
      </header>

      {isSelf && editor}

      {(paragraphs.length > 0 || isSelf) && (
        <section className="eac-profile-bio" data-trait="bio">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}

      {gallery && (
        <section className="eac-profile-work">
          <h2>Work</h2>
          {gallery}
        </section>
      )}

      {hasLinks && (
        <section className="eac-profile-links">
          <h2>Elsewhere</h2>
          <ul>
            {person.portfolioUrl && (
              <li>
                <a href={person.portfolioUrl} target="_blank" rel="noreferrer">
                  Portfolio
                </a>
              </li>
            )}
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label || l.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}
    </article>
  );
}
