import { BlogPostList } from '@elkdonis/blog-client';
import { getPublishedPosts } from '@elkdonis/blog-server';
import { Title, Text, Stack } from '@mantine/core';
import { blogConfig } from '../config/blog';

export default async function HomePage() {
  const posts = await getPublishedPosts(blogConfig.orgId, 20).catch(() => []);

  return (
    <Stack gap="xl">
      <div className="pb-8 mb-8 border-b border-gray-200 dark:border-gray-800">
        <Title order={1} className="font-serif text-4xl mb-4">
          Minimalist Musings
        </Title>
        <Text size="lg" className="text-gray-600 dark:text-gray-400 max-w-xl">
          A clean, focused space for reading and writing. No distractions, just content.
        </Text>
      </div>

      {posts.length > 0 ? (
        <BlogPostList posts={posts} />
      ) : (
        <Text c="dimmed" fs="italic">No posts have been published yet.</Text>
      )}
    </Stack>
  );
}
