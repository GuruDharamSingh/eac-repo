import { Events } from '@elkdonis/db';

export default async function ForumPage() {
  // Get approved forum posts from the event system
  const posts = await Events.getForumPosts(20);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8">Community Forum</h1>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <p>No posts yet. Content will appear here once approved.</p>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="border p-4 rounded">
              <h2 className="text-xl font-semibold">{post.title}</h2>
              <p className="text-sm text-gray-600">
                From: {post.orgName} • By: {post.authorName}
              </p>
              <div className="mt-2">{post.body}</div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}