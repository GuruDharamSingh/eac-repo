"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, RefreshCw, UserCircle } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import type { QuestionPoll } from "@elkdonis/services";
import { useRealtimeFeed } from "@elkdonis/hooks";
import { notifications } from "@mantine/notifications";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { PollCard } from "./poll-card";
import { ContentForm, BaroqueSignup } from "@elkdonis/ui";
import { AttendeeModal } from "./attendee-modal";
import { FeaturedRow } from "./featured-row";
import { FeedTabsBar } from "./feed-tabs-bar";
import { ForumFeedCard } from "./forum-feed-card";
import { SubstackFeedCard } from "./substack-feed-card";
import { WorkQuestionBox } from "./work-question-box";
import { ProfileModal } from "./profile-modal";
import type { ForumThreadSummary } from "@/lib/forum";
import type { SubstackPost } from "@/lib/substack";
import { type FeedTabKey, DEFAULT_TAB_ORDER, normalizeTabOrder } from "@/lib/feed-tabs";
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
  substackPosts?: SubstackPost[];
  tabOrder?: FeedTabKey[];
  userId?: string | null;
  isAdmin?: boolean;
}

export function FeedClient({ initialFeed, recurringMeetings = [], forumThreads = [], substackPosts = [], tabOrder, userId, isAdmin = false }: FeedClientProps) {
  const router = useRouter();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [editDrawerOpened, { open: openEditDrawer, close: closeEditDrawer }] = useDisclosure(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [attendeeModalOpened, setAttendeeModalOpened] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [feed, setFeed] = useState(initialFeed);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [pinningThreadId, setPinningThreadId] = useState<string | null>(null);

  // Feed tabs. Order is admin-configurable; default tab is the first in order.
  const [order, setOrder] = useState<FeedTabKey[]>(
    tabOrder && tabOrder.length ? normalizeTabOrder(tabOrder) : DEFAULT_TAB_ORDER
  );
  const [activeTab, setActiveTab] = useState<FeedTabKey>(
    (tabOrder && tabOrder.length ? normalizeTabOrder(tabOrder) : DEFAULT_TAB_ORDER)[0]
  );

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingPost(null);
    setEditingMeeting(meeting);
    openEditDrawer();
  };

  const handleEditPost = (post: Post) => {
    setEditingMeeting(null);
    setEditingPost(post);
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

  const meetingKindOf = (item: (typeof feed)[number]) =>
    item.type === "meeting" ? ((item.data as Meeting).kind ?? "meeting") : null;

  // Per-tab content. Meetings/Workshops show native cards (pinned inline, since
  // the featured strip lives only on All). Publications + All also fold in
  // forum threads and Substack posts, merged by date (newest first).
  type MergedEntry =
    | { sort: number; key: string; kind: "feed"; item: (typeof feed)[number] }
    | { sort: number; key: string; kind: "forum"; thread: ForumThreadSummary }
    | { sort: number; key: string; kind: "substack"; post: SubstackPost };

  const dateMs = (d: Date | string | undefined) => {
    const t = d ? new Date(d).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };

  const { meetingsTab, workshopsTab, publicationsTab, allTab } = useMemo(() => {
    const meetings = feed.filter((i) => meetingKindOf(i) === "meeting");
    const workshops = feed.filter((i) => {
      const k = meetingKindOf(i);
      return k === "workshop" || k === "event";
    });

    const forumEntries: MergedEntry[] = forumThreads.map((t) => ({
      sort: dateMs(t.lastActivityAt ?? t.createdAt),
      key: `forum-${t.id}`,
      kind: "forum",
      thread: t,
    }));
    const substackEntries: MergedEntry[] = substackPosts.map((p, i) => ({
      sort: dateMs(p.pubDate),
      key: `substack-${i}`,
      kind: "substack",
      post: p,
    }));

    const postEntries: MergedEntry[] = feed
      .filter((i) => i.type === "post")
      .map((item) => ({ sort: dateMs(item.createdAt), key: `post-${item.data.id}`, kind: "feed", item }));

    const publications = [...postEntries, ...forumEntries, ...substackEntries].sort((a, b) => b.sort - a.sort);

    // All = every non-pinned native item + forum + substack, interleaved.
    const nativeEntries: MergedEntry[] = standardFeed.map((item) => ({
      sort: dateMs(item.createdAt),
      key: `feed-${item.type}-${item.data.id}`,
      kind: "feed",
      item,
    }));
    const all = [...nativeEntries, ...forumEntries, ...substackEntries].sort((a, b) => b.sort - a.sort);

    return { meetingsTab: meetings, workshopsTab: workshops, publicationsTab: publications, allTab: all };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, forumThreads, substackPosts]);

  const tabCounts: Partial<Record<FeedTabKey, number>> = {
    meetings: meetingsTab.length,
    workshops: workshopsTab.length,
    publications: publicationsTab.length,
  };

  const renderMergedEntry = (entry: MergedEntry, index: number) => {
    if (entry.kind === "forum") return <ForumFeedCard key={entry.key} thread={entry.thread} />;
    if (entry.kind === "substack") return <SubstackFeedCard key={entry.key} post={entry.post} />;
    return renderFeedItem(entry.item, index);
  };

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
        canEdit={isAdmin || (item.data as Meeting).createdBy === userId}
        onEdit={handleEditMeeting}
        currentUserId={userId}
        isAdmin={isAdmin}
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
        canEdit={isAdmin || (item.data as Post).authorId === userId}
        onEdit={() => handleEditPost(item.data as Post)}
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
        <Container fluid style={{ position: 'relative' }}>
          <Title
            order={2}
            fw={400}
            style={{
              color: '#fdf0d0',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: "'Brothers', 'Cinzel', serif",
              fontSize: 'clamp(1.98rem, 6.2vw, 4.22rem)',
              lineHeight: 1.1,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Elkdonis Arts Collective
          </Title>
        </Container>
      </Paper>

      {/* Main Content */}
      <Container size="sm" py="lg" pb={120}>
        <Stack gap="lg">
          <WorkQuestionBox userId={userId} hideAnonymousNote />

          {/* Tabs — admin-reorderable; default tab is the first in order */}
          <FeedTabsBar
            order={order}
            value={activeTab}
            onChange={setActiveTab}
            isAdmin={isAdmin}
            counts={tabCounts}
            onOrderSaved={(next) => setOrder(next)}
          />

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

          {/* ── All ── featured strip + interleaved everything ── */}
          {activeTab === "all" && (
            <>
              <FeaturedRow
                pinnedItems={
                  pinnedFeed.filter((item) => item.type !== "poll") as Array<
                    { type: "meeting"; data: Meeting } | { type: "post"; data: Post }
                  >
                }
                recurringMeetings={recurringMeetings}
                userId={userId}
                isAdmin={isAdmin}
                pinningThreadId={pinningThreadId}
                onTogglePin={handleTogglePin}
              />
              {allTab.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  The table is quiet. Drop the first note, meeting, or fragment when it is ready.
                </Text>
              ) : (
                <Stack gap="md">{allTab.map((entry, i) => renderMergedEntry(entry, i))}</Stack>
              )}
            </>
          )}

          {/* ── Meetings ── */}
          {activeTab === "meetings" && (
            meetingsTab.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No meetings yet.</Text>
            ) : (
              <Stack gap="md">{meetingsTab.map((item, i) => renderFeedItem(item, i))}</Stack>
            )
          )}

          {/* ── Workshops ── */}
          {activeTab === "workshops" && (
            workshopsTab.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No workshops or events yet.</Text>
            ) : (
              <Stack gap="md">{workshopsTab.map((item, i) => renderFeedItem(item, i))}</Stack>
            )
          )}

          {/* ── Publications ── posts + forum + Substack ── */}
          {activeTab === "publications" && (
            publicationsTab.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No publications yet.</Text>
            ) : (
              <Stack gap="md">{publicationsTab.map((entry, i) => renderMergedEntry(entry, i))}</Stack>
            )
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
              <Box className="create-content-signin" py="md">
                <Text c="#fdf0d0" ta="center" mb="sm" fw={600}>
                  Sign in or create an account to post.
                </Text>
                <BaroqueSignup
                  initialMode="signin"
                  title="Join the table"
                  subtitle="Sign in or create an account to share a meeting, note, or fragment."
                  onSuccess={() => {
                    closeDrawer();
                    router.refresh();
                  }}
                />
              </Box>
            )}
          </ScrollArea>
        </Drawer>

        {/* Edit drawer */}
        <Drawer
          opened={editDrawerOpened}
          onClose={() => { closeEditDrawer(); setEditingMeeting(null); setEditingPost(null); }}
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
                {editingPost
                  ? "Edit Post"
                  : `Edit ${editingMeeting?.kind === "workshop" ? "Workshop" : "Meeting"}`}
              </Title>
              <Text size="sm" c="dimmed">{editingPost?.title ?? editingMeeting?.title}</Text>
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
            ) : userId && editingPost ? (
              <Box className="create-content-surface">
                <ContentForm
                  orgId="inner_group"
                  userId={userId}
                  isAdmin={isAdmin}
                  isCmsSite
                  initialThreadId={editingPost.id}
                  initialDraft={{
                    title: editingPost.title,
                    body: editingPost.body ?? "",
                    isMeeting: false,
                    visibility: (editingPost.visibility as "PUBLIC" | "ORGANIZATION") ?? "PUBLIC",
                    primaryOrgId: "inner_group",
                  }}
                  onPublished={() => {
                    closeEditDrawer();
                    setEditingPost(null);
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

        <Text
          size="xs"
          ta="center"
          mt="xl"
          style={{ color: 'var(--ig-moss)', opacity: 0.75 }}
        >
          Headings set in Brothers, a typeface by Emil Kozole, released under the SIL Open Font License.
        </Text>
      </Container>
    </Box>
  );
}
