"use client";

import { useState } from "react";
import {
  Anchor,
  Badge,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";

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

interface CommentSectionProps {
  initialReplies: ReplyData[];
  meetingId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserInitials: string | null;
}

function countReplies(replies: ReplyData[]): number {
  let count = 0;
  for (const reply of replies) {
    count += 1;
    if (reply.children) {
      count += countReplies(reply.children);
    }
  }
  return count;
}

function addReplyToTree(
  replies: ReplyData[],
  newReply: ReplyData,
  parentId: string
): ReplyData[] {
  return replies.map((reply) => {
    if (reply.id === parentId) {
      return {
        ...reply,
        children: [...(reply.children || []), newReply],
      };
    }
    if (reply.children && reply.children.length > 0) {
      return {
        ...reply,
        children: addReplyToTree(reply.children, newReply, parentId),
      };
    }
    return reply;
  });
}

export function CommentSection({
  initialReplies,
  meetingId,
  currentUserId,
  currentUserName,
  currentUserInitials,
}: CommentSectionProps) {
  const [replies, setReplies] = useState<ReplyData[]>(initialReplies);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const isAuthed = !!currentUserId;
  const totalCount = countReplies(replies);

  const handleTopLevelSubmit = (newReply: ReplyData) => {
    setReplies((prev) => [...prev, newReply]);
  };

  const handleNestedSubmit = (newReply: ReplyData, parentId: string) => {
    setReplies((prev) => addReplyToTree(prev, newReply, parentId));
  };

  return (
    <Paper withBorder radius="lg" p="xl">
      <Stack gap="md">
        <Group gap="sm">
          <Title order={3}>Comments</Title>
          <Badge variant="light" color="gray" size="lg">
            {totalCount}
          </Badge>
        </Group>

        <Divider />

        {isAuthed && (
          <CommentComposer
            meetingId={meetingId}
            onSubmitted={handleTopLevelSubmit}
          />
        )}

        {replies.length === 0 ? (
          <Text c="dimmed" ta="center" py="lg">
            No comments yet. Be the first to share your thoughts.
          </Text>
        ) : (
          <Stack gap="md">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                reply={reply}
                meetingId={meetingId}
                replyingTo={replyingTo}
                onSetReplyingTo={setReplyingTo}
                onReplySubmitted={handleNestedSubmit}
                isAuthed={isAuthed}
              />
            ))}
          </Stack>
        )}

        {!isAuthed && (
          <Text c="dimmed" ta="center" size="sm">
            <Anchor href="/api/auth/login">Sign in</Anchor> to join the
            discussion.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
