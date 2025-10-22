import { Paper, Text, Group, Stack, Badge, ThemeIcon, Image } from "@mantine/core";
import { FileText, User } from "lucide-react";
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
    <Paper withBorder radius="lg" p="md" shadow="sm">
      <Stack gap="sm">
        {post.coverImage?.url && (
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.altText || post.title}
            radius="md"
            h={200}
            fit="cover"
          />
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
            <Text size="sm" fw={500}>
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
                
                return null;
              })}
            </Stack>
          </Stack>
        )}

        <Group gap="xs">
          <ThemeIcon size="sm" radius="md" variant="light">
            <User size={14} />
          </ThemeIcon>
          <Text size="sm">By {authorName}</Text>
        </Group>
      </Stack>
    </Paper>
  );
}
