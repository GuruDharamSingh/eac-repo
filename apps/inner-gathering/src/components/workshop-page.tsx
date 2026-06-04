"use client";

import React, { useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Collapse,
  Container,
  Divider,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
  rem,
} from "@mantine/core";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Lock,
  MessageCircle,
  Play,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { sanitizeRichText } from "@elkdonis/utils";
import { CommentSection } from "@/components/comment-section";
import { JoinWorkshopModal } from "@/components/join-workshop-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  title: string;
  type: "link" | "pdf" | "video" | "audio" | "doc" | "other";
  url: string;
  isPublic: boolean;
  description?: string;
}

interface Session {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string | Date;
  durationMinutes?: number;
  isOnline?: boolean;
  location?: string;
  orderIndex: number;
  videoConferenceUrl?: string;
  nextcloudTalkToken?: string;
  resources?: Resource[];
}

interface Guide {
  displayName: string;
  avatarUrl?: string;
}

interface Workshop {
  id: string;
  title: string;
  description?: string;
  pitch?: string;
  coverImage?: { url: string; alt?: string };
  guide?: Guide;
  organization?: { name: string };
  price?: number;
  attendeeCount?: number;
  sessions?: Session[];
  nextcloudTalkToken?: string;
}

interface WorkshopPageProps {
  workshop: Workshop;
  currentUser: {
    id: string;
    displayName: string | null;
    initials: string | null;
  } | null;
  isEnrolled: boolean;
  replies: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date: string | Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", opts).format(new Date(date));
}

function sessionStatus(scheduledAt: string | Date, durationMinutes = 90): "upcoming" | "live" | "past" {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  const now = Date.now();
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "past";
}

// ─── Resource Row ─────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  video: <Video size={14} />,
  pdf: <FileText size={14} />,
  doc: <BookOpen size={14} />,
  link: <LinkIcon size={14} />,
  audio: <Play size={14} />,
};

function ResourceRow({ res, isEnrolled }: { res: Resource; isEnrolled: boolean }) {
  const locked = !res.isPublic && !isEnrolled;
  return (
    <Group
      gap="sm"
      p="xs"
      style={{
        borderRadius: 8,
        backgroundColor: locked ? "var(--mantine-color-gray-1)" : "rgba(93,73,55,0.07)",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.7 : 1,
      }}
      component={locked ? "div" : "a"}
      href={locked ? undefined : res.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ThemeIcon variant="light" color={locked ? "gray" : "orange"} size="sm" radius="xl">
        {locked ? <Lock size={12} /> : (TYPE_ICON[res.type] ?? <FileText size={12} />)}
      </ThemeIcon>
      <Stack gap={0} style={{ flex: 1 }}>
        <Text size="sm" fw={locked ? 400 : 600} c={locked ? "dimmed" : "#3d1f04"}>
          {res.title}
        </Text>
        {res.description && (
          <Text size="xs" c="dimmed">{res.description}</Text>
        )}
      </Stack>
      {locked ? (
        <Badge size="xs" color="gray" variant="outline">Members only</Badge>
      ) : (
        <ExternalLink size={12} color="var(--mantine-color-gray-6)" />
      )}
    </Group>
  );
}

// ─── Module Card ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  live:     { color: "#c0392b", label: "Live Now",  bg: "#fdf2f2" },
  upcoming: { color: "#7f5a2f", label: "Upcoming",  bg: "#fffaf0" },
  past:     { color: "#6b7280", label: "Completed", bg: "#f9fafb" },
};

function ModuleCard({ session, index, isEnrolled }: { session: Session; index: number; isEnrolled: boolean }) {
  const [open, setOpen] = useState(false);
  const status = sessionStatus(session.scheduledAt, session.durationMinutes);
  const sc = STATUS_CONFIG[status];
  const resources = session.resources ?? [];
  const hasVideoConf = !!(session.videoConferenceUrl || session.nextcloudTalkToken);

  return (
    <Paper
      withBorder
      radius="md"
      shadow={open ? "md" : "xs"}
      style={{
        borderLeft: `4px solid ${sc.color}`,
        background: open ? sc.bg : "white",
        transition: "all 0.2s",
      }}
    >
      <UnstyledButton
        onClick={() => setOpen((o) => !o)}
        p="md"
        w="100%"
      >
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" align="flex-start" style={{ flex: 1 }}>
            {/* Module number bubble */}
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: sc.color,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </Box>

            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={700} size="md" style={{ color: "#3d1f04", fontFamily: "'Cinzel', serif" }}>
                  {session.title}
                </Text>
                {status === "live" && (
                  <Badge color="red" size="xs" variant="filled" style={{ animation: "pulse 2s infinite" }}>
                    ● Live
                  </Badge>
                )}
              </Group>
              <Group gap="md">
                <Group gap={4}>
                  <Calendar size={13} color="#9a7650" />
                  <Text size="xs" c="dimmed">
                    {fmt(session.scheduledAt, { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </Group>
                {session.durationMinutes && (
                  <Group gap={4}>
                    <Clock size={13} color="#9a7650" />
                    <Text size="xs" c="dimmed">{session.durationMinutes} min</Text>
                  </Group>
                )}
                {resources.length > 0 && (
                  <Group gap={4}>
                    <BookOpen size={13} color="#9a7650" />
                    <Text size="xs" c="dimmed">{resources.length} resource{resources.length !== 1 ? "s" : ""}</Text>
                  </Group>
                )}
              </Group>
            </Stack>
          </Group>

          <Box mt={4} style={{ flexShrink: 0 }}>
            {open ? <ChevronUp size={18} color="#9a7650" /> : <ChevronDown size={18} color="#9a7650" />}
          </Box>
        </Group>
      </UnstyledButton>

      <Collapse in={open}>
        <Divider mx="md" />
        <Stack gap="md" p="md" pt="sm">
          {session.description && (
            <Text size="sm" c="#5a3e28" style={{ lineHeight: 1.7 }}>
              {session.description}
            </Text>
          )}

          {/* Video conference button */}
          {hasVideoConf && (
            <Group>
              {session.nextcloudTalkToken ? (
                <Button
                  component="a"
                  href={`/api/talk/join?token=${session.nextcloudTalkToken}`}
                  leftSection={<Video size={16} />}
                  color="red"
                  variant={isEnrolled ? "filled" : "light"}
                  radius="xl"
                  disabled={!isEnrolled}
                >
                  {isEnrolled ? "Join Talk Room" : "Enroll to Join"}
                </Button>
              ) : session.videoConferenceUrl ? (
                <Button
                  component="a"
                  href={isEnrolled ? session.videoConferenceUrl : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<Video size={16} />}
                  variant={isEnrolled ? "filled" : "light"}
                  color="indigo"
                  radius="xl"
                  disabled={!isEnrolled}
                >
                  {isEnrolled ? "Join Video Session" : "Enroll to Join"}
                </Button>
              ) : null}

              {!isEnrolled && (
                <Text size="xs" c="dimmed" fs="italic">
                  Enroll to access live sessions
                </Text>
              )}
            </Group>
          )}

          {/* Materials */}
          {resources.length > 0 && (
            <Stack gap="xs">
              <Text size="xs" fw={700} tt="uppercase" lts={1} c="dimmed">
                Materials
              </Text>
              {resources.map((res) => (
                <ResourceRow key={res.id} res={res} isEnrolled={isEnrolled} />
              ))}
            </Stack>
          )}

          {/* Location for in-person */}
          {!session.isOnline && session.location && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">📍 {session.location}</Text>
            </Group>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkshopPage({ workshop, currentUser, isEnrolled, replies }: WorkshopPageProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const sessions = [...(workshop.sessions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const pastCount = sessions.filter((s) => sessionStatus(s.scheduledAt, s.durationMinutes) === "past").length;
  const progressPct = sessions.length > 0 ? Math.round((pastCount / sessions.length) * 100) : 0;

  return (
    <Box
      style={{
        background: "var(--eac-bg, #fffaf0)",
        minHeight: "100vh",
        paddingBottom: rem(100),
      }}
    >
      {/* ── Cover image hero ── */}
      {workshop.coverImage?.url && (
        <Box
          style={{
            width: "100%",
            height: rem(300),
            overflow: "hidden",
            position: "relative",
          }}
        >
          <img
            src={workshop.coverImage.url}
            alt={workshop.coverImage.alt ?? workshop.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(0.7)",
            }}
          />
          <Box
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent 40%, rgba(30,15,5,0.75) 100%)",
            }}
          />
          <Box
            style={{
              position: "absolute",
              bottom: rem(24),
              left: rem(24),
              right: rem(24),
            }}
          >
            <Title
              order={1}
              style={{
                color: "white",
                fontFamily: "'Cinzel', serif",
                fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {workshop.title}
            </Title>
            {workshop.guide && (
              <Group gap="sm" mt="xs">
                <Avatar src={workshop.guide.avatarUrl} size="sm" radius="xl" color="orange">
                  {workshop.guide.displayName[0]}
                </Avatar>
                <Text size="sm" c="rgba(255,255,255,0.9)" fs="italic">
                  Led by {workshop.guide.displayName}
                </Text>
              </Group>
            )}
          </Box>
        </Box>
      )}

      <Container size="sm" py="xl">
        {/* Back link */}
        <Box mb="md">
          <Link
            href="/feed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#7a5230",
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            <ArrowLeft size={15} />
            Back to feed
          </Link>
        </Box>

        <Stack gap="xl">
          {/* ── Meta strip ── */}
          {!workshop.coverImage?.url && (
            <Title order={1} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
              {workshop.title}
            </Title>
          )}

          <Group gap="md" wrap="wrap" justify="space-between" align="center">
            <Group gap="md" wrap="wrap">
              {typeof workshop.price === "number" && (
                <Badge color="orange" variant="filled" size="lg" radius="sm">
                  {workshop.price === 0 ? "Free" : `$${workshop.price}`}
                </Badge>
              )}
              {sessions.length > 0 && (
                <Group gap={4}>
                  <BookOpen size={15} color="#9a7650" />
                  <Text size="sm" c="dimmed">{sessions.length} modules</Text>
                </Group>
              )}
              {typeof workshop.attendeeCount === "number" && (
                <Group gap={4}>
                  <Users size={15} color="#9a7650" />
                  <Text size="sm" c="dimmed">{workshop.attendeeCount} enrolled</Text>
                </Group>
              )}
            </Group>
            <button
              type="button"
              className="jwm__submit"
              onClick={() => setJoinOpen(true)}
              style={{ margin: 0 }}
            >
              <Sparkles size={14} />
              Join Workshop
            </button>
          </Group>

          <JoinWorkshopModal
            workshop={{
              id: workshop.id,
              title: workshop.title,
              price: workshop.price,
              currency: undefined,
            }}
            opened={joinOpen}
            onClose={() => setJoinOpen(false)}
            user={
              currentUser
                ? {
                    id: currentUser.id,
                    email: currentUser.displayName ?? "",
                    displayName: currentUser.displayName ?? undefined,
                  }
                : null
            }
          />

          {/* ── Progress (enrolled only) ── */}
          {isEnrolled && sessions.length > 0 && (
            <Paper withBorder radius="md" p="md" style={{ background: "#fffbf3" }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600} c="#7a5230">Your Progress</Text>
                  <Text size="xs" c="dimmed">{pastCount} / {sessions.length} sessions</Text>
                </Group>
                <Progress value={progressPct} color="orange" radius="xl" size="md" />
              </Stack>
            </Paper>
          )}

          {/* ── Description ── */}
          {(workshop.pitch || workshop.description) && (
            <Paper withBorder radius="lg" p="xl" style={{ background: "white" }}>
              <Text
                style={{
                  fontFamily: "'Crimson Text', Georgia, serif",
                  fontSize: "1.1rem",
                  lineHeight: 1.75,
                  color: "#2a1a05",
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(workshop.pitch ?? workshop.description ?? "") }}
              />
            </Paper>
          )}

          {/* ── Nextcloud Talk for the whole workshop ── */}
          {workshop.nextcloudTalkToken && (
            <Paper
              withBorder
              radius="md"
              p="md"
              style={{ background: isEnrolled ? "#fff8ef" : "#f9fafb", borderColor: isEnrolled ? "#e5a84a" : undefined }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm">
                  <ThemeIcon color="orange" variant="light" radius="xl" size="lg">
                    <MessageCircle size={18} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={700} size="sm" c="#7a5230">Workshop Discussion Room</Text>
                    <Text size="xs" c="dimmed">Live group chat on Nextcloud Talk</Text>
                  </Stack>
                </Group>
                <Tooltip label={isEnrolled ? undefined : "Enroll to access"} disabled={isEnrolled}>
                  <Button
                    component="a"
                    href={isEnrolled ? `/api/talk/join?token=${workshop.nextcloudTalkToken}` : "#"}
                    target={isEnrolled ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    variant={isEnrolled ? "filled" : "light"}
                    color="orange"
                    size="sm"
                    radius="xl"
                    disabled={!isEnrolled}
                    leftSection={<MessageCircle size={14} />}
                  >
                    {isEnrolled ? "Open Room" : "Members Only"}
                  </Button>
                </Tooltip>
              </Group>
            </Paper>
          )}

          {/* ── Modules / Sessions ── */}
          {sessions.length > 0 && (
            <Stack gap="md">
              <Group justify="space-between" align="flex-end">
                <Stack gap={0}>
                  <Text size="xs" fw={700} tt="uppercase" lts={1} c="#9a7650">Curriculum</Text>
                  <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                    Course Modules
                  </Title>
                </Stack>
                <Text size="sm" c="dimmed">{sessions.length} sessions</Text>
              </Group>

              {sessions.map((session, i) => (
                <ModuleCard
                  key={session.id}
                  session={session}
                  index={i}
                  isEnrolled={isEnrolled}
                />
              ))}
            </Stack>
          )}

          {/* ── Discussion ── */}
          <Divider
            label={
              <Group gap="xs">
                <MessageCircle size={14} />
                <span>Discussion</span>
              </Group>
            }
            labelPosition="center"
          />

          <CommentSection
            initialReplies={replies}
            meetingId={workshop.id}
            threadKind="workshop"
            currentUserId={currentUser?.id ?? null}
            currentUserName={currentUser?.displayName ?? null}
            currentUserInitials={currentUser?.initials ?? null}
          />
        </Stack>
      </Container>

      {/* ── Sticky enrollment bar ── */}
      {!isEnrolled && (
        <Paper
          shadow="xl"
          p="md"
          withBorder
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: "rgba(255,250,240,0.97)",
            backdropFilter: "blur(10px)",
            borderBottom: 0,
            borderLeft: 0,
            borderRight: 0,
          }}
        >
          <Box maw={rem(640)} mx="auto">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" fw={700} tt="uppercase" lts={1} c="dimmed">Workshop</Text>
                <Text fw={700} c="#3d1f04" size="sm" lineClamp={1}>{workshop.title}</Text>
              </Stack>
              <Group gap="md">
                {typeof workshop.price === "number" && workshop.price > 0 && (
                  <Text fw={800} size="lg" c="#b07d2a">${workshop.price}</Text>
                )}
                <Button radius="xl" color="orange" size="md">
                  {typeof workshop.price === "number" && workshop.price === 0 ? "Join Free" : "Enroll Now"}
                </Button>
              </Group>
            </Group>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
