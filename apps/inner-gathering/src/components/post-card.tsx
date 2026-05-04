import { ActionIcon, Paper, Text, Group, Stack, Badge, ThemeIcon, Image, Box, Tooltip } from "@mantine/core";
import { FileText, User, ExternalLink, Trash2 } from "lucide-react";
import type { Post } from "@elkdonis/types";
import { MediaPlayer } from "@elkdonis/ui";

interface PostCardProps {
  post: Post;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
}

export function PostCard({ post, canDelete = false, deleting = false, onDelete }: PostCardProps) {
  const authorName = post.author?.displayName || "Unknown";
  const coverImageId = post.coverImage?.id;
  const attachments = (post.media || []).filter((media) => media.id !== coverImageId);

  return (
    <Paper withBorder radius="sm" p="md" shadow="sm" className="parchment-card" style={{ overflow: 'hidden' }}>
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
              <Badge variant="filled" color="ember" size="sm" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Post
              </Badge>
            </Group>
          </Stack>
          {canDelete && (
            <Tooltip label="Delete post">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label="Delete post"
                disabled={deleting}
                onClick={onDelete}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          )}
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
                  <Box
                    key={media.id}
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
                    <Group gap="xs">
                      <FileText size={12} />
                      <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {media.filename || "Download"}
                      </Text>
                      <ExternalLink size={12} />
                    </Group>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        )}

        <Group gap="xs">
          <ThemeIcon size="sm" radius="sm" variant="light" color="ember">
            <User size={14} />
          </ThemeIcon>
          <Text size="sm" style={{ fontStyle: 'italic', color: '#6b4020' }}>By {authorName}</Text>
        </Group>
      </Stack>
    </Paper>
  );
}
