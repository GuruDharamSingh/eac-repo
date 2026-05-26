"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Newspaper, Calendar, BarChart3, Menu, X, User, Bell, FolderOpen, Video, Palette } from "lucide-react";
import {
  ActionIcon,
  Badge,
  Box,
  Drawer,
  Group,
  Indicator,
  NavLink,
  Stack,
  Title,
  Divider,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRealtimeNotifications } from "@elkdonis/hooks";
import { supabase } from "@/lib/supabase";

interface NavItem {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    icon: Home,
    label: "Home",
    href: "/home",
    match: (pathname) => pathname === "/home",
  },
  {
    icon: Newspaper,
    label: "Feed",
    href: "/feed",
    match: (pathname) => pathname.startsWith("/feed"),
  },
  {
    icon: BarChart3,
    label: "Polls",
    href: "/polls",
    match: (pathname) => pathname.startsWith("/polls"),
  },
  {
    icon: Calendar,
    label: "Calendar",
    href: "/calendar",
    match: (pathname) => pathname.startsWith("/calendar"),
  },
  {
    icon: FolderOpen,
    label: "Archive",
    href: "/files",
    match: (pathname) => pathname.startsWith("/files"),
  },
  {
    icon: Video,
    label: "Live",
    href: "/live",
    match: (pathname) => pathname.startsWith("/live"),
  },
];

const profileItem: NavItem = {
  icon: Palette,
  label: "My Profile",
  href: "/profile",
  match: (pathname) => pathname.startsWith("/profile"),
};

const accountItem: NavItem = {
  icon: User,
  label: "Account",
  href: "/account",
  match: (pathname) => pathname.startsWith("/account"),
};

export function TopNav() {
  const [opened, { open, close }] = useDisclosure(false);
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");

  // Get the current user ID for notification subscription
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // Fetch initial unread count
  const [initialCount, setInitialCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    fetch("/api/notifications/unread-count")
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data) => setInitialCount(data.count || 0))
      .catch(() => {});
  }, [userId]);

  // Realtime notifications
  const { unreadCount, initializeUnreadCount } = useRealtimeNotifications({
    client: supabase,
    userId,
    enabled: !!userId,
  });

  // Set initial unread count when fetched
  useEffect(() => {
    if (initialCount > 0) {
      initializeUnreadCount(initialCount);
    }
  }, [initialCount, initializeUnreadCount]);

  const totalUnread = unreadCount;

  const handleNavigate = (href: string) => {
    router.push(href);
    close();
  };

  return (
    <>
      {/* Menu Button - Bottom Left */}
      <Indicator
        inline
        label={totalUnread > 0 ? (totalUnread > 99 ? "99+" : totalUnread) : undefined}
        size={totalUnread > 0 ? 18 : 0}
        offset={4}
        position="top-end"
        color="red"
        disabled={totalUnread === 0}
      >
        <ActionIcon
          size={56}
          radius="sm"
          variant="filled"
          color="eacSky"
          onClick={opened ? close : open}
          aria-label="Menu"
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            zIndex: 50,
            boxShadow: "0 10px 28px rgba(1, 18, 78, 0.28)",
            border: "2px solid #b79a55",
          }}
        >
          {opened ? <X size={24} /> : <Menu size={24} />}
        </ActionIcon>
      </Indicator>

      {/* Sidebar Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size={320}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        styles={{
          content: {
            background: "linear-gradient(180deg, #fffdf8 0%, #f3eadc 100%)",
            borderRight: "3px double var(--ig-gold)",
          },
          body: { padding: 0 },
        }}
      >
        <Stack gap="lg" p="md">
          <div>
            <Text className="archive-kicker">Gathering table</Text>
            <Title order={3} className="archive-title">Inner Gathering</Title>
          </div>
          <Stack gap="xs">
            {navItems.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.href}
                  onClick={() => handleNavigate(item.href)}
                  label={item.label}
                  leftSection={<Icon size={20} />}
                  active={isActive}
                  variant="light"
                  color="archive"
                  style={{ borderRadius: 4 }}
                />
              );
            })}
          </Stack>
          <Divider />
          <Stack gap="xs">
            {/* Notifications */}
            <NavLink
              onClick={() => handleNavigate("/notifications")}
              label={
                <Group gap="xs">
                  <span>Notifications</span>
                  {totalUnread > 0 && (
                    <Badge size="sm" color="red" variant="filled" circle>
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </Badge>
                  )}
                </Group>
              }
              leftSection={<Bell size={20} />}
              active={pathname.startsWith("/notifications")}
              variant="light"
              color="archive"
              style={{ borderRadius: 4 }}
            />
            <NavLink
              onClick={() => handleNavigate(profileItem.href)}
              label={profileItem.label}
              leftSection={<profileItem.icon size={20} />}
              active={profileItem.match(pathname)}
              variant="light"
              color="archive"
              style={{ borderRadius: 4 }}
            />
            <NavLink
              onClick={() => handleNavigate(accountItem.href)}
              label={accountItem.label}
              leftSection={<accountItem.icon size={20} />}
              active={accountItem.match(pathname)}
              variant="light"
              color="archive"
              style={{ borderRadius: 4 }}
            />
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
