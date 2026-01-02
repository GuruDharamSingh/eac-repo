"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Sparkles, Calendar, FileText } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { CreateMeetingForm } from "./create-meeting-form";
import { CreatePostForm } from "./create-post-form";
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
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

interface FeedClientProps {
  initialFeed: Array<{
    type: "meeting" | "post";
    data: Meeting | Post;
    createdAt: Date;
  }>;
}

export function FeedClient({ initialFeed }: FeedClientProps) {
  const router = useRouter();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>("meeting");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <Box mih="100vh" bg="gray.0">
      {/* Header */}
      <Paper
        shadow="xs"
        p="md"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--mantine-color-gray-2)",
        }}
      >
        <Container>
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="md" radius="md" variant="light" color="indigo">
                <Sparkles size={18} />
              </ThemeIcon>
              <Title order={4}>InnerGathering</Title>
            </Group>
            <Button
              variant="subtle"
              size="sm"
              color="gray"
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
            <Title order={2}>Feed</Title>
            <Text size="sm" c="dimmed">
              Upcoming meetings and community posts
            </Text>
          </div>

          <Divider />

          {/* Feed Items */}
          {initialFeed.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No posts or meetings yet. Create one to get started!
            </Text>
          ) : (
            <Stack gap="md">
              {initialFeed.map((item, index) =>
                item.type === "meeting" ? (
                  <MeetingCard
                    key={`meeting-${item.data.id}-${index}`}
                    meeting={item.data as Meeting}
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
          color="indigo"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            boxShadow: "var(--mantine-shadow-lg)",
          }}
          onClick={openDrawer}
        >
          <Plus size={24} />
        </ActionIcon>

        {/* Bottom Drawer for Create Forms */}
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          position="bottom"
          size="90%"
          title={
            <div>
              <Title order={4}>Create New</Title>
              <Text size="sm" c="dimmed">
                Create a new meeting or post for the community
              </Text>
            </div>
          }
        >
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List grow>
              <Tabs.Tab value="meeting" leftSection={<Calendar size={16} />}>
                Meeting
              </Tabs.Tab>
              <Tabs.Tab value="post" leftSection={<FileText size={16} />}>
                Post
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="meeting" pt="md">
              <ScrollArea h="calc(90vh - 12rem)">
                <CreateMeetingForm onSuccess={closeDrawer} />
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="post" pt="md">
              <ScrollArea h="calc(90vh - 12rem)">
                <CreatePostForm onSuccess={closeDrawer} />
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Drawer>
      </Container>
    </Box>
  );
}
