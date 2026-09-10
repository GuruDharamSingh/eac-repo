import * as React from "react";

// ============================================================================
// A published piece of writing, wherever it is read.
//
// The same component renders a post on an org's subdomain, on its custom
// domain, and behind a card someone clicked in a feed — because a reader
// should not be able to tell which of those they are looking at. The reading
// measurements (measure, size, leading, the serif) are constant across the
// network; the accent and masthead are the org's.
//
// The colophon is the part that makes this a published RECORD rather than a
// page with words on it, and it costs nothing: every field is already in the
// database. `threads.author_id` is the person, `thread_orgs` is which
// organisations carry it, `published_at` is when it first appeared. A reader
// who can see where a piece came from treats it differently — not because the
// design is grander, but because the claim is checkable.
//
// Body HTML must be sanitized by the caller. This component does not sanitize,
// deliberately: sanitizing is a server concern with its own allowlist
// (@elkdonis/utils' sanitize), and a component that quietly cleaned its input
// would make it easy to forget on a path that renders some other way.
// ============================================================================

export interface ArticleOrg {
  /** Display name — the masthead line. */
  name: string;
  /** Public home, when this org has one. Makes the org name a link. */
  href?: string | null;
}

export interface ArticleProvenance {
  /** Every org carrying this piece: `threads.org_id` plus `thread_orgs`. */
  publishedOn?: ArticleOrg[];
  /** Where the words are kept, e.g. "Markdown, in the writer's own storage". */
  source?: string | null;
  /** The canonical address, shown as a record rather than as a link. */
  record?: string | null;
}

export interface ArticleViewProps {
  title: string;
  /** Standfirst under the headline. Falls back to nothing, not to the body. */
  lede?: string | null;
  /** Sanitized HTML. */
  bodyHtml: string;
  authorName?: string | null;
  /**
   * Rendered in a fixed, spelled-out format — never "3d ago". Accepts a Date
   * because apps map this column differently: postgres.js hands back a Date,
   * a serialised RSC payload hands back a string, and neither should have to
   * cast at the call site.
   */
  publishedAt?: string | Date | null;
  /** e.g. "Essay", "Notice". The kind, in the reader's words. */
  kindLabel?: string | null;
  org?: ArticleOrg | null;
  coverImageUrl?: string | null;
  /** Minutes. Omit to hide — an estimate nobody asked for is noise. */
  readingMinutes?: number | null;
  provenance?: ArticleProvenance | null;
  /**
   * Which voice to read in. All three share the same structure — measure,
   * rhythm, where the apparatus sits — and differ in typeface, rule weight and
   * whether there is a drop cap. An org can also override any individual
   * --read-* token in its own CSS instead of, or on top of, a preset.
   *
   *   journal  humanist serif, generous, drop cap        (default)
   *   gazette  tighter, heavier rules, no cap            notices and news
   *   quiet    sans, no cap, no rules                    modern and restrained
   */
  reading?: ReadingVoice;
  /** Rendered under the colophon: a live editor's controls, a back link. */
  children?: React.ReactNode;
}

export type ReadingVoice = "journal" | "gazette" | "quiet";

/**
 * Spelled-out and absolute. Relative times ("3 days ago") are for feeds, where
 * recency is the point; on a published record the date is part of the claim
 * and has to stay true when someone reads it in a year.
 */
function formatDate(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ArticleView({
  title,
  lede,
  bodyHtml,
  authorName,
  publishedAt,
  kindLabel,
  org,
  coverImageUrl,
  readingMinutes,
  provenance,
  reading = "journal",
  children,
}: ArticleViewProps) {
  const date = publishedAt ? formatDate(publishedAt) : null;

  // Only render the rules around the byline when there is something between
  // them — an empty bordered strip reads as a mistake.
  const bylineParts: React.ReactNode[] = [];
  if (authorName) bylineParts.push(<strong key="a">{authorName}</strong>);
  if (date) bylineParts.push(<span key="d">{date}</span>);
  if (readingMinutes) bylineParts.push(<span key="r">{readingMinutes} min</span>);

  const publishedOn = provenance?.publishedOn ?? [];

  return (
    <article className="eac-article" data-reading={reading}>
      {(kindLabel || org) && (
        <div className="eac-article__eyebrow">
          {kindLabel && <p className="eac-article__label">{kindLabel}</p>}
          {org && (
            <p className="eac-article__label eac-article__label--org">
              {org.href ? <a href={org.href}>{org.name}</a> : org.name}
            </p>
          )}
        </div>
      )}

      <h1 className="eac-article__title">{title}</h1>

      {lede && <p className="eac-article__lede">{lede}</p>}

      {bylineParts.length > 0 && (
        <div className="eac-article__byline">
          {bylineParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="eac-article__sep" aria-hidden="true">
                  ·
                </span>
              )}
              {part}
            </React.Fragment>
          ))}
        </div>
      )}

      {coverImageUrl && (
        <img className="eac-article__cover" src={coverImageUrl} alt="" />
      )}

      <div
        className="eac-article__body"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {(authorName || publishedOn.length > 0 || provenance?.source || provenance?.record) && (
        <footer className="eac-article__colophon">
          <dl>
            {authorName && (
              <>
                <dt>Written by</dt>
                <dd>{authorName}</dd>
              </>
            )}
            {publishedOn.length > 0 && (
              <>
                <dt>Published on</dt>
                <dd>{publishedOn.map((o) => o.name).join(" · ")}</dd>
              </>
            )}
            {date && (
              <>
                <dt>First published</dt>
                <dd>{date}</dd>
              </>
            )}
            {provenance?.source && (
              <>
                <dt>Source</dt>
                <dd>{provenance.source}</dd>
              </>
            )}
            {provenance?.record && (
              <>
                <dt>Record</dt>
                <dd>{provenance.record}</dd>
              </>
            )}
          </dl>
        </footer>
      )}

      {children}
    </article>
  );
}
