"use client";

import { useState } from "react";
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
  MapPin,
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
import { signOut } from "@elkdonis/auth-client";

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

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const quickActions = [
    {
      title: "New Meeting",
      description: "Schedule a gathering",
      icon: Calendar,
      color: "blue",
      onClick: () => router.push("/feed?create=meeting"),
    },
    {
      title: "Create Post",
      description: "Share your thoughts",
      icon: MessageCircle,
      color: "grape",
      onClick: () => router.push("/feed?create=post"),
    },
    {
      title: "View Feed",
      description: "See all activity",
      icon: TrendingUp,
      color: "green",
      onClick: () => router.push("/feed"),
    },
    {
      title: "Community",
      description: "Connect with others",
      icon: Users,
      color: "orange",
      onClick: () => router.push("/community"),
    },
  ];

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
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                <Sparkles size={20} />
              </ThemeIcon>
              <div>
                <Title order={4}>InnerGathering</Title>
                <Text size="xs" c="dimmed">Connect & Grow Together</Text>
              </div>
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
      <Container py="lg" pb={120}>
        {/* Welcome Section */}
        <Paper
          radius="lg"
          p="lg"
          mb="lg"
          style={{
            background: "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-grape-6))",
          }}
        >
          <Title order={2} c="white">Welcome Back!</Title>
          <Text c="indigo.1" size="sm">
            {upcomingMeetings.length} upcoming meetings • {recentPosts.length} new posts
          </Text>
        </Paper>

        {/* Quick Actions Grid */}
        <SimpleGrid cols={2} spacing="sm" mb="lg">
          {quickActions.map((action, index) => (
            <UnstyledButton key={index} onClick={action.onClick} style={{ width: "100%" }}>
              <Paper withBorder radius="md" p="md" style={{ cursor: "pointer" }}>
                <ThemeIcon
                  size={48}
                  radius="md"
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
              <Paper withBorder radius="lg" p="md">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                      <Calendar size={14} />
                    </ThemeIcon>
                    <Title order={5}>Upcoming Meetings</Title>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={() => router.push("/feed")}>
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
                          <Paper bg="gray.0" radius="md" p="sm">
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
              <Paper withBorder radius="lg" p="md">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="md" variant="light" color="grape">
                      <BookOpen size={14} />
                    </ThemeIcon>
                    <Title order={5}>Recent Posts</Title>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={() => router.push("/feed")}>
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
                          <Paper bg="gray.0" radius="md" p="sm">
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
            <Paper withBorder radius="lg" p="md">
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
                              ? "var(--mantine-color-blue-6)"
                              : "var(--mantine-color-grape-6)",
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
        radius="xl"
        variant="filled"
        color="indigo"
        style={{
          position: "fixed",
          bottom: 96,
          right: 24,
          zIndex: 50,
          boxShadow: "var(--mantine-shadow-lg)",
        }}
        onClick={() => router.push("/feed?create=true")}
      >
        <Plus size={24} />
      </ActionIcon>
    </Box>
  );
}
