"use client";

import { useState } from "react";
import { Button, Group, Paper, Stack, Textarea } from "@mantine/core";

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
  children?: ReplyData[];
}

interface CommentComposerProps {
  meetingId: string;
  parentId?: string | null;
  compact?: boolean;
  onSubmitted: (reply: ReplyData) => void;
  onCancel?: () => void;
}

export function CommentComposer({
  meetingId,
  parentId = null,
  compact = false,
  onSubmitted,
  onCancel,
}: CommentComposerProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post comment");
      }

      const { reply } = await res.json();
      setContent("");
      onSubmitted(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Stack gap="xs">
        <Textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={2}
          autosize
          maxRows={4}
        />
        {error && (
          <span style={{ color: "var(--mantine-color-red-6)", fontSize: 12 }}>
            {error}
          </span>
        )}
        <Group gap="xs">
          <Button
            size="xs"
            onClick={handleSubmit}
            loading={loading}
            disabled={!content.trim()}
          >
            Reply
          </Button>
          {onCancel && (
            <Button size="xs" variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Group>
      </Stack>
    );
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
          maxRows={8}
        />
        {error && (
          <span style={{ color: "var(--mantine-color-red-6)", fontSize: 12 }}>
            {error}
          </span>
        )}
        <Group justify="flex-end">
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!content.trim()}
          >
            Comment
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
