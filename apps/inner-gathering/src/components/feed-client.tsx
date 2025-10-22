"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Stack,
  Title,
  Text,
  ActionIcon,
  Drawer,
  Tabs,
  Group,
  Box,
  AppShell,
  Burger,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Plus, LogOut, Sparkles } from "lucide-react";
import type { Meeting, Post } from "@elkdonis/types";
import { MeetingCard } from "./meeting-card";
import { PostCard } from "./post-card";
import { CreateMeetingForm } from "./create-meeting-form";
import { CreatePostForm } from "./create-post-form";
import { supabase } from "@/lib/supabase";

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
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [activeTab, setActiveTab] = useState<string | null>("meeting");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 0,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Sparkles size={24} color="indigo" />
            <Title order={3} size="h4">
              InnerGathering
            </Title>
          </Group>
          <Button
            variant="subtle"
            leftSection={<LogOut size={16} />}
            onClick={handleLogout}
            size="sm"
          >
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm" px="xs">
          <Stack gap="md" pb={80}>
            <Group justify="space-between" align="center">
              <div>
                <Title order={2}>Feed</Title>
                <Text size="sm" c="dimmed">
                  Upcoming meetings and community posts
                </Text>
              </div>
            </Group>

            {initialFeed.length === 0 ? (
              <Text ta="center" c="dimmed" py="xl">
                No posts or meetings yet. Create one to get started!
              </Text>
            ) : (
              initialFeed.map((item, index) =>
                item.type === "meeting" ? (
                  <MeetingCard key={`meeting-${item.data.id}-${index}`} meeting={item.data as Meeting} />
                ) : (
                  <PostCard key={`post-${item.data.id}-${index}`} post={item.data as Post} />
                )
              )
            )}
          </Stack>

          {/* Floating Action Button */}
          <Box
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              zIndex: 100,
            }}
          >
            <ActionIcon
              size={60}
              radius="xl"
              variant="filled"
              color="indigo"
              onClick={openDrawer}
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            >
              <Plus size={28} />
            </ActionIcon>
          </Box>

          {/* Create Content Drawer */}
          <Drawer
            opened={drawerOpened}
            onClose={closeDrawer}
            title="Create New"
            position="bottom"
            size="90%"
            styles={{
              content: {
                borderTopLeftRadius: "24px",
                borderTopRightRadius: "24px",
              },
            }}
          >
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List grow>
                <Tabs.Tab value="meeting">Meeting</Tabs.Tab>
                <Tabs.Tab value="post">Post</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="meeting" pt="md">
                <CreateMeetingForm onSuccess={closeDrawer} />
              </Tabs.Panel>

              <Tabs.Panel value="post" pt="md">
                <CreatePostForm onSuccess={closeDrawer} />
              </Tabs.Panel>
            </Tabs>
          </Drawer>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
