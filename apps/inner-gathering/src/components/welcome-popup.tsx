"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActionIcon, Modal, Stack, Text, Group, Paper, Button, Box } from "@mantine/core";
import { Menu, Plus, Sparkles, Users, CloudUpload, MessageCircle } from "lucide-react";

const STEPS = 3;

export function WelcomePopup() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (pathname === "/feed" && searchParams.get("welcome") === "1") {
      setOpened(true);
      setStep(0);
    } else {
      setOpened(false);
    }
  }, [pathname, searchParams]);

  const handleClose = () => {
    setOpened(false);
    router.replace("/feed");
  };

  const next = () => {
    if (step < STEPS - 1) setStep((s) => s + 1);
    else handleClose();
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
            {step === 0
              ? "You're in."
              : step === 1
                ? "Your storage, your library."
                : "An example space."}
          </Text>
        </Group>
      }
    >
      <Stack gap="md">
        {step === 0 && <StepFeed />}
        {step === 1 && <StepNextcloud />}
        {step === 2 && <StepExample />}

        <Group justify="center" gap={6} mt="xs">
          {Array.from({ length: STEPS }).map((_, i) => (
            <Box
              key={i}
              w={i === step ? 18 : 8}
              h={6}
              style={{
                borderRadius: 4,
                background: i === step ? "#d45c08" : "#e8c595",
                transition: "all 0.2s",
              }}
            />
          ))}
        </Group>

        <Group justify="space-between">
          {step > 0 ? (
            <Button variant="subtle" color="ember" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button color="ember" onClick={next} size="md">
            {step < STEPS - 1 ? "Next" : "Take a look around"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function StepFeed() {
  return (
    <Stack gap="md">
      <Text style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.6, color: "#3d2412" }}>
        This is the <strong>feed</strong> — the heart of Inner Gathering. Members share posts
        here and <strong>meetings</strong> get organized in this early stage of the collective.
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
    </Stack>
  );
}

function StepNextcloud() {
  return (
    <Stack gap="md">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <CloudUpload size={36} color="#d45c08" style={{ flexShrink: 0, marginTop: 4 }} />
        <Stack gap={4}>
          <Text fw={600} c="#3d1f04" style={{ fontFamily: "'Cinzel', serif" }}>
            Nextcloud — your collective storage
          </Text>
          <Text size="sm" c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.6 }}>
            We&apos;ve provisioned you a private Nextcloud account on the same login. Upload photos,
            recordings, drafts — they live in <em>your</em> folder, and you choose what to share
            into the feed.
          </Text>
        </Stack>
      </Group>

      <Paper withBorder p="md" radius="sm" style={{ borderColor: "#e8c595", background: "#fff8f0" }}>
        <Text size="sm" fw={600} c="#3d1f04" mb={6}>
          You&apos;re an early member
        </Text>
        <Text size="sm" c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.6 }}>
          Things will move, break, and change as we build toward summer 2026. Your account, posts,
          and uploads will travel forward with you. Tell us when something feels off — your
          feedback at this stage shapes what the collective becomes.
        </Text>
      </Paper>
    </Stack>
  );
}

function StepExample() {
  return (
    <Stack gap="md">
      <Group gap="md" align="flex-start" wrap="nowrap">
        <Users size={36} color="#d45c08" style={{ flexShrink: 0, marginTop: 4 }} />
        <Stack gap={4}>
          <Text fw={600} c="#3d1f04" style={{ fontFamily: "'Cinzel', serif" }}>
            An example space
          </Text>
          <Text size="sm" c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.6 }}>
            Right now you&apos;re in the <strong>Inner Gathering</strong> — our prototype community
            space. Browse the feed, read what other members have posted, and try replying. Every
            post and meeting has a comment thread, and a few have live Talk rooms.
          </Text>
        </Stack>
      </Group>

      <Paper withBorder p="md" radius="sm" style={{ borderColor: "#e8c595", background: "#fff8f0" }}>
        <Group gap="xs" wrap="nowrap">
          <MessageCircle size={20} color="#6a4520" style={{ flexShrink: 0 }} />
          <Text size="sm" c="#6a4520" fs="italic" style={{ fontFamily: "'Crimson Text', serif" }}>
            Future groups (workshops, study circles, regional gatherings) will spin up from this
            same pattern.
          </Text>
        </Group>
      </Paper>
    </Stack>
  );
}
