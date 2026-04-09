"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Sparkles, RefreshCw } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import type { QuestionPoll } from "@elkdonis/services";
import { useRealtimeFeed } from "@elkdonis/hooks";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { PollCard } from "./poll-card";
import { CreateContentForm } from "./create-content-form";
import { AttendeeModal } from "./attendee-modal";
import { RecurringMeetingsCarousel } from "./recurring-meetings-carousel";
import { LiveFeedWidget } from "./live-feed-widget";
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
}

export function FeedClient({ initialFeed, recurringMeetings = [] }: FeedClientProps) {
  const router = useRouter();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [attendeeModalOpened, setAttendeeModalOpened] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [feed, setFeed] = useState(initialFeed);

  // Sync feed state when server data changes (e.g., after revalidation)
  useEffect(() => {
    setFeed(initialFeed);
  }, [initialFeed]);

  // Realtime feed subscription
  const { hasNewItems, newItemCount, consumeNewItems, clearNewItems } = useRealtimeFeed({
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <Box mih="100vh" style={{ background: '#fdf6e3' }}>
      {/* Header */}
      <Paper
        shadow="md"
        p="md"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: 'linear-gradient(135deg, #3d1f0a 0%, #6b3615 50%, #3d1f0a 100%)',
          borderBottom: '3px solid #c8910a',
          borderRadius: 0,
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
        </Container>
      </Paper>

      {/* Main Content */}
      <Container size="sm" py="lg" pb={120}>
        <Stack gap="lg">
          {/* Page Header */}
          <div>
            <Title
              order={2}
              style={{ color: '#4a2c0a', letterSpacing: '0.06em' }}
            >
              Feed
            </Title>
            <Text size="sm" style={{ color: '#8b6040', fontStyle: 'italic' }}>
              Upcoming meetings & community posts
            </Text>
          </div>

          <Divider color="orange.3" size="sm" />

          {/* Live Channel Widget */}
          <LiveFeedWidget />

          {/* Recurring Meetings Carousel */}
          {recurringMeetings.length > 0 && (
            <RecurringMeetingsCarousel meetings={recurringMeetings} />
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
          {feed.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No posts or meetings yet. Create one to get started!
            </Text>
          ) : (
            <Stack gap="md">
              {feed.map((item, index) =>
                item.type === "meeting" ? (
                  <MeetingCard
                    key={`meeting-${item.data.id}-${index}`}
                    meeting={item.data as Meeting}
                    onViewAttendees={handleViewAttendees}
                  />
                ) : item.type === "poll" ? (
                  <PollCard
                    key={`poll-${item.data.id}-${index}`}
                    poll={item.data as QuestionPoll}
                  />
                ) : (
                  <PostCard
                    key={`post-${item.data.id}-${index}`}
                    post={item.data as Post}
                  />
                )
              )}
            </Stack>
          )}
        </Stack>

        {/* Floating Action Button */}
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          color="ember"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            boxShadow: '0 4px 20px rgba(180, 80, 10, 0.45)',
            border: '2px solid #f0a040',
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
          title={
            <div>
              <Title order={4}>Create New</Title>
              <Text size="sm" c="dimmed">
                Share with the community
              </Text>
            </div>
          }
        >
          <ScrollArea h="calc(90vh - 8rem)">
            <CreateContentForm onSuccess={closeDrawer} />
          </ScrollArea>
        </Drawer>

        {/* Attendee Modal */}
        <AttendeeModal
          meeting={selectedMeeting}
          opened={attendeeModalOpened}
          onClose={() => setAttendeeModalOpened(false)}
        />
      </Container>
    </Box>
  );
}
