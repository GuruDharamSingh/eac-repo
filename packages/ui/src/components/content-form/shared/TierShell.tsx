"use client";

import { Collapse, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import type { TierName } from "../types";

interface TierShellProps {
  tier: TierName;
  title: string;
  hint: string;
  preview?: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: ReactNode;
}

export function TierShell({
  title,
  hint,
  preview,
  defaultOpen = false,
  accentColor = "var(--mantine-color-gray-4)",
  children,
}: TierShellProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Paper withBorder radius="md" p={0} style={{ borderLeft: `3px solid ${accentColor}` }}>
      <UnstyledButton onClick={() => setOpen((v) => !v)} w="100%" p="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <Stack gap={2}>
              <Text fw={600}>{title}</Text>
              {!open && preview ? (
                <Text size="xs" c="dimmed">
                  {preview}
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  {hint}
                </Text>
              )}
            </Stack>
          </Group>
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack p="md" pt={0} gap="md">
          {children}
        </Stack>
      </Collapse>
    </Paper>
  );
}
