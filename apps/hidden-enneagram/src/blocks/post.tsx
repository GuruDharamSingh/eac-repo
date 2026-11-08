import { Lock } from "lucide-react";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";

// ============================================================================
// One piece of writing (he-post, round 6, 2026-11-08). Every `/<feed>/<slug>`
// is the studio page `post` (one template for every article), as every
// `/services/<slug>` is `service`. The thread's own words (title, date,
// author, body, cover) come from data; the words around them are props, so
// Ario edits the framing in the studio and the piece in Publish / Manage.
//
// The route injects `routeFeed` and `routeSlug` (app/[page]/[slug]/page.tsx);
// the server resolver (lib/record-blocks.ts loadPostBlock) reads the post as
// THIS visitor may see it (feed role, member-only posts), so the block can
// never show more than the route already allows. In the editor it draws the
// newest public post of a feed as a sample, and its links do nothing.
//
// The markup is the old route's, unchanged: ArticleView for posts, the plain
// heading + byline for any other kind of thread.
// ============================================================================

export interface PostView {
  id: string;
  kind: string;
  feedSlug: string;
  feedName: string;
  title: string;
  excerpt: string | null;
  /** The thread's body, as the route always drew it. */
  bodyHtml: string | null;
  authorName: string | null;
  authorSlug: string | null;
  /** ISO; published_at, else created_at. */
  publishedAt: string;
  coverImageUrl: string | null;
  membersOnly: boolean;
}

const props = [
  { name: "postFeed", kind: "string", label: "Feed", description: "Empty = the feed in the address (the usual case); in the editor, writing.", default: "" },
  { name: "postSlug", kind: "string", label: "Post", description: "Empty = the post in the address (the usual case); in the editor, the newest.", default: "" },
  { name: "backLabel", kind: "string", label: "Back link", description: "{feed} = the feed's name. Empty = none.", default: "← {feed}" },
  { name: "backHref", kind: "url", label: "Back link goes to", description: "Empty = the feed's page.", default: "" },
  { name: "kindLabel", kind: "string", label: "Label above the title", default: "Writing" },
  { name: "membersLabel", kind: "string", label: "On a members-only post", default: "Members only" },
  { name: "emptyNote", kind: "string", label: "In the editor, when there is no post", default: "No published post to show yet." },
] as const;

type Props = PropsOf<typeof props> & { post?: PostView | null; puck?: PuckEditing };

const s = (v: unknown) => (typeof v === "string" ? v : "");

export function HePost(p: Props) {
  const { drawn } = editingOf(p.puck);
  const post = p.post ?? null;
  if (!post) {
    return (
      <section className="blk he-post mx-auto max-w-[720px] px-6 py-16 font-sans">
        {drawn ? <p className="text-sm text-muted-foreground">{p.emptyNote}</p> : null}
      </section>
    );
  }
  const backLabel = s(p.backLabel).replace(/\{feed\}/g, post.feedName).trim();
  const backHref = s(p.backHref).trim() || `/${post.feedSlug}`;
  const members = s(p.membersLabel) || "Members only";
  const back = backLabel ? (
    <a href={backHref} className="he-post-back text-xs uppercase tracking-[0.2em] text-muted-foreground no-underline hover:text-foreground">
      {backLabel}
    </a>
  ) : null;

  return (
    <div className="blk he-post mx-auto max-w-[720px] px-6 py-16 font-sans">
      <article>
        {drawn ? <span inert>{back}</span> : back}

        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="mt-6 aspect-[21/9] w-full rounded-xl object-cover" />
        )}

        {post.kind === "post" ? (
          <ArticleView
            title={post.title}
            lede={post.excerpt}
            bodyHtml={post.bodyHtml ?? ""}
            threadId={post.id}
            authorName={post.authorName}
            publishedAt={post.publishedAt}
            kindLabel={s(p.kindLabel) || null}
            org={{ name: post.feedName, href: `/${post.feedSlug}` }}
          >
            {post.membersOnly && (
              <p className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                {members}
              </p>
            )}
          </ArticleView>
        ) : (
          <>
            <h1 className="mt-8 font-serif text-4xl font-medium leading-[1.1]">{post.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {post.authorName && (
                <span>
                  {post.authorSlug ? (
                    <a href={`/about/${post.authorSlug}`} className="hover:text-foreground">
                      {post.authorName}
                    </a>
                  ) : (
                    post.authorName
                  )}
                </span>
              )}
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
              </time>
              {post.membersOnly && (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" aria-hidden />
                  {members}
                </span>
              )}
            </div>

            {post.bodyHtml && <div className="prose-enneagram mt-10 text-[17px]" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />}
          </>
        )}
      </article>
    </div>
  );
}

export const hePost = defineBlock(
  {
    id: "he-post",
    label: "Article (the post in the address)",
    category: "content",
    description: "The post in the address: its title, date, author, cover and text from Publish. The words around it are yours.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Article", sel: "> .he-post" },
      back: { label: "Back link", sel: "> .he-post .he-post-back", prop: "backLabel" },
      title: { label: "Title", sel: "> .he-post .eac-article__title" },
      body: { label: "Text", sel: "> .he-post .eac-article__body" },
    },
    tokens: [{ name: "--he-aurum", label: "Accent", type: "color" }],
  },
  HePost,
);
