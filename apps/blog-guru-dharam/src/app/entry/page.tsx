import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';
import '@mantine/dropzone/styles.css';

import { BlogEntryForm, BlogEntryFormData } from '@elkdonis/ui';
import { Events, getOrgDb } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { redirect } from 'next/navigation';

const ORG_ID = 'guru-dharam';
const ORG_NAME = "Guru Dharam's Blog";

export default function EntryPage() {
  async function handleSubmit(data: BlogEntryFormData) {
    'use server';

    const db = getOrgDb(ORG_ID);
    const postId = nanoid();
    const slug = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Create post in org schema
    await db`
      INSERT INTO posts (
        id, title, slug, body, excerpt, status, author_id, metadata, created_at
      ) VALUES (
        ${postId},
        ${data.title},
        ${slug},
        ${data.body},
        ${data.excerpt || data.body.substring(0, 200)},
        'published',
        'user-placeholder',
        ${JSON.stringify({
          link: data.link,
          tags: data.tags,
          forumThreadTitle: data.forumThreadTitle
        })},
        NOW()
      )
    `;

    // TODO: Upload media files to Nextcloud
    // For now, media upload will be added later

    // Log event
    await Events.log(ORG_ID, 'user-placeholder', 'published', {
      contentId: postId,
      title: data.title,
      preview: data.excerpt || data.body.substring(0, 200),
      type: 'post'
    });

    redirect('/');
  }

  return (
    <main className="container mx-auto p-4 max-w-4xl">
      <BlogEntryForm
        onSubmit={handleSubmit}
        orgName={ORG_NAME}
        submitLabel="Publish Post"
      />
    </main>
  );
}