import { db } from "@elkdonis/db";

/**
 * The Elkdonis network's recent writing, shown on a member's own page when
 * they've switched it on in the hub.
 *
 * "The Elkdonis blog feed" wasn't a thing that existed — there is no RSS
 * anywhere in this codebase and no cross-org syndication. What DOES exist is
 * `elkdonis`, the central hub org, whose `kind='post'` threads are the
 * network's writing. So a feed here is a read of that org, not a subscription
 * to anything.
 *
 * Renders nothing at all when the org has no posts, rather than an empty
 * heading — a member who opted in shouldn't get a bare "Latest from Elkdonis"
 * with nothing under it.
 */
const NETWORK_ORG = "elkdonis";

type FeedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
};

export async function ElkdonisFeed({ limit = 4 }: { limit?: number }) {
  let posts: FeedPost[] = [];
  try {
    posts = await db<FeedPost[]>`
      SELECT id, title, slug, excerpt, published_at
      FROM threads
      WHERE org_id = ${NETWORK_ORG}
        AND kind = 'post'
        AND status = 'published'
        AND visibility = 'PUBLIC'
      ORDER BY published_at DESC NULLS LAST
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error("[ifac] ElkdonisFeed error:", error);
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section className="profile-feed" aria-labelledby="elkdonis-feed-head">
      <h2 id="elkdonis-feed-head">Latest from Elkdonis</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            {post.excerpt && <p>{post.excerpt}</p>}
            {post.published_at && (
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
