import Link from "next/link";
import { Button, Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { format } from "date-fns";
import { getPublishedPosts, requireBlogOwner } from "@elkdonis/blog-server";
// blog-client's BlogConfig is a superset of blog-server's (it adds nav, hero,
// uploadPath). Apps hold this one, so take it and let it narrow on the way in.
import type { BlogConfig } from "../types";

/**
 * The blog admin dashboard.
 *
 * This page was byte-identical (md5 f1aca5c5) in blog-sunjay, blog-guru-dharam
 * and blog-tester — the only difference between the three copies was which
 * `config/blog` they imported. It now takes that config as a prop and the apps
 * keep a four-line route, the same shape auth/login already uses.
 *
 * A server component: it awaits the owner check and the post query before
 * rendering, so nothing here ships to the browser.
 */
export async function BlogAdminPage({ config }: { config: BlogConfig }) {
  await requireBlogOwner(config);
  const posts = await getPublishedPosts(config.orgId, 50);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Admin Dashboard</Title>
          <Text size="sm" c="dimmed">
            Manage recent posts and create new entries for {config.orgName}.
          </Text>
        </div>
        {/* component="a", not component={Link}: this is a server component,
            and passing a function component across the server/client boundary
            throws "Functions cannot be passed directly to Client Components".
            That is what 500s the original pages in blog-sunjay and
            blog-guru-dharam. A full navigation is fine for a dashboard action. */}
        <Button component="a" href="/entry">
          New Entry
        </Button>
      </Group>

      <Card withBorder radius="md" padding="lg" shadow="sm">
        <Stack gap="md">
          <Title order={4}>Published Posts</Title>
          {posts.length === 0 ? (
            <Text size="sm" c="dimmed">
              No posts published yet. Head over to the entry page to publish your
              first story.
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
                        ? format(new Date(post.publishedAt), "PP")
                        : format(new Date(post.createdAt), "PP")}
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
