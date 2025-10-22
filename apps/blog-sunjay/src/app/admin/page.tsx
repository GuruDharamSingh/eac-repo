import { Events, getOrgDb } from '@elkdonis/db';

const ORG_ID = 'sunjay';

export default function AdminPage() {
  async function createPost(formData: FormData) {
    'use server';

    const db = getOrgDb(ORG_ID);
    const title = formData.get('title') as string;
    const body = formData.get('body') as string;

    // Create post in org schema
    const [post] = await db`
      INSERT INTO posts (id, title, body, slug, status, author_id)
      VALUES (
        gen_random_uuid(),
        ${title},
        ${body},
        ${title.toLowerCase().replace(/\s+/g, '-')},
        'draft',
        'user-placeholder'
      )
      RETURNING id, title
    `;

    // Log event
    await Events.log(ORG_ID, 'user-placeholder', 'created', {
      contentId: post.id,
      title: post.title,
      type: 'post'
    });
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin - Create Post</h1>

      <form action={createPost} className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="title" className="block mb-1">Title</label>
          <input
            name="title"
            type="text"
            className="border p-2 w-full"
            required
          />
        </div>

        <div>
          <label htmlFor="body" className="block mb-1">Content</label>
          <textarea
            name="body"
            className="border p-2 w-full h-32"
            required
          />
        </div>

        <button type="submit" className="bg-blue-500 text-white px-4 py-2">
          Create Post
        </button>
      </form>
    </main>
  );
}