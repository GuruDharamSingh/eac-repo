import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';
import '@mantine/dropzone/styles.css';

import { redirect } from 'next/navigation';
import { BlogPostEditor, LoginPrompt } from '@elkdonis/blog-client';
import {
  createBlogPost,
  checkBlogOwner,
} from '@elkdonis/blog-server';
import { blogConfig } from '../../config/blog';

export default async function EntryPage() {
  // Use non-throwing check
  const authContext = await checkBlogOwner(blogConfig);

  // If not authenticated or not owner, show login prompt
  if (!authContext) {
    return (
      <LoginPrompt
        title="Sign in to create posts"
        description="You need to be signed in as the blog owner to create new entries."
        loginHref="/login"
        returnTo="/entry"
      />
    );
  }

  async function handleSubmit(payload: Parameters<typeof createBlogPost>[0]) {
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
