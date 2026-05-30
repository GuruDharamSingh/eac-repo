"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Sparkles, RefreshCw, UserCircle } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import type { QuestionPoll } from "@elkdonis/services";
import { useRealtimeFeed } from "@elkdonis/hooks";
import { notifications } from "@mantine/notifications";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { PollCard } from "./poll-card";
import { ContentForm } from "@elkdonis/ui";
import { AttendeeModal } from "./attendee-modal";
import { RecurringMeetingsCarousel } from "./recurring-meetings-carousel";
import { WorkQuestionBox } from "./work-question-box";
import { LatestForumThreads } from "./latest-forum-threads";
import { HorizontalCarousel } from "./horizontal-carousel";
import { ProfileModal } from "./profile-modal";
import type { ForumThreadSummary } from "@/lib/forum";
import { supabase } from "@/lib/supabase";
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Transition,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

interface FeedClientProps {
  initialFeed: Array<{
    type: "meeting" | "post" | "poll";
    data: Meeting | Post | QuestionPoll;
    createdAt: Date;
  }>;
  recurringMeetings?: Meeting[];
  forumThreads?: ForumThreadSummary[];
  userId?: string | null;
  isAdmin?: boolean;
}

export function FeedClient({ initialFeed, recurringMeetings = [], forumThreads = [], userId, isAdmin = false }: FeedClientProps) {
  const router = useRouter();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [editDrawerOpened, { open: openEditDrawer, close: closeEditDrawer }] = useDisclosure(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [attendeeModalOpened, setAttendeeModalOpened] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [pinningThreadId, setPinningThreadId] = useState<string | null>(null);

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    openEditDrawer();
  };

  // Sync feed state when server data changes (e.g., after revalidation)
  useEffect(() => {
    setFeed(initialFeed);
  }, [initialFeed]);

  // Realtime feed subscription
  const { hasNewItems, newItemCount, clearNewItems } = useRealtimeFeed({
    client: supabase,
    orgId: "inner_group",
  });

  const handleShowNewItems = useCallback(() => {
    // Refresh the page to get full hydrated data for new items
    router.refresh();
    clearNewItems();
  }, [router, clearNewItems]);

  const handleViewAttendees = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setAttendeeModalOpened(true);
  };

  const handleDeleteThread = async (threadId: string, itemType: "meeting" | "post") => {
    const label = itemType === "meeting" ? "thread" : "post";
    if (!confirm(`Delete this ${label} from the feed?`)) return;

    const previousFeed = feed;
    setDeletingThreadId(threadId);
    setFeed((currentFeed) =>
      currentFeed.filter((item) => item.data.id !== threadId)
    );

    try {
      const response = await fetch(`/api/content/${threadId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete thread");
      }

      notifications.show({
        color: "green",
        title: itemType === "meeting" ? "Thread deleted" : "Post deleted",
        message: "The item has been removed from the feed.",
      });
      router.refresh();
      clearNewItems();
    } catch (error) {
      setFeed(previousFeed);
      notifications.show({
        color: "red",
        title: "Could not delete thread",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setDeletingThreadId(null);
    }
  };

  const isPinned = (item: { type: "meeting" | "post" | "poll"; data: Meeting | Post | QuestionPoll }) => {
    if (item.type === "poll") return false;
    return Boolean((item.data as any).metadata?.feedPinned);
  };

  const setItemPinned = (
    currentFeed: typeof feed,
    threadId: string,
    pinned: boolean
  ) => currentFeed.map((item) => {
    if (item.data.id !== threadId || item.type === "poll") return item;
    return {
      ...item,
      data: {
        ...(item.data as any),
        metadata: {
          ...((item.data as any).metadata ?? {}),
          feedPinned: pinned,
        },
      },
    };
  });

  const handleTogglePin = async (threadId: string, nextPinned: boolean) => {
    const previousFeed = feed;
    setPinningThreadId(threadId);
    setFeed((currentFeed) => setItemPinned(currentFeed, threadId, nextPinned));

    try {
      const response = await fetch(`/api/content/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedPinned: nextPinned }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update pinned state");
      }

      notifications.show({
        color: "green",
        title: nextPinned ? "Pinned above feed" : "Unpinned from feature",
        message: nextPinned ? "This thread is now featured above the feed." : "This thread has returned to the ordinary feed.",
      });
      router.refresh();
      clearNewItems();
    } catch (error) {
      setFeed(previousFeed);
      notifications.show({
        color: "red",
        title: "Could not update pin",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPinningThreadId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const pinnedFeed = feed.filter(isPinned);
  const standardFeed = feed.filter((item) => !isPinned(item));

  const renderFeedItem = (item: (typeof feed)[number], index: number, pinnedSection = false) =>
    item.type === "meeting" ? (
      <MeetingCard
        key={`${pinnedSection ? "pinned" : "meeting"}-${item.data.id}-${index}`}
        meeting={item.data as Meeting}
        onViewAttendees={handleViewAttendees}
        canDelete={isAdmin}
        deleting={deletingThreadId === item.data.id}
        onDelete={() => handleDeleteThread(item.data.id, "meeting")}
        canPin={isAdmin}
        pinned={isPinned(item)}
        pinning={pinningThreadId === item.data.id}
        onTogglePin={() => handleTogglePin(item.data.id, !isPinned(item))}
        showPrivateBadge={isAdmin}
        canEdit={isAdmin}
        onEdit={handleEditMeeting}
      />
    ) : item.type === "poll" ? (
      <PollCard
        key={`poll-${item.data.id}-${index}`}
        poll={item.data as QuestionPoll}
      />
    ) : (
      <PostCard
        key={`${pinnedSection ? "pinned" : "post"}-${item.data.id}-${index}`}
        post={item.data as Post}
        canDelete={isAdmin}
        deleting={deletingThreadId === item.data.id}
        onDelete={() => handleDeleteThread(item.data.id, "post")}
        canPin={isAdmin}
        pinned={isPinned(item)}
        pinning={pinningThreadId === item.data.id}
        onTogglePin={() => handleTogglePin(item.data.id, !isPinned(item))}
      />
    );

  return (
    <Box className="archive-shell">
      {/* Header */}
      <Paper
        shadow="md"
        p="md"
        className="archive-topbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Container>
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="md" radius="sm" variant="filled" color="ember">
                <Sparkles size={18} />
              </ThemeIcon>
              <Title
                order={4}
                style={{
                  color: '#fdf0d0',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                Inner Gathering
              </Title>
            </Group>
            <Group gap="xs">
              {userId && (
                <ActionIcon
                  variant="subtle"
                  size="md"
                  style={{ color: '#f0c98a' }}
                  onClick={() => setProfileOpen(true)}
                  title="Edit profile"
                >
                  <UserCircle size={20} />
                </ActionIcon>
              )}
              <Button
                variant="subtle"
                size="sm"
                style={{ color: '#f0c98a' }}
                leftSection={<LogOut size={16} />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Group>
          </Group>
        </Container>
      </Paper>

      {/* Main Content */}
      <Container size="sm" py="lg" pb={120}>
        <Stack gap="lg">
          {/* Page Header */}
          <div className="archive-page-header">
            <Text className="archive-kicker">Gathering table</Text>
            <Title
              order={2}
              className="archive-title"
            >
              Feed
            </Title>
            <Text size="sm" className="archive-muted" style={{ fontStyle: 'italic' }}>
              Notices, fragments, meetings, and field notes from the collective
            </Text>
          </div>

          <Divider className="archive-divider" size="sm" />

          <WorkQuestionBox userId={userId} />

          <LatestForumThreads threads={forumThreads} />

          {/* Recurring Meetings Carousel */}
          {recurringMeetings.length > 0 && (
            <RecurringMeetingsCarousel meetings={recurringMeetings} />
          )}

          {pinnedFeed.length > 0 && (
            <HorizontalCarousel
              kicker="Pinned"
              title="Featured from the feed"
              count={pinnedFeed.length}
            >
              {pinnedFeed.map((item, index) => (
                <div key={`${item.type}-${item.data.id}-${index}`} className="feed-carousel-item">
                  {renderFeedItem(item, index, true)}
                </div>
              ))}
            </HorizontalCarousel>
          )}

          {/* New Items Banner */}
          <Transition mounted={hasNewItems} transition="slide-down" duration={300}>
            {(styles) => (
              <Paper
                withBorder
                radius="sm"
                p="sm"
                style={{
                  ...styles,
                  borderColor: '#c8910a',
                  background: 'linear-gradient(90deg, #fff8ec, #fff3d8)',
                  cursor: 'pointer',
                }}
                onClick={handleShowNewItems}
              >
                <Group justify="center" gap="xs">
                  <RefreshCw size={16} color="#c8610a" />
                  <Text size="sm" fw={600} style={{ color: '#8b3e0a', fontStyle: 'italic' }}>
                    {newItemCount} new {newItemCount === 1 ? "item" : "items"} available
                  </Text>
                </Group>
              </Paper>
            )}
          </Transition>

          {/* Feed Items */}
          {standardFeed.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {pinnedFeed.length > 0
                ? "All current feed items are pinned above."
                : "The table is quiet. Drop the first note, meeting, or fragment when it is ready."}
            </Text>
          ) : (
            <Stack gap="md">
              {standardFeed.map((item, index) => renderFeedItem(item, index))}
            </Stack>
          )}
        </Stack>

        {/* Floating Action Button */}
        <ActionIcon
          size={56}
          radius="sm"
          variant="filled"
          color="eacSky"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            boxShadow: '0 4px 20px rgba(1, 18, 78, 0.28)',
            border: '2px solid #b79a55',
          }}
          onClick={openDrawer}
        >
          <Plus size={24} />
        </ActionIcon>

        {/* Bottom Drawer for Create Form */}
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          position="bottom"
          size="90%"
          classNames={{
            content: "create-content-drawer",
            header: "create-content-drawer__header",
            body: "create-content-drawer__body",
          }}
          title={
            <div>
              <Title order={4}>Make a Notice</Title>
              <Text size="sm" c="dimmed">
                Meeting, note, image, poll, or fragment
              </Text>
            </div>
          }
        >
          <ScrollArea h="calc(90vh - 8rem)" className="create-content-scroll">
            {userId ? (
              <Box className="create-content-surface">
                <ContentForm
                  orgId="inner_group"
                  userId={userId}
                  isAdmin={isAdmin}
                  isCmsSite
                  onPublished={() => {
                    closeDrawer();
                    router.refresh();
                    clearNewItems();
                  }}
                />
              </Box>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Sign in to create content.
              </Text>
            )}
          </ScrollArea>
        </Drawer>

        {/* Edit drawer */}
        <Drawer
          opened={editDrawerOpened}
          onClose={() => { closeEditDrawer(); setEditingMeeting(null); }}
          position="bottom"
          size="90%"
          classNames={{
            content: "create-content-drawer",
            header: "create-content-drawer__header",
            body: "create-content-drawer__body",
          }}
          title={
            <div>
              <Title order={4}>Edit {editingMeeting?.kind === "workshop" ? "Workshop" : "Meeting"}</Title>
              <Text size="sm" c="dimmed">{editingMeeting?.title}</Text>
            </div>
          }
        >
          <ScrollArea h="calc(90vh - 8rem)" className="create-content-scroll">
            {userId && editingMeeting ? (
              <Box className="create-content-surface">
                <ContentForm
                  orgId="inner_group"
                  userId={userId}
                  isAdmin={isAdmin}
                  isCmsSite
                  initialThreadId={editingMeeting.id}
                  initialDraft={{
                    title: editingMeeting.title,
                    body: editingMeeting.description ?? "",
                    isMeeting: true,
                    scheduledAt: editingMeeting.scheduledAt
                      ? new Date(editingMeeting.scheduledAt).toISOString()
                      : null,
                    durationMinutes: editingMeeting.durationMinutes ?? null,
                    location: editingMeeting.location ?? null,
                    isOnline: editingMeeting.isOnline ?? false,
                    isRsvpEnabled: editingMeeting.isRSVPEnabled,
                    attendeeLimit: editingMeeting.attendeeLimit ?? null,
                    visibility: (editingMeeting.visibility as "PUBLIC" | "ORGANIZATION") ?? "PUBLIC",
                    primaryOrgId: "inner_group",
                  }}
                  onPublished={() => {
                    closeEditDrawer();
                    setEditingMeeting(null);
                    router.refresh();
                    clearNewItems();
                  }}
                />
              </Box>
            ) : null}
          </ScrollArea>
        </Drawer>

        {/* Attendee Modal */}
        <AttendeeModal
          meeting={selectedMeeting}
          opened={attendeeModalOpened}
          onClose={() => setAttendeeModalOpened(false)}
        />

        {/* Profile Modal */}
        <ProfileModal
          opened={profileOpen}
          onClose={() => setProfileOpen(false)}
        />
      </Container>
    </Box>
  );
}
