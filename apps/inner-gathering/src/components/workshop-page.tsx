"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  rem,
} from "@mantine/core";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  MessageCircle,
  Pencil,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useThreadRsvp } from "@elkdonis/hooks";
import { CommentSection } from "@/components/comment-section";
import { JoinWorkshopModal } from "@/components/join-workshop-modal";
import { WorkshopSectionsNav } from "@/components/workshop-sections-nav";
import { sessionStatus } from "@/lib/workshop-session-status";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  title: string;
  type: "link" | "pdf" | "video" | "audio" | "doc" | "other";
  url: string;
  isPublic: boolean;
  description?: string;
}

export interface Session {
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
  mediaUrl?: string | null;
  videoUrl?: string | null;
  backgroundColor?: string | null;
  resources?: Resource[];
}

interface Guide {
  displayName: string;
  avatarUrl?: string;
  guideId?: string;
}

interface Workshop {
  id: string;
  title: string;
  description?: string;
  pitch?: string;
  coverImage?: { url: string; alt?: string };
  bannerImageUrl?: string | null;
  bannerFocalY?: number | null;
  heroMediaUrl?: string | null;
  heroMediaType?: "image" | "video" | null;
  heroText?: string | null;
  backgroundColor?: string | null;
  guide?: Guide;
  organization?: { name: string };
  price?: number;
  attendeeCount?: number;
  attendeeLimit?: number | null;
  rsvpDeadline?: string | null;
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
  isOwner?: boolean;
  /** Free (or still-pending-payment) RSVPs can self-cancel; a paid enrollment can't. */
  canCancelRsvp?: boolean;
  replies: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// `now` is only known on the client (an SSR render can't know the true
// current time without also causing a hydration mismatch), so this starts
// null and fills in after mount, refreshing periodically to keep live/past
// badges current.
function useMountedNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "Led by {name}" — links to the facilitator's profile when we have their id. */
function GuideByline({ guide }: { guide: Guide }) {
  const content = (
    <Group gap="sm" mt="xs" style={{ width: "fit-content" }}>
      <Avatar src={guide.avatarUrl} size="sm" radius="xl" color="orange">
        {guide.displayName[0]}
      </Avatar>
      <Text size="sm" c="rgba(255,255,255,0.9)" fs="italic">
        Led by {guide.displayName}
      </Text>
    </Group>
  );
  if (!guide.guideId) return content;
  return (
    <Link href={`/profile/${guide.guideId}`} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkshopPage({ workshop, currentUser, isEnrolled, isOwner = false, canCancelRsvp = false, replies }: WorkshopPageProps) {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const deadlinePassed = Boolean(workshop.rsvpDeadline && new Date(workshop.rsvpDeadline) < new Date());
  const atCapacity = Boolean(
    workshop.attendeeLimit != null &&
    typeof workshop.attendeeCount === "number" &&
    workshop.attendeeCount >= workshop.attendeeLimit
  );
  const rsvpClosed = deadlinePassed || atCapacity;

  // Thread-agnostic RSVP hook (same one meetings use) — seeded from the
  // server-computed isEnrolled so there's no redundant client-side status
  // check; only used here for the cancel action + its loading state.
  const { isLoading: cancelling, rsvp } = useThreadRsvp(workshop.id, {
    enabled: false,
    initialIsAttending: isEnrolled,
  });

  const handleCancelRsvp = async () => {
    if (!window.confirm("Cancel your RSVP for this workshop?")) return;
    await rsvp(false);
    router.refresh();
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${workshop.title}"? It'll come off the feed but stay in My Offerings, marked as archived.`)) {
      return;
    }
    setArchiving(true);
    try {
      const res = await fetch(`/api/content/${workshop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      router.push("/offerings");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive");
      setArchiving(false);
    }
  };
  const sessions = [...(workshop.sessions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const now = useMountedNow();
  const pastCount = now === null ? 0 : sessions.filter((s) => sessionStatus(s.scheduledAt, s.durationMinutes, now) === "past").length;
  const progressPct = sessions.length > 0 ? Math.round((pastCount / sessions.length) * 100) : 0;
  // Banner slot falls back to the card cover image
  const bannerUrl = workshop.bannerImageUrl || workshop.coverImage?.url;

  return (
    <Box
      style={{
        background: workshop.backgroundColor || "#fffaf0",
        minHeight: "100vh",
        paddingBottom: rem(100),
      }}
    >
      {/* ── Banner hero ── */}
      {bannerUrl && (
        <Box
          style={{
            width: "100%",
            height: rem(300),
            overflow: "hidden",
            position: "relative",
          }}
        >
          <img
            src={bannerUrl}
            alt={workshop.coverImage?.alt ?? workshop.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `center ${workshop.bannerFocalY ?? 50}%`,
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
          {/* Compact nav — this hero replaces the site header on this page
              (see layout-wrapper.tsx), so it carries the minimal "get back
              to the app" links itself. */}
          <Group
            justify="space-between"
            style={{ position: "absolute", top: rem(16), left: rem(24), right: rem(24) }}
          >
            <Link
              href="/feed"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.9)", textDecoration: "none", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              <ArrowLeft size={14} />
              Feed
            </Link>
            <Link
              href={currentUser ? "/account" : "/login"}
              style={{ color: "rgba(255,255,255,0.9)", textDecoration: "none", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              {currentUser ? "Account" : "Login"}
            </Link>
          </Group>
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
              <GuideByline guide={workshop.guide} />
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
          {!bannerUrl && (
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
                  <Text size="sm" c="dimmed">
                    {workshop.attendeeCount}
                    {workshop.attendeeLimit ? ` / ${workshop.attendeeLimit}` : ""} enrolled
                  </Text>
                </Group>
              )}
              {deadlinePassed && !isEnrolled && (
                <Badge color="gray" variant="outline" size="sm">RSVP closed</Badge>
              )}
              {atCapacity && !deadlinePassed && !isEnrolled && (
                <Badge color="gray" variant="outline" size="sm">Workshop full</Badge>
              )}
            </Group>
            <Group gap="sm">
              {isOwner && (
                <>
                  <Button
                    component={Link}
                    href={`/workshops/${workshop.id}/edit`}
                    variant="light"
                    color="orange"
                    size="xs"
                    leftSection={<Pencil size={13} />}
                  >
                    Edit workshop
                  </Button>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    loading={archiving}
                    leftSection={<Archive size={13} />}
                    onClick={handleArchive}
                  >
                    Archive
                  </Button>
                </>
              )}
              {!isOwner && isEnrolled && canCancelRsvp && (
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  loading={cancelling}
                  onClick={handleCancelRsvp}
                >
                  Cancel RSVP
                </Button>
              )}
              {!isEnrolled && (
                <button
                  type="button"
                  className="jwm__submit"
                  onClick={() => setJoinOpen(true)}
                  disabled={rsvpClosed}
                  style={{ margin: 0, opacity: rsvpClosed ? 0.5 : 1, cursor: rsvpClosed ? "not-allowed" : "pointer" }}
                >
                  <Sparkles size={14} />
                  Join Workshop
                </button>
              )}
            </Group>
          </Group>

          {/* ── Main media (hero slot) ── */}
          {workshop.heroMediaUrl && (
            <Box style={{ borderRadius: 8, overflow: "hidden", position: "relative" }}>
              {workshop.heroMediaType === "video" ? (
                <video
                  src={workshop.heroMediaUrl}
                  controls
                  style={{ width: "100%", display: "block" }}
                />
              ) : (
                <img
                  src={workshop.heroMediaUrl}
                  alt={workshop.title}
                  style={{ width: "100%", display: "block" }}
                />
              )}
              {workshop.heroText && (
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: rem(20),
                    background: "linear-gradient(to top, rgba(20,10,0,0.6), transparent 55%)",
                    pointerEvents: "none",
                  }}
                >
                  <Title
                    order={2}
                    style={{
                      color: "white",
                      fontFamily: "'Cinzel', serif",
                      fontSize: "clamp(1.1rem, 3vw, 1.8rem)",
                      textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                    }}
                  >
                    {workshop.heroText}
                  </Title>
                </Box>
              )}
            </Box>
          )}

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

          {/* ── Sections: Overview + one entry per session ── */}
          {/* Breaks out of the page's size="sm" Container so the sidebar
              layout gets more of the window width, per the request — the
              rest of the page stays narrow and readable. */}
          <Box
            style={{
              marginLeft: "calc(50% - 50vw)",
              marginRight: "calc(50% - 50vw)",
              paddingLeft: "clamp(1rem, 4vw, 3rem)",
              paddingRight: "clamp(1rem, 4vw, 3rem)",
            }}
          >
            <WorkshopSectionsNav
              workshopId={workshop.id}
              pitch={workshop.pitch}
              description={workshop.description}
              nextcloudTalkToken={workshop.nextcloudTalkToken}
              sessions={sessions}
              isEnrolled={isEnrolled}
              isOwner={isOwner}
              now={now}
              pastCount={pastCount}
              progressPct={progressPct}
            />
          </Box>

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
                <Button
                  radius="xl"
                  color="orange"
                  size="md"
                  disabled={rsvpClosed}
                  onClick={() => setJoinOpen(true)}
                >
                  {rsvpClosed
                    ? (deadlinePassed ? "RSVP Closed" : "Workshop Full")
                    : typeof workshop.price === "number" && workshop.price === 0
                      ? "Join Free"
                      : "Enroll Now"}
                </Button>
              </Group>
            </Group>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
