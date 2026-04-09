import { notFound } from 'next/navigation';
import { Paper, Stack, Title, Text, Divider, Badge } from '@mantine/core';
import { format } from 'date-fns';
import { BlogPostList } from '@elkdonis/blog-client';
import { getPostBySlug, getPublishedPosts } from '@elkdonis/blog-server';
import { MediaGallery } from '@elkdonis/ui';
import { blogConfig } from '../../../config/blog';

interface PostPageProps {
  params: {
    slug: string;
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPostBySlug(blogConfig.orgId, params.slug);

  if (!post) {
    notFound();
  }

  const recentPosts = await getPublishedPosts(blogConfig.orgId, 4);

  const publishedAt = post.publishedAt
    ? format(new Date(post.publishedAt), 'PPP')
    : format(new Date(post.createdAt), 'PPP');

  const mediaItems =
    post.media?.filter((item) => item.type && item.type !== 'document').map((item) => ({
      id: item.id,
      url: item.url,
      type: (item.type === 'image' || item.type === 'video' || item.type === 'audio'
        ? item.type
        : 'image') as 'image' | 'video' | 'audio',
      title: item.caption || item.filename || undefined,
    })) ?? [];

  return (
    <Stack gap="xl">
      <Paper withBorder radius="lg" p="xl" shadow="sm">
        <Stack gap="md">
          <div>
            <Badge variant="light" size="sm">
              {publishedAt}
            </Badge>
            <Title order={1} mt="sm">
              {post.title}
            </Title>
            {post.author?.displayName ? (
              <Text size="sm" c="dimmed">
                By {post.author.displayName}
              </Text>
            ) : null}
          </div>

          {mediaItems.length ? (
            <MediaGallery items={mediaItems} className="mt-4" />
          ) : null}

          <Divider />

          <article
            className="prose prose-neutral max-w-none"
            dangerouslySetInnerHTML={{ __html: post.body || '' }}
          />

          {post.metadata?.link ? (
            <Text size="sm">
              Further reading:{' '}
              <a className="text-blue-500 underline" href={post.metadata.link as string}>
                {post.metadata.link}
              </a>
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <div>
        <Title order={3} size="h4" mb="md">
          Recent Posts
        </Title>
        <BlogPostList posts={recentPosts} />
      </div>
    </Stack>
  );
}
