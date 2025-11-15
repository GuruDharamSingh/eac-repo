import { Card, Group, Stack, Text, Title, Badge } from '@mantine/core';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Post } from '@elkdonis/types';
import { truncate } from '@elkdonis/utils';

interface BlogPostListProps {
  posts: Post[];
  basePath?: string;
}

export function BlogPostList({ posts, basePath = '/posts' }: BlogPostListProps) {
  if (!posts.length) {
    return (
      <Card withBorder padding="xl" radius="md">
        <Text size="sm" c="dimmed">
          No posts yet. Check back soon!
        </Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      {posts.map((post) => (
        <Card key={post.id} withBorder shadow="xs" padding="lg" radius="md" component={Link} href={`${basePath}/${post.slug}`}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={3} size="h4">
                {post.title}
              </Title>
              <Badge variant="light">
                {post.publishedAt
                  ? format(new Date(post.publishedAt), 'MMM d, yyyy')
                  : format(new Date(post.createdAt), 'MMM d, yyyy')}
              </Badge>
            </Group>
            {post.excerpt ? (
              <Text size="sm" c="dimmed">
                {truncate(post.excerpt, 180)}
              </Text>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
