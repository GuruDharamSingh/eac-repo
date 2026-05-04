"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Modal, Stack, Text, Group, Paper, Button } from "@mantine/core";
import { Menu, Plus, Sparkles, Users } from "lucide-react";

export function WelcomePopup() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (pathname === "/feed" && searchParams.get("welcome") === "1") {
      setOpened(true);
    } else {
      setOpened(false);
    }
  }, [pathname, searchParams]);

  const handleClose = () => {
    setOpened(false);
    router.replace("/feed");
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="md"
      withCloseButton
      radius="md"
      title={
        <Group gap="xs">
          <Sparkles size={20} color="#d45c08" />
          <Text fw={700} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
            You're in.
          </Text>
        </Group>
      }
    >
      <Stack gap="md">
        <Text style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.6, color: "#3d2412" }}>
          This is the <strong>feed</strong> — the heart of Inner Gathering. It's where members
          share posts and where <strong>meetings</strong> get organized in this early stage of the
          collective.
        </Text>

        <Paper withBorder p="md" radius="sm" style={{ borderColor: "#e8c595", background: "#fff8f0" }}>
          <Stack gap="sm">
            <Text size="sm" fw={600} c="#3d1f04">Two buttons to know:</Text>
            <Group gap="md" align="flex-start" wrap="nowrap">
              <ActionIcon
                size={44}
                radius="sm"
                color="ember"
                variant="filled"
                aria-label="Menu"
                style={{
                  flexShrink: 0,
                  boxShadow: "0 10px 28px rgba(43, 20, 7, 0.22)",
                  border: "2px solid #f0c98a",
                  pointerEvents: "none",
                }}
              >
                <Menu size={22} />
              </ActionIcon>
              <Text size="sm" c="#3d2412" style={{ fontFamily: "'Crimson Text', serif" }}>
                Opens navigation — your account, calendar, polls, files, and more.
              </Text>
            </Group>
            <Group gap="md" align="flex-start" wrap="nowrap">
              <ActionIcon
                size={44}
                radius="sm"
                color="ember"
                variant="filled"
                aria-label="Add post"
                style={{
                  flexShrink: 0,
                  boxShadow: "0 4px 20px rgba(180, 80, 10, 0.32)",
                  border: "2px solid #f0a040",
                  pointerEvents: "none",
                }}
              >
                <Plus size={22} />
              </ActionIcon>
              <Text size="sm" c="#3d2412" style={{ fontFamily: "'Crimson Text', serif" }}>
                Share a post or host a meeting that other members can RSVP to.
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Group gap="xs" wrap="nowrap">
          <Users size={18} color="#6a4520" style={{ flexShrink: 0 }} />
          <Text size="sm" c="#6a4520" fs="italic" style={{ fontFamily: "'Crimson Text', serif" }}>
            Welcome to the collective. You'll find your bearings as we build.
          </Text>
        </Group>

        <Button color="ember" onClick={handleClose} size="md" fullWidth>
          Take a look around
        </Button>
      </Stack>
    </Modal>
  );
}
