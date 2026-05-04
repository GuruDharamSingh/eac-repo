"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  BookOpen,
  Plus,
  LogOut,
  Sparkles,
  MessageCircle,
  TrendingUp,
  Clock,
  FolderOpen,
  MapPin,
  Wifi,
} from "lucide-react";
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import type { Meeting, Post } from "@elkdonis/types";
import { usePresence } from "@elkdonis/hooks";
import { signOut } from "@elkdonis/auth-client";
import { supabase } from "@/lib/supabase";

interface HomeClientProps {
  upcomingMeetings: Array<{
    type: "meeting";
    data: Meeting;
    createdAt: Date;
  }>;
  recentPosts: Array<{
    type: "post";
    data: Post;
    createdAt: Date;
  }>;
}

export function HomeClient({ upcomingMeetings, recentPosts }: HomeClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>("overview");
  const [currentUser, setCurrentUser] = useState<{ userId: string; displayName?: string }>({
    userId: "",
  });

  // Get user info for presence tracking
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUser({
          userId: data.user.id,
          displayName: data.user.user_metadata?.display_name || data.user.email || undefined,
        });
      }
    });
  }, []);

  // Presence tracking
  const { onlineCount } = usePresence({
    client: supabase,
    channelName: "inner-gathering",
    user: currentUser,
    enabled: !!currentUser.userId,
  });

  const handleLogout = async () => {
    await signOut();

    // Redirect to OIDC provider logout to clear SSO session
    // Assumes OIDC provider is on port 3000 of the same host
    const oidcLogoutUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/auth/logout`;
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `${oidcLogoutUrl}?post_logout_redirect_uri=${returnTo}`;
  };

  const quickActions = [
    {
      title: "Make a Notice",
      description: "Post or meeting",
      icon: Plus,
      color: "ember",
      onClick: () => router.push("/feed?create=true"),
    },
    {
      title: "Read the Table",
      description: "Recent activity",
      icon: TrendingUp,
      color: "moss",
      onClick: () => router.push("/feed"),
    },
    {
      title: "Calendar",
      description: "Upcoming events",
      icon: Calendar,
      color: "archive",
      onClick: () => router.push("/calendar"),
    },
    {
      title: "Archive",
      description: "Files and media",
      icon: FolderOpen,
      color: "oxblood",
      onClick: () => router.push("/files"),
    },
  ];

  return (
    <Box className="archive-shell">
      {/* Header */}
      <Paper
        shadow="xs"
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
            <Group gap="sm">
              <ThemeIcon size="lg" radius="sm" className="archive-sigil">
                <Sparkles size={20} />
              </ThemeIcon>
              <div>
                <Title order={4} style={{ color: '#fdf0d0' }}>Inner Gathering</Title>
                <Text size="xs" style={{ color: '#d9b47a', fontStyle: 'italic' }}>Living archive and gathering table</Text>
              </div>
            </Group>
            <Button
              variant="subtle"
              size="sm"
              color="archive"
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
      <Container py="lg" pb={120}>
        {/* Welcome Section */}
        <Paper
          radius="sm"
          p="lg"
          mb="lg"
          className="archive-card-dark"
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text className="archive-kicker" style={{ color: '#f0c98a' }}>Today at the table</Text>
              <Title order={2} style={{ color: '#fff8ec' }}>Welcome back</Title>
              <Text size="sm" style={{ color: '#d9b47a' }}>
                {upcomingMeetings.length} upcoming meetings / {recentPosts.length} recent posts
              </Text>
            </div>
            {onlineCount > 0 && (
              <Badge
                variant="light"
                color="green"
                size="lg"
                leftSection={<Wifi size={14} />}
                style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white" }}
              >
                {onlineCount} online
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Quick Actions Grid */}
        <SimpleGrid cols={2} spacing="sm" mb="lg">
          {quickActions.map((action, index) => (
            <UnstyledButton key={index} onClick={action.onClick} style={{ width: "100%" }}>
              <Paper withBorder radius="sm" p="md" className="archive-tile" style={{ cursor: "pointer" }}>
                <ThemeIcon
                  size={48}
                  radius="sm"
                  variant="light"
                  color={action.color}
                  mb="sm"
                >
                  <action.icon size={24} />
                </ThemeIcon>
                <Text fw={600} size="sm">{action.title}</Text>
                <Text size="xs" c="dimmed">{action.description}</Text>
              </Paper>
            </UnstyledButton>
          ))}
        </SimpleGrid>

        {/* Content Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow mb="md">
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="activity">Recent Activity</Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Stack gap="md">
              {/* Upcoming Meetings */}
              <Paper withBorder radius="sm" p="md" className="archive-card">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="sm" variant="light" color="archive">
                      <Calendar size={14} />
                    </ThemeIcon>
                    <Title order={5}>Upcoming Meetings</Title>
                  </Group>
                  <Button variant="subtle" size="xs" color="archive" onClick={() => router.push("/feed")}>
                    View All
                  </Button>
                </Group>
                <Stack gap="sm">
                  {upcomingMeetings.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No upcoming meetings
                    </Text>
                  ) : (
                    upcomingMeetings.map((item) => {
                      const meeting = item.data as Meeting;
                      return (
                        <UnstyledButton
                          key={meeting.id}
                          onClick={() => router.push(`/meeting/${meeting.id}`)}
                          style={{ width: "100%" }}
                        >
                          <Paper className="archive-input-panel" radius="sm" p="sm">
                            <Group justify="space-between" mb={4}>
                              <Text fw={600} size="sm" style={{ flex: 1 }}>
                                {meeting.title}
                              </Text>
                              <Badge variant="light" size="sm">
                                {meeting.visibility}
                              </Badge>
                            </Group>
                            {meeting.start_time && (
                              <Group gap={4} mb={2}>
                                <Clock size={12} color="var(--mantine-color-gray-6)" />
                                <Text size="xs" c="dimmed">
                                  {new Date(meeting.start_time).toLocaleDateString()}
                                </Text>
                              </Group>
                            )}
                            {meeting.location && (
                              <Group gap={4}>
                                <MapPin size={12} color="var(--mantine-color-gray-6)" />
                                <Text size="xs" c="dimmed">{meeting.location}</Text>
                              </Group>
                            )}
                          </Paper>
                        </UnstyledButton>
                      );
                    })
                  )}
                </Stack>
              </Paper>

              {/* Recent Posts */}
              <Paper withBorder radius="sm" p="md" className="archive-card">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="sm" variant="light" color="moss">
                      <BookOpen size={14} />
                    </ThemeIcon>
                    <Title order={5}>Recent Posts</Title>
                  </Group>
                  <Button variant="subtle" size="xs" color="archive" onClick={() => router.push("/feed")}>
                    View All
                  </Button>
                </Group>
                <Stack gap="sm">
                  {recentPosts.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No recent posts
                    </Text>
                  ) : (
                    recentPosts.map((item) => {
                      const post = item.data as Post;
                      return (
                        <UnstyledButton
                          key={post.id}
                          onClick={() => router.push(`/post/${post.id}`)}
                          style={{ width: "100%" }}
                        >
                          <Paper className="archive-input-panel" radius="sm" p="sm">
                            <Group gap="sm" align="flex-start">
                              <Avatar radius="xl" size="md">
                                {post.author_name?.[0]?.toUpperCase() || "U"}
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Group justify="space-between" mb={2}>
                                  <Text fw={600} size="sm" truncate style={{ flex: 1 }}>
                                    {post.title}
                                  </Text>
                                  <Badge variant="light" size="sm">
                                    {post.visibility}
                                  </Badge>
                                </Group>
                                <Text size="xs" c="dimmed" mb={4}>
                                  by {post.author_name || "Anonymous"}
                                </Text>
                                {post.excerpt && (
                                  <Text size="sm" c="gray.7" lineClamp={2}>
                                    {post.excerpt}
                                  </Text>
                                )}
                              </div>
                            </Group>
                          </Paper>
                        </UnstyledButton>
                      );
                    })
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Activity Tab */}
          <Tabs.Panel value="activity">
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <Title order={5} mb={4}>Recent Activity</Title>
              <Text size="sm" c="dimmed" mb="md">
                Latest updates from your community
              </Text>
              <Stack gap="sm">
                {[...upcomingMeetings, ...recentPosts]
                  .sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .slice(0, 5)
                  .map((item, index, arr) => (
                    <Box key={index}>
                      <Group gap="sm" align="flex-start">
                        <Box
                          w={8}
                          h={8}
                          mt={6}
                          style={{
                            borderRadius: "50%",
                            backgroundColor: item.type === "meeting"
                              ? "var(--ig-gold)"
                              : "var(--ig-moss)",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <Text size="sm" fw={500}>
                            {item.type === "meeting"
                              ? (item.data as Meeting).title
                              : (item.data as Post).title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </div>
                        <Badge variant="outline" size="sm">
                          {item.type}
                        </Badge>
                      </Group>
                      {index < arr.length - 1 && <Divider my="sm" />}
                    </Box>
                  ))}
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Container>

      {/* Floating Action Button - positioned above bottom nav */}
      <ActionIcon
        size={56}
        radius="sm"
        variant="filled"
        color="ember"
        style={{
          position: "fixed",
          bottom: 96,
          right: 24,
          zIndex: 50,
          boxShadow: "0 10px 28px rgba(43, 20, 7, 0.28)",
          border: "2px solid #f0c98a",
        }}
        onClick={() => router.push("/feed?create=true")}
      >
        <Plus size={24} />
      </ActionIcon>
    </Box>
  );
}
