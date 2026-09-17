import * as React from 'react';

// ============================================================================
// The shelf — a person's writing, as a place you browse rather than a list.
//
// The room around the reading. `ArticleView` sets one piece; this sets the
// approach to it, and the two are built from the same --read-* tokens so the
// shelf and the article are unmistakably the same publication. An org that
// changes its reading voice moves both at once.
//
// Presentational and serialisable on purpose: no data access, no callbacks,
// `basePath` rather than a `hrefFor` function, so it renders as a server
// component inside any app. Whatever a host wants to put under it — a form to
// start a piece, a back link — comes in as children.
// ============================================================================

export interface ShelfItem {
  id: string;
  slug: string;
  title: string;
  /** The standfirst. Shown under the title on the lead piece and the rows. */
  lede?: string | null;
  coverImageUrl?: string | null;
  status?: 'draft' | 'published';
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  readingMinutes?: number | null;
}

export interface WritingShelfProps {
  items: ShelfItem[];
  /** Post links are `${basePath}/${slug}`. No trailing slash. */
  basePath: string;
  /** The room's name. */
  heading?: string;
  /** Whose writing this is — set in the record face above the heading. */
  kicker?: string | null;
  /** A standing note under the heading: what this person writes about. */
  intro?: string | null;
  /**
   * The owner's view: drafts are listed and marked. Never pass true for a
   * visitor — the caller decides, this only changes presentation.
   */
  showDrafts?: boolean;
  /**
   * The first published piece is set larger, with its cover. Turn off for a
   * plain chronological list.
   */
  lead?: boolean;
  /** Shown in place of the list when there is nothing to show. */
  emptyNote?: string;
  /** A "start a piece" form, a back link — whatever the host needs. */
  children?: React.ReactNode;
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The dateline under a title: date, then length, then nothing else. */
function Dateline({ item }: { item: ShelfItem }) {
  const date = formatDate(item.publishedAt ?? item.updatedAt);
  const parts: string[] = [];
  // Not the word "Draft" — the chip beside the title already says it, and
  // saying it twice in one card reads as two different facts.
  if (date) parts.push(date);
  if (item.readingMinutes) parts.push(`${item.readingMinutes} min`);
  if (parts.length === 0) return null;
  return <p className="eac-shelf__dateline">{parts.join(' · ')}</p>;
}

export function WritingShelf({
  items,
  basePath,
  heading = 'Writing',
  kicker,
  intro,
  showDrafts = false,
  lead = true,
  emptyNote = 'Nothing published yet.',
  children,
}: WritingShelfProps) {
  const base = basePath.replace(/\/$/, '');
  const visible = showDrafts ? items : items.filter((i) => i.status !== 'draft');

  // The lead is the first PUBLISHED piece, never a draft: an owner looking at
  // their own shelf should see it arranged the way a reader will.
  const leadIndex = lead ? visible.findIndex((i) => i.status !== 'draft') : -1;
  const leadItem = leadIndex >= 0 ? visible[leadIndex] : null;
  const rest = leadItem ? visible.filter((_, i) => i !== leadIndex) : visible;

  return (
    <section className="eac-shelf" aria-labelledby="eac-shelf-heading">
      <header className="eac-shelf__head">
        {kicker && <p className="eac-shelf__kicker">{kicker}</p>}
        <h2 className="eac-shelf__heading" id="eac-shelf-heading">
          {heading}
        </h2>
        {intro && <p className="eac-shelf__intro">{intro}</p>}
      </header>

      {visible.length === 0 ? (
        <p className="eac-shelf__empty">{emptyNote}</p>
      ) : (
        <div className="eac-shelf__body">
          {leadItem && (
            <a
              className="eac-shelf__lead"
              href={`${base}/${leadItem.slug}`}
              data-has-cover={leadItem.coverImageUrl ? 'true' : 'false'}
            >
              {leadItem.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="eac-shelf__lead-cover"
                  src={leadItem.coverImageUrl}
                  alt=""
                  loading="lazy"
                />
              )}
              <div className="eac-shelf__lead-text">
                <h3 className="eac-shelf__lead-title">{leadItem.title}</h3>
                {leadItem.lede && <p className="eac-shelf__lede">{leadItem.lede}</p>}
                <Dateline item={leadItem} />
              </div>
            </a>
          )}

          {(rest.length > 0 || children) && (
            <ol className="eac-shelf__list">
              {rest.map((item) => (
                <li key={item.id} className="eac-shelf__row">
                  <a className="eac-shelf__row-link" href={`${base}/${item.slug}`}>
                    <div className="eac-shelf__row-text">
                      <h3 className="eac-shelf__row-title">
                        {item.title}
                        {item.status === 'draft' && (
                          <span className="eac-shelf__draft">Draft</span>
                        )}
                      </h3>
                      {item.lede && <p className="eac-shelf__lede">{item.lede}</p>}
                      <Dateline item={item} />
                    </div>
                    {item.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="eac-shelf__row-cover"
                        src={item.coverImageUrl}
                        alt=""
                        loading="lazy"
                      />
                    )}
                  </a>
                </li>
              ))}

              {/* "Start a piece" is the LAST ROW of the shelf, not a footer
                  under it.
                  It used to sit outside the <ol>, which meant the alternating
                  grounds stopped one row short of it — and that row is the one
                  worth marking, because it is where publishing begins. In the
                  list it takes the next parity slot automatically, so the
                  rhythm simply continues into it and the shelf reads as one
                  sequence ending in "and here is how you add to it". */}
              {children && (
                <li className="eac-shelf__row eac-shelf__row--start">{children}</li>
              )}
            </ol>
          )}
        </div>
      )}

      {/* With nothing on the shelf there is no list to join, so the starter
          keeps its own footing. */}
      {visible.length === 0 && children && (
        <div className="eac-shelf__foot">{children}</div>
      )}
    </section>
  );
}
