import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { ArticleView } from "@elkdonis/cms-ui/article";
import type { WireDiscussion, WirePost, WireTopic } from "@/lib/article-data";
import { DiscussionView, SAMPLE_DISCUSSION } from "./discussion.client";

// ============================================================================
// The article blocks: a forum topic read as an article.
//
//   au-article      the topic's body in the reading layer (cms-ui ArticleView)
//   au-discussion   its replies, polled; "Join the discussion" opens the forum
//   au-topics       the latest topics, each linking to its article page
//
// The article IS the thread: the same row the forum shows, so replies made on
// the forum appear here within seconds and nothing is copied. Data comes from
// lib/article-data.ts (public threads in public feeds only).
// ============================================================================

const SAMPLE_POST: WirePost = {
  id: "sample",
  slug: "sample",
  title: "A piece about the auction",
  lede: "A standfirst: one or two sentences saying what the piece is about.",
  bodyHtml:
    "<p>The body of an article is the first post of a forum topic. Write it on the forum and it appears here, with the conversation underneath.</p><h2>A heading</h2><p>More words, with <strong>emphasis</strong> and links.</p>",
  authorName: "The author",
  publishedAt: "2026-10-20T12:00:00.000Z",
  coverImageUrl: null,
  replyCount: 3,
  forumHref: "#",
};

const SAMPLE_TOPICS: WireTopic[] = [
  { id: "t1", title: "How to bid in a silent auction", replyCount: 12, at: "2026-10-22T12:00:00.000Z", href: "#", readHref: "/read/sample" },
  { id: "t2", title: "Meet the artists", replyCount: 4, at: "2026-10-21T12:00:00.000Z", href: "#", readHref: "/read/sample" },
  { id: "t3", title: "Shipping and pickup", replyCount: 1, at: "2026-10-19T12:00:00.000Z", href: "#", readHref: "/read/sample" },
];

// ── article ─────────────────────────────────────────────────────────────────

const articleProps = [
  {
    name: "slug",
    kind: "string",
    label: "Article",
    description: "The topic's address. Empty draws the article being read (/read/…), else the newest.",
    default: "",
  },
  {
    name: "reading",
    kind: "select",
    label: "Reading voice",
    default: "journal",
    options: [
      { value: "journal", label: "Journal — serif, ruled" },
      { value: "gazette", label: "Gazette — newspaper" },
      { value: "quiet", label: "Quiet — sans, restrained" },
    ],
  },
  { name: "showCover", kind: "boolean", label: "Cover picture", default: true },
] as const;

export function Article({
  post,
  reading = "journal",
  showCover = true,
}: PropsOf<typeof articleProps> & { post?: WirePost | null }) {
  if (!post) return <p className="m-0 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No article to show yet.</p>;
  return (
    <ArticleView
      title={post.title}
      lede={post.lede}
      bodyHtml={post.bodyHtml}
      authorName={post.authorName}
      publishedAt={post.publishedAt}
      coverImageUrl={showCover ? post.coverImageUrl : null}
      reading={reading as "journal" | "gazette" | "quiet"}
      kindLabel="Article"
      threadId={post.id}
    />
  );
}

export const article = defineBlock(
  {
    id: "au-article",
    category: "content",
    label: "Article (a forum topic)",
    description: "A forum topic read as an article, in the reading layer. Write it on the forum; it appears here.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: articleProps,
  },
  Article,
  () => ({ reading: "journal" as const, showCover: true, post: SAMPLE_POST })
);

// ── discussion ──────────────────────────────────────────────────────────────

const discussionProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Discussion" },
  { name: "limit", kind: "number", label: "How many replies", default: 8, min: 1, max: 30, step: 1 },
  { name: "refresh", kind: "number", label: "Refresh every", default: 10, min: 5, max: 60, step: 1, unit: "s" },
  { name: "joinLabel", kind: "string", label: "Button says", default: "Join the discussion" },
  { name: "emptyMessage", kind: "string", label: "When there are no replies", default: "No replies yet. Start the conversation on the forum." },
] as const;

export const discussion = defineBlock(
  {
    id: "au-discussion",
    category: "listings",
    label: "Discussion (forum replies, live)",
    description:
      "The replies under the article, newest first, refreshed while the page is open. The button opens the thread on the forum, where people reply.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: discussionProps,
  },
  DiscussionView as unknown as React.ComponentType<PropsOf<typeof discussionProps> & { discussion?: WireDiscussion | null }>,
  () => ({ heading: "Discussion", limit: 8, refresh: 10, joinLabel: "Join the discussion", discussion: SAMPLE_DISCUSSION })
);

// ── topics ──────────────────────────────────────────────────────────────────

const topicsProps = [
  { name: "heading", kind: "string", label: "Heading", default: "From the forum" },
  { name: "limit", kind: "number", label: "How many", default: 6, min: 1, max: 20, step: 1 },
  { name: "emptyMessage", kind: "string", label: "When there are none", default: "Nothing has been posted yet." },
] as const;

export function Topics({
  topics = [],
  heading = "From the forum",
  emptyMessage = "Nothing has been posted yet.",
}: PropsOf<typeof topicsProps> & { topics?: WireTopic[] }) {
  return (
    <section>
      {heading ? <h2 className="m-0 mb-3 font-serif text-2xl">{heading}</h2> : null}
      {topics.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-border rounded-lg border border-border bg-card p-0">
          {topics.map((t) => (
            <li key={t.id} className="m-0 flex items-baseline justify-between gap-3 px-4 py-3">
              <a href={t.readHref} className="min-w-0 truncate font-serif text-lg text-card-foreground no-underline hover:underline">
                {t.title}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const topics = defineBlock(
  {
    id: "au-topics",
    category: "listings",
    label: "Recent forum topics",
    description: "The latest public topics of this site's forum, each linking to its article page.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: topicsProps,
  },
  Topics,
  () => ({ heading: "From the forum", limit: 6, topics: SAMPLE_TOPICS })
);
