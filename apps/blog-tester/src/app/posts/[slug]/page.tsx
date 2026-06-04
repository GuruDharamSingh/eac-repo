import { notFound } from 'next/navigation';
import { Title, Text, Divider, Badge } from '@mantine/core';
import { format } from 'date-fns';
import { BlogPostList } from '@elkdonis/blog-client';
import { getPostBySlug, getPublishedPosts } from '@elkdonis/blog-server';
import { MediaGallery, RichText } from '@elkdonis/ui';
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
    ? format(new Date(post.publishedAt), 'MMMM do, yyyy')
    : format(new Date(post.createdAt), 'MMMM do, yyyy');

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
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-gray-200 dark:border-gray-800 pb-8">
          <Badge variant="light" color="gray" size="sm" className="w-fit font-sans">
            {publishedAt}
          </Badge>
          <Title order={1} className="font-serif text-5xl leading-tight">
            {post.title}
          </Title>
          {post.author?.displayName ? (
            <Text size="md" className="text-gray-500 font-sans mt-2">
              By {post.author.displayName}
            </Text>
          ) : null}
        </header>

        {mediaItems.length > 0 ? (
          <MediaGallery items={mediaItems} className="mt-4 mb-8" />
        ) : null}

        <RichText
          as="article"
          className="article-content"
          html={post.body || ''}
        />

        {post.metadata?.link ? (
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
            <Text size="sm">
              Source:{' '}
              <a className="text-gray-900 dark:text-gray-100 underline hover:no-underline" href={post.metadata.link as string}>
                {post.metadata.link}
              </a>
            </Text>
          </div>
        ) : null}
      </div>

      <div className="mt-16 pt-12 border-t border-gray-200 dark:border-gray-800">
        <Title order={3} className="font-sans text-xl mb-6">
          More from the blog
        </Title>
        <BlogPostList posts={recentPosts.filter(p => p.id !== post.id).slice(0, 3)} />
      </div>
    </div>
  );
}
