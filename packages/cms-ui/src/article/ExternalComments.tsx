/**
 * "From Facebook": comments left on the outside copy of a piece, shown
 * under it (thread_external_comments, 2026-11-01). Plain markup on the
 * reading tokens; the host loads the rows and passes them in.
 */
export interface ExternalCommentView {
  id: number;
  platform: string;
  parentExternalId: string | null;
  authorName: string;
  message: string;
  url: string | null;
  commentedAt: string;
}

const PLATFORM: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", threads: "Threads" };

export function ExternalComments({ comments }: { comments: ExternalCommentView[] }) {
  if (comments.length === 0) return null;
  const platforms = [...new Set(comments.map((c) => PLATFORM[c.platform] ?? c.platform))].join(" and ");
  return (
    <section className="eac-xcomments" aria-label={`Comments from ${platforms}`}>
      <h2 className="eac-xcomments__h">From {platforms}</h2>
      <ol className="eac-xcomments__list">
        {comments.map((c) => (
          <li key={c.id} className={`eac-xcomments__item${c.parentExternalId ? " eac-xcomments__item--reply" : ""}`}>
            <p className="eac-xcomments__meta">
              <strong>{c.authorName}</strong>
              <time dateTime={c.commentedAt}>
                {new Date(c.commentedAt).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" })}
              </time>
              {c.url && (
                <a href={c.url} target="_blank" rel="noreferrer">
                  on {PLATFORM[c.platform] ?? c.platform}
                </a>
              )}
            </p>
            <p className="eac-xcomments__text">{c.message}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
