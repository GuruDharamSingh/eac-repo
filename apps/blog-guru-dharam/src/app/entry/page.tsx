import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';
import '@mantine/dropzone/styles.css';

import { redirect } from 'next/navigation';
import { BlogPostEditor } from '@elkdonis/blog-client';
import {
  createBlogPost,
  requireBlogOwner,
  type BlogPostSubmission,
} from '@elkdonis/blog-server';
import { blogConfig } from '../../config/blog';

export default async function EntryPage() {
  const authContext = await requireBlogOwner(blogConfig);

  async function handleSubmit(payload: BlogPostSubmission) {
    'use server';

    await createBlogPost({
      ...payload,
      orgId: blogConfig.orgId,
      authorId: authContext.appUserId,
    });

    redirect('/');
  }

  return (
    <BlogPostEditor
      orgId={blogConfig.orgId}
      orgName={blogConfig.orgName}
      userId={authContext.appUserId}
      uploadEndpoint={blogConfig.uploadPath || '/api/media/upload'}
      onSubmit={handleSubmit}
      submitLabel="Publish Post"
    />
  );
}
