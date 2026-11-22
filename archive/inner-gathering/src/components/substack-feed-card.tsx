import { Paper, Stack, Group, Text, Badge, Anchor } from "@mantine/core";
import { ExternalLink, Rss } from "lucide-react";
import type { SubstackPost } from "@/lib/substack";

const formatDate = (pubDate: string) => {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
};

// Substack RSS item rendered as a feed card (Publications / All tabs).
// Links out to Substack in a new tab.
export function SubstackFeedCard({ post }: { post: SubstackPost }) {
  const date = formatDate(post.pubDate);
  return (
    <Paper withBorder radius="sm" p="md" shadow="sm" className="parchment-card">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={600} size="lg" component="a" href={post.link} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--mantine-color-text)", textDecoration: "none" }}
          >
            {post.title}
          </Text>
          <Badge variant="filled" color="orange" size="sm" leftSection={<Rss size={11} />}
            style={{ letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}
          >
            Substack
          </Badge>
        </Group>

        {post.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {post.description}
          </Text>
        )}

        <Group justify="space-between" align="center">
          {date && <Text size="sm" style={{ fontStyle: "italic", color: "#6b4020" }}>{date}</Text>}
          <Anchor href={post.link} target="_blank" rel="noopener noreferrer" size="sm" fw={600} c="orange"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            Read on Substack
            <ExternalLink size={14} />
          </Anchor>
        </Group>
      </Stack>
    </Paper>
  );
}
