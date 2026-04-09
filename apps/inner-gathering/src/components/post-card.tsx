import { Paper, Text, Group, Stack, Badge, ThemeIcon, Image, Box } from "@mantine/core";
import { FileText, User, ExternalLink } from "lucide-react";
import type { Post } from "@elkdonis/types";
import { MediaPlayer } from "@elkdonis/ui";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const authorName = post.author?.displayName || "Unknown";
  const coverImageId = post.coverImage?.id;
  const attachments = (post.media || []).filter((media) => media.id !== coverImageId);

  return (
    <Paper withBorder radius="lg" p="md" shadow="sm" style={{ overflow: 'hidden' }}>
      <Stack gap="sm">
        {post.coverImage?.url && (
          <Box style={{ position: 'relative', height: 192, width: '100%', overflow: 'hidden', borderRadius: 8, marginBottom: 8 }}>
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.altText || post.title}
              h={192}
              w="100%"
              fit="cover"
            />
          </Box>
        )}

        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={600} size="lg">
              {post.title}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color="grape" size="sm">
                Post
              </Badge>
            </Group>
          </Stack>
        </Group>

        {post.excerpt && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {post.excerpt}
          </Text>
        )}

        {!post.excerpt && post.body && (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {post.body}
          </Text>
        )}

        {attachments.length > 0 && (
          <Stack gap={8}>
            <Text size="sm" fw={500} tt="uppercase" c="dimmed">
              Media
            </Text>
            <Stack gap={8}>
              {attachments.map((media) => {
                const mediaType = media.type || media.mimeType?.split("/")[0];

                if (mediaType === "video" || mediaType === "audio" || mediaType === "image") {
                  return (
                    <MediaPlayer
                      key={media.id}
                      url={media.url}
                      type={mediaType as "video" | "audio" | "image"}
                      title={media.filename}
                    />
                  );
                }

                // Other file types (documents, etc.)
                return (
                  <Group
                    key={media.id}
                    gap="xs"
                    component="a"
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <FileText size={12} />
                    <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {media.filename || "Download"}
                    </Text>
                    <ExternalLink size={12} />
                  </Group>
                );
              })}
            </Stack>
          </Stack>
        )}

        <Group gap="xs">
          <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
            <User size={14} />
          </ThemeIcon>
          <Text size="sm">By {authorName}</Text>
        </Group>
      </Stack>
    </Paper>
  );
}
