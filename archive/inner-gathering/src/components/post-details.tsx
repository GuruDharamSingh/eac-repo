"use client";

import {
  Avatar,
  Badge,
  Box,
  Container,
  Divider,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Post } from "@elkdonis/types";
import { MediaPlayer } from "@elkdonis/ui";
import { sanitizeRichText } from "@elkdonis/utils";
import { CommentSection } from "@/components/comment-section";

interface PostDetailsProps {
  post: Post;
  replies: any[];
  currentUser: {
    id: string;
    displayName: string | null;
    initials: string | null;
  } | null;
}

export function PostDetails({ post, replies, currentUser }: PostDetailsProps) {
  const authorName = post.author?.displayName || "Unknown";
  const coverId = post.coverImage?.id;
  const attachments = (post.media || []).filter((m) => m.id !== coverId);
  const publishedAt = post.publishedAt || post.createdAt;

  return (
    <Box style={{ background: "var(--eac-bg, #fffaf0)", minHeight: "100vh", paddingBottom: 80 }}>
      <Container size="md" py="xl">
        <Box mb="md">
          <Link
            href="/feed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#6a4520",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            <ArrowLeft size={16} />
            Back to feed
          </Link>
        </Box>

        <Stack gap="xl">
          <Paper withBorder p="xl" radius="md" className="parchment-card">
            <Stack gap="md">
              <Group gap="xs">
                <Badge variant="filled" color="ember" size="sm" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                  Post
                </Badge>
                <Text size="sm" c="dimmed">
                  {new Date(publishedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </Group>

              <Title order={1} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                {post.title}
              </Title>

              <Group gap="sm">
                <Avatar size="sm" radius="xl" color="ember">
                  {authorName.slice(0, 2).toUpperCase()}
                </Avatar>
                <Text size="sm" c="#6b4020" fs="italic">
                  By {authorName}
                </Text>
              </Group>

              {post.coverImage?.url && (
                <Box style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 6 }}>
                  <Image
                    src={post.coverImage.url}
                    alt={post.coverImage.altText || post.title}
                    w="100%"
                    fit="cover"
                  />
                </Box>
              )}

              {post.body && (
                <div
                  className="rich-text-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.body) }}
                  style={{
                    fontFamily: "'Crimson Text', Georgia, serif",
                    fontSize: "1.1rem",
                    lineHeight: 1.75,
                    color: "#2a1a05",
                  }}
                />
              )}

              {attachments.length > 0 && (
                <Stack gap={8}>
                  <Text size="sm" fw={500} tt="uppercase" c="dimmed">
                    Media
                  </Text>
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
                    return (
                      <Box
                        key={media.id}
                        component="a"
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <Group gap="xs">
                          <FileText size={14} />
                          <Text size="sm" style={{ flex: 1 }}>
                            {media.filename || "Download"}
                          </Text>
                          <ExternalLink size={14} />
                        </Group>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Divider label="Discussion" labelPosition="center" />

          <CommentSection
            initialReplies={replies}
            meetingId={post.id}
            threadKind="post"
            currentUserId={currentUser?.id ?? null}
            currentUserName={currentUser?.displayName ?? null}
            currentUserInitials={currentUser?.initials ?? null}
          />
        </Stack>
      </Container>
    </Box>
  );
}
