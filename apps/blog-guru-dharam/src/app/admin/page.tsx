import Link from 'next/link';
import { Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { format } from 'date-fns';
import { getPublishedPosts, requireBlogOwner } from '@elkdonis/blog-server';
import { blogConfig } from '../../config/blog';

export default async function AdminPage() {
  await requireBlogOwner(blogConfig);
  const posts = await getPublishedPosts(blogConfig.orgId, 50);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Admin Dashboard</Title>
          <Text size="sm" c="dimmed">
            Manage recent posts and create new entries for {blogConfig.orgName}.
          </Text>
        </div>
        <Button component={Link} href="/entry">
          New Entry
        </Button>
      </Group>

      <Card withBorder radius="md" padding="lg" shadow="sm">
        <Stack gap="md">
          <Title order={4}>Published Posts</Title>
          {posts.length === 0 ? (
            <Text size="sm" c="dimmed">
              No posts published yet. Head over to the entry page to publish your first story.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Published</Table.Th>
                  <Table.Th>Visibility</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {posts.map((post) => (
                  <Table.Tr key={post.id}>
                    <Table.Td>
                      <Link className="text-blue-600" href={`/posts/${post.slug}`}>
                        {post.title}
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      {post.publishedAt
                        ? format(new Date(post.publishedAt), 'PP')
                        : format(new Date(post.createdAt), 'PP')}
                    </Table.Td>
                    <Table.Td>{post.visibility}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
