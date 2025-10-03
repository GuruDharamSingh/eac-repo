import { Plus } from "lucide-react";
import { Container, Group, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";

import { NewMeetingForm } from "./new-meeting-form";
import { getOrganizations } from "@/lib/data";

export default async function NewMeetingPage() {
  const organizations = await getOrganizations();

  return (
    <Container size="sm" py="xl">
      <Paper withBorder radius="lg" p="xl">
        <Stack gap="xl">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <Plus size={18} />
            </ThemeIcon>
            <div>
              <Title order={2}>New meeting</Title>
              <Text size="sm" c="dimmed">
                Craft the agenda, logistics, and automations for your next gathering.
              </Text>
            </div>
          </Group>

          <NewMeetingForm organizations={organizations} />
        </Stack>
      </Paper>
    </Container>
  );
}

