import { notFound } from "next/navigation";
import { Paper, Stack, Title, Text, Divider, Badge } from "@mantine/core";
import { format } from "date-fns";
import { getPostBySlug, getPublishedPosts } from "@elkdonis/blog-server";
import { MediaGallery, RichText } from "@elkdonis/ui";
import { BlogPostList } from "../components/BlogPostList";
import type { BlogConfig } from "../types";

/**
 * Blog post detail.
 *
 * Was byte-identical (md5 ad0097fe) in blog-sunjay and blog-guru-dharam.
 * blog-tester deliberately diverges — a different typographic treatment and
 * its own copy — so it keeps its own page rather than being flattened into
 * this one. If a third design appears, theme this instead of forking again.
 *
 * Takes an already-resolved `slug` rather than Next's `params`. The two copies
 * typed params as a plain object, which stopped being true when params became
 * a Promise; awaiting in the route and passing the value keeps that decision
 * in one place per app and out of the shared body.
 */
export async function BlogPostPage({
  config,
  slug,
}: {
  config: BlogConfig;
  slug: string;
}) {
  const post = await getPostBySlug(config.orgId, slug);
  if (!post) notFound();

  const recentPosts = await getPublishedPosts(config.orgId, 4);

  const publishedAt = post.publishedAt
    ? format(new Date(post.publishedAt), "PPP")
    : format(new Date(post.createdAt), "PPP");

  const mediaItems =
    post.media
      ?.filter((item) => item.type && item.type !== "document")
      .map((item) => ({
        id: item.id,
        url: item.url,
        type: (item.type === "image" || item.type === "video" || item.type === "audio"
          ? item.type
          : "image") as "image" | "video" | "audio",
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

          <RichText
            as="article"
            className="prose prose-neutral max-w-none"
            html={post.body || ""}
          />

          {post.metadata?.link ? (
            <Text size="sm">
              Further reading:{" "}
              <a className="text-blue-500 underline" href={post.metadata.link as string}>
                {post.metadata.link as string}
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
