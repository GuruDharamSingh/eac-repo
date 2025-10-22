import { getOrgDb } from '@elkdonis/db';

const ORG_ID = 'guru-dharam';

export default async function HomePage() {
  const db = getOrgDb(ORG_ID);

  // Get published posts from this blog's schema
  const posts = await db`
    SELECT * FROM posts
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT 10
  `.catch(() => []); // Return empty if schema doesn't exist yet

  return (
    <main className="container mx-auto p-4">
      <section className="prose max-w-none">
        <h2>Recent Posts</h2>
        {posts.length === 0 ? (
          <p>No posts yet. Check back soon!</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post: any) => (
              <article key={post.id} className="border-b pb-4">
                <h3>{post.title}</h3>
                <p className="text-gray-600">{post.excerpt}</p>
                <a href={`/posts/${post.slug}`}>Read more →</a>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}