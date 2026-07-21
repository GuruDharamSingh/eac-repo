"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  BookOpen,
  Calendar,
  FileText,
  Mail,
  Pencil,
  Users,
  Video,
} from "lucide-react";
import { ContentForm } from "@elkdonis/ui";
import type { ContentDraft, ContentFormKind, ThreadKind } from "@elkdonis/types";

export interface Offering {
  id: string;
  kind: ThreadKind;
  orgId: string;
  orgName: string;
  title: string;
  status: string;
  visibility: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  isRsvpEnabled: boolean;
  attendeeLimit: number | null;
  rsvpCount: number;
  pendingPayments: number;
  paidCount: number;
  hasTalkRoom: boolean;
  hasDocument: boolean;
  hasCustomRsvpEmail: boolean;
}

interface OfferingsClientProps {
  offerings: Offering[];
  userId: string;
  isAdmin?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  post: "Post",
  meeting: "Meeting",
  event: "Event",
  workshop: "Workshop",
};

const KIND_COLOR: Record<string, string> = {
  post: "gray",
  meeting: "blue",
  event: "teal",
  workshop: "grape",
};

const STATUS_COLOR: Record<string, string> = {
  published: "green",
  scheduled: "yellow",
  draft: "gray",
};

function detailHref(offering: Offering): string {
  if (offering.kind === "workshop") return `/workshops/${offering.id}`;
  if (offering.kind === "post") return `/posts/${offering.id}`;
  return `/meetings/${offering.id}`;
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/** Readiness chip: green when done, dimmed when missing. */
function Readiness({
  ok,
  label,
  icon: Icon,
  hint,
}: {
  ok: boolean;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  hint: string;
}) {
  return (
    <Tooltip label={hint} withArrow>
      <Badge
        size="sm"
        variant={ok ? "light" : "outline"}
        color={ok ? "green" : "gray"}
        leftSection={<Icon size={11} />}
        style={{ opacity: ok ? 1 : 0.55, textTransform: "none" }}
      >
        {label}
      </Badge>
    </Tooltip>
  );
}

export function OfferingsClient({ offerings, userId, isAdmin = false }: OfferingsClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [editDrawerOpened, { open: openEditDrawer, close: closeEditDrawer }] =
    useDisclosure(false);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    kind: ThreadKind;
    orgId: string;
    draft: Partial<ContentDraft>;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = useCallback(
    async (offering: Offering) => {
      setEditing(null);
      setEditError(null);
      openEditDrawer();
      try {
        const res = await fetch(`/api/content/${offering.id}`);
        if (!res.ok) throw new Error(`Failed to load content (${res.status})`);
        const data = await res.json();
        setEditing({
          id: data.id,
          title: offering.title,
          kind: data.kind,
          orgId: offering.orgId,
          draft: data.draft,
        });
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to load content");
      }
    },
    [openEditDrawer]
  );

  const visible =
    filter === "all"
      ? offerings
      : offerings.filter((o) =>
          filter === "meeting" ? o.kind === "meeting" || o.kind === "event" : o.kind === filter
        );

  return (
    <Box py="xl">
      <Container size="md">
        <Group justify="space-between" align="flex-end" mb="lg">
          <div>
            <Title order={2}>My Offerings</Title>
            <Text size="sm" c="dimmed">
              Everything you have published or drafted, across your organizations.
            </Text>
          </div>
        </Group>

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { label: "All", value: "all" },
            { label: "Workshops", value: "workshop" },
            { label: "Meetings", value: "meeting" },
            { label: "Posts", value: "post" },
          ]}
          mb="lg"
          fullWidth
        />

        {visible.length === 0 ? (
          <Paper withBorder p="xl" radius="md" ta="center">
            <Text c="dimmed">
              Nothing here yet. Create a post, meeting, or workshop from the feed and it
              will show up here.
            </Text>
            <Button component={Link} href="/feed" variant="light" mt="md">
              Go to the feed
            </Button>
          </Paper>
        ) : (
          <Stack gap="md">
            {visible.map((offering) => {
              const when = formatWhen(offering.scheduledAt);
              const showRsvp = offering.isRsvpEnabled || offering.kind === "workshop";
              return (
                <Paper key={offering.id} withBorder p="md" radius="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={6} style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <Badge size="sm" color={KIND_COLOR[offering.kind] ?? "gray"}>
                          {KIND_LABEL[offering.kind] ?? offering.kind}
                        </Badge>
                        <Badge
                          size="sm"
                          variant="dot"
                          color={STATUS_COLOR[offering.status] ?? "gray"}
                        >
                          {offering.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {offering.orgName}
                        </Text>
                      </Group>
                      <Text
                        component={Link}
                        href={detailHref(offering)}
                        fw={600}
                        size="lg"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        {offering.title}
                      </Text>
                      <Group gap="md">
                        {when && (
                          <Group gap={4}>
                            <Calendar size={13} />
                            <Text size="sm" c="dimmed">
                              {when}
                            </Text>
                          </Group>
                        )}
                        {showRsvp && (
                          <Group gap={4}>
                            <Users size={13} />
                            <Text size="sm" c="dimmed">
                              {offering.rsvpCount}
                              {offering.attendeeLimit ? ` / ${offering.attendeeLimit}` : ""} going
                            </Text>
                          </Group>
                        )}
                        {offering.pendingPayments > 0 && (
                          <Badge size="sm" color="orange" variant="light">
                            {offering.pendingPayments} payment
                            {offering.pendingPayments === 1 ? "" : "s"} pending
                          </Badge>
                        )}
                        {offering.paidCount > 0 && (
                          <Badge size="sm" color="green" variant="light">
                            {offering.paidCount} paid
                          </Badge>
                        )}
                      </Group>
                      {(offering.kind === "workshop" ||
                        offering.kind === "meeting" ||
                        offering.kind === "event") && (
                        <Group gap={6} mt={2}>
                          <Readiness
                            ok={offering.hasTalkRoom}
                            label="Talk room"
                            icon={Video}
                            hint={
                              offering.hasTalkRoom
                                ? "Video room is attached"
                                : "No Talk room yet — enable it under Integrations when editing"
                            }
                          />
                          <Readiness
                            ok={offering.hasDocument}
                            label="Materials"
                            icon={FileText}
                            hint={
                              offering.hasDocument
                                ? "Living document / materials attached"
                                : "No materials document yet — enable it under Integrations when editing"
                            }
                          />
                          {offering.isRsvpEnabled && (
                            <Readiness
                              ok={offering.hasCustomRsvpEmail}
                              label="RSVP email"
                              icon={Mail}
                              hint={
                                offering.hasCustomRsvpEmail
                                  ? "Custom confirmation email is set"
                                  : "Using the organization's default confirmation email"
                              }
                            />
                          )}
                        </Group>
                      )}
                    </Stack>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<Pencil size={13} />}
                      onClick={() => openEdit(offering)}
                      style={{ flexShrink: 0 }}
                    >
                      Edit
                    </Button>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Drawer
          opened={editDrawerOpened}
          onClose={() => {
            closeEditDrawer();
            setEditing(null);
            setEditError(null);
          }}
          position="bottom"
          size="90%"
          classNames={{
            content: "create-content-drawer",
            header: "create-content-drawer__header",
            body: "create-content-drawer__body",
          }}
          title={
            <div>
              <Title order={4}>
                {editing ? `Edit ${KIND_LABEL[editing.kind] ?? "Content"}` : "Edit"}
              </Title>
              <Text size="sm" c="dimmed">
                {editing?.title}
              </Text>
            </div>
          }
        >
          <ScrollArea h="calc(90vh - 8rem)" className="create-content-scroll">
            {editError ? (
              <Text c="red" ta="center" py="xl">
                {editError}
              </Text>
            ) : editing ? (
              <Box className="create-content-surface">
                <ContentForm
                  orgId={editing.orgId}
                  userId={userId}
                  isAdmin={isAdmin}
                  isCmsSite
                  initialThreadId={editing.id}
                  initialKind={
                    (editing.kind === "event" ? "meeting" : editing.kind) as ContentFormKind
                  }
                  initialDraft={editing.draft}
                  onPublished={() => {
                    closeEditDrawer();
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </Box>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Loading…
              </Text>
            )}
          </ScrollArea>
        </Drawer>
      </Container>
    </Box>
  );
}
