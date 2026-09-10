import { ArticleView } from "@elkdonis/cms-ui/article";
import { sanitizePostBody } from "@elkdonis/utils";
import type { OrgSummary, PublicThread } from "@/lib/org";

/**
 * A published thread, read.
 *
 * Anything that is not a workshop renders here: a post, a meeting notice, a
 * service. The workshop keeps its bound template, because a schedule, gallery
 * and registration form are a different surface from a piece of writing.
 *
 * The typographic system is `@elkdonis/cms-ui/article` and is deliberately
 * constant across the network — an org sets its accent and its masthead, not
 * its measure and leading, so a post reads the same wherever someone meets it.
 */

/** What the reader calls each kind, rather than what the column calls it. */
const KIND_LABEL: Record<string, string> = {
  post: "Essay",
  meeting: "Gathering",
  event: "Event",
  service: "Offering",
};

/** ~230 wpm on prose. Omitted below a minute rather than rounded up to "1 min". */
function readingMinutes(html: string): number | null {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.round(words / 230);
  return minutes >= 2 ? minutes : null;
}

/**
 * Markdown bodies are not rendered yet.
 *
 * `body_format` allows 'md', and the Nextcloud document round-trip
 * (attachThreadDocument) sets it — but no markdown renderer is installed in
 * this repo, and hand-rolling one produces subtly wrong output on exactly the
 * things writers use. Until `marked` (or similar) is added, a markdown body is
 * shown as the text it is: escaped, whitespace preserved, readable. Wrong
 * formatting is a bug; unformatted text is merely plain.
 *
 * All 35 published threads are currently 'html', so nothing renders this path
 * today.
 */
function renderBody(thread: PublicThread): string {
  const raw = thread.body ?? "";
  if (thread.body_format !== "md") return sanitizePostBody(raw);

  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;font:inherit;margin:0">${escaped}</pre>`;
}

export function ArticleBody({
  org,
  thread,
  orgs,
}: {
  org: OrgSummary;
  thread: PublicThread;
  orgs: Array<{ id: string; name: string; slug: string }>;
}) {
  const bodyHtml = renderBody(thread);
  const cover =
    typeof thread.metadata?.coverImageUrl === "string"
      ? thread.metadata.coverImageUrl
      : null;

  // A meeting's date is the thing it is about, so it leads; for everything
  // else the publication date is the record.
  const dateline =
    thread.kind === "meeting" || thread.kind === "event"
      ? (thread.scheduled_at ?? thread.published_at)
      : thread.published_at;

  return (
    <ArticleView
      title={thread.title}
      lede={thread.excerpt}
      bodyHtml={bodyHtml}
      authorName={thread.author_name}
      publishedAt={dateline}
      kindLabel={KIND_LABEL[thread.kind] ?? null}
      org={{ name: org.name, href: `/` }}
      coverImageUrl={cover}
      readingMinutes={readingMinutes(bodyHtml)}
      provenance={{
        // Both the author and every org carrying it hold a claim, and neither
        // holds a copy — the custody is the rows, not the bytes.
        publishedOn: orgs.map((o) => ({ name: o.name })),
        source:
          thread.body_format === "md"
            ? "Markdown, in the writer's own storage"
            : null,
        record: thread.slug ? `/${thread.slug}` : null,
      }}
    />
  );
}
