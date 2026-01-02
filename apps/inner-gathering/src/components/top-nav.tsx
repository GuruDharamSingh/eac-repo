"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Newspaper, Calendar, BarChart3, Menu, X, User } from "lucide-react";
import {
  ActionIcon,
  Box,
  Drawer,
  NavLink,
  Overlay,
  Stack,
  Title,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

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
    icon: Calendar,
    label: "Polls",
    href: "/polls",
    match: (pathname) => pathname.startsWith("/polls"),
  },
  {
    icon: BarChart3,
    label: "Calendar",
    href: "/calendar",
    match: (pathname) => pathname.startsWith("/calendar"),
  },
];

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

  const handleNavigate = (href: string) => {
    router.push(href);
    close();
  };

  return (
    <>
      {/* Menu Button - Bottom Left */}
      <ActionIcon
        size={56}
        radius="xl"
        variant="filled"
        color="indigo"
        onClick={opened ? close : open}
        aria-label="Menu"
        style={{
          position: "fixed",
          bottom: 24,
          left: 24,
          zIndex: 50,
          boxShadow: "var(--mantine-shadow-lg)",
        }}
      >
        {opened ? <X size={24} /> : <Menu size={24} />}
      </ActionIcon>

      {/* Sidebar Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size={320}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      >
        <Stack gap="lg" p="md">
          <Title order={3} c="indigo">InnerGathering</Title>
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
                  color="indigo"
                  style={{ borderRadius: 8 }}
                />
              );
            })}
          </Stack>
          <Divider />
          <Stack gap="xs">
            <NavLink
              onClick={() => handleNavigate(accountItem.href)}
              label={accountItem.label}
              leftSection={<accountItem.icon size={20} />}
              active={accountItem.match(pathname)}
              variant="light"
              color="indigo"
              style={{ borderRadius: 8 }}
            />
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
