import { Paper, Stack, Group, Text, Badge, Anchor } from "@mantine/core";
import { MessageSquare, Pin } from "lucide-react";
import Link from "next/link";
import type { ForumThreadSummary } from "@/lib/forum";

// Forum thread rendered as a feed card (Publications / All tabs).
export function ForumFeedCard({ thread }: { thread: ForumThreadSummary }) {
  return (
    <Paper withBorder radius="sm" p="md" shadow="sm" className="parchment-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={600} size="lg" component={Link} href={`/forum/${thread.slug}`}
            style={{ color: "var(--mantine-color-text)", textDecoration: "none" }}
          >
            {thread.title}
          </Text>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {thread.pinned && (
              <Badge variant="light" color="ember" size="sm" leftSection={<Pin size={11} />}>
                Pinned
              </Badge>
            )}
            <Badge variant="filled" color="grape" size="sm" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Forum
            </Badge>
          </Group>
        </Group>

        {thread.excerpt && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {thread.excerpt}
          </Text>
        )}

        <Group justify="space-between" align="center">
          <Text size="sm" style={{ fontStyle: "italic", color: "#6b4020" }}>
            By {thread.authorName}
          </Text>
          <Anchor component={Link} href={`/forum/${thread.slug}`} size="sm" fw={600} c="grape"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <MessageSquare size={14} />
            Open thread{thread.replyCount ? ` (${thread.replyCount})` : ""}
          </Anchor>
        </Group>
      </Stack>
    </Paper>
  );
}
