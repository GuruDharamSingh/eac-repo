import type { ReactNode } from "react";
import { getMeetings, getMeetingsByUser, getRSVPsByUser } from "@/lib/data";
import { AuthHeaderForm } from "@/components/auth-header-form";
import {
  Badge,
  Card,
  Container,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { BarChart3, Calendar, Users, UserCheck } from "lucide-react";

export default async function DashboardPage() {
  const currentUserId = "user-1";

  const [allMeetings, myMeetings, myRSVPs] = await Promise.all([
    getMeetings(),
    getMeetingsByUser(currentUserId),
    getRSVPsByUser(currentUserId),
  ]);

  const totalMeetings = allMeetings.length;
  const myMeetingsCount = myMeetings.length;
  const acceptedRSVPs = myRSVPs.filter(rsvp => rsvp.status === "yes").length;
  const now = new Date();
  const upcomingMeetings = allMeetings.filter(meeting => meeting.startTime > now).length;

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <BarChart3 size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={2}>Dashboard</Title>
              <Text size="sm" c="dimmed">
                Insights across meetings, RSVPs, and upcoming commitments.
              </Text>
            </Stack>
          </Group>
          <div className="w-full max-w-xs">
            <AuthHeaderForm />
          </div>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <SummaryCard
            icon={<Calendar size={16} />}
            label="Total meetings"
            value={totalMeetings}
            badgeColor="blue"
          />
          <SummaryCard
            icon={<UserCheck size={16} />}
            label="My meetings"
            value={myMeetingsCount}
            badgeColor="teal"
          />
          <SummaryCard
            icon={<Calendar size={16} />}
            label="Upcoming"
            value={upcomingMeetings}
            badgeColor="indigo"
          />
          <SummaryCard
            icon={<Users size={16} />}
            label="My RSVPs"
            value={acceptedRSVPs}
            badgeColor="violet"
          />
        </SimpleGrid>

        <Card withBorder radius="lg" padding="lg">
          <Stack gap="sm">
            <Group gap="sm">
              <ThemeIcon variant="light" color="green">
                <Users size={16} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Platform connectivity</Text>
                <Text size="sm" c="dimmed">
                  Systems powering your meeting workspace.
                </Text>
              </div>
            </Group>
            <List spacing="sm" size="sm">
              <List.Item>Prisma client connected</List.Item>
              <List.Item>PostgreSQL database</List.Item>
              <List.Item>@elkdonis/db workspace package</List.Item>
            </List>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  badgeColor: string;
}

function SummaryCard({ icon, label, value, badgeColor }: SummaryCardProps) {
  return (
    <Card withBorder padding="lg" radius="lg">
      <Stack gap="xs">
        <Badge
          color={badgeColor}
          leftSection={icon}
          variant="light"
          radius="sm"
          styles={{ root: { width: "fit-content" } }}
        >
          {label}
        </Badge>
        <Text fz={32} fw={600} lh={1.1}>
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

