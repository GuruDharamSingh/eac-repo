"use client";

import { Avatar, Box, Button, Group, Stack, Text } from "@mantine/core";
import { CommentComposer } from "./comment-composer";

interface ReplyData {
  id: string;
  parentId: string | null;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  reactionCount: number;
  userName: string;
  userAvatar: string | null;
  userInitials: string;
  userTrustLevel: number;
  commentColor?: string | null;
  children?: ReplyData[];
}

interface CommentItemProps {
  reply: ReplyData;
  meetingId: string;
  threadKind?: 'meeting' | 'post';
  depth?: number;
  replyingTo: string | null;
  onSetReplyingTo: (id: string | null) => void;
  onReplySubmitted: (reply: ReplyData, parentId: string) => void;
  isAuthed: boolean;
}

const MAX_DEPTH = 3;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function CommentItem({
  reply,
  meetingId,
  threadKind = 'meeting',
  depth = 0,
  replyingTo,
  onSetReplyingTo,
  onReplySubmitted,
  isAuthed,
}: CommentItemProps) {
  const isReplying = replyingTo === reply.id;

  return (
    <Box
      style={
        depth > 0
          ? {
              borderLeft: "2px solid var(--mantine-color-gray-3)",
              paddingLeft: 16,
              marginLeft: 4,
            }
          : undefined
      }
    >
      <Stack gap="xs">
        <Group gap="sm" align="flex-start">
          <Avatar
            src={reply.userAvatar}
            size="sm"
            radius="xl"
            color="indigo"
          >
            {reply.userInitials}
          </Avatar>
          <Stack gap={2} style={{ flex: 1 }}>
            <Group gap="xs">
              <Text size="sm" fw={600} style={reply.commentColor ? { color: reply.commentColor } : undefined}>
                {reply.userName}
              </Text>
              <Text size="xs" c="dimmed">
                {formatRelativeTime(reply.createdAt)}
              </Text>
            </Group>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {reply.content}
            </Text>
            {isAuthed && depth < MAX_DEPTH && (
              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="compact-xs"
                  onClick={() =>
                    onSetReplyingTo(isReplying ? null : reply.id)
                  }
                >
                  Reply
                </Button>
              </Group>
            )}
          </Stack>
        </Group>

        {isReplying && (
          <Box ml={40}>
            <CommentComposer
              meetingId={meetingId}
              threadKind={threadKind}
              parentId={reply.id}
              compact
              onSubmitted={(newReply) => {
                onReplySubmitted(newReply, reply.id);
                onSetReplyingTo(null);
              }}
              onCancel={() => onSetReplyingTo(null)}
            />
          </Box>
        )}

        {reply.children && reply.children.length > 0 && (
          <Stack gap="sm">
            {reply.children.map((child) => (
              <CommentItem
                key={child.id}
                reply={child}
                meetingId={meetingId}
                threadKind={threadKind}
                depth={depth + 1}
                replyingTo={replyingTo}
                onSetReplyingTo={onSetReplyingTo}
                onReplySubmitted={onReplySubmitted}
                isAuthed={isAuthed}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
