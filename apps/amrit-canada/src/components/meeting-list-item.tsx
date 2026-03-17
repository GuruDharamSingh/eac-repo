import { Paper, Title, Text, Badge, Group, Stack, Anchor } from '@mantine/core';
import { IconCalendar, IconMapPin } from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Meeting } from './types';

interface MeetingListItemProps {
  meeting: Meeting;
}

export function MeetingListItem({ meeting }: MeetingListItemProps) {
  const date = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;

  return (
    <Anchor component={Link} href={`/meetings/${meeting.id}`} underline="never">
      <Paper
        p="lg"
        className="sadhana-card"
        style={{
          background: 'linear-gradient(135deg, #fffde7 0%, #fdf5e6 100%)',
          border: '1px solid rgba(244, 196, 48, 0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Title
              order={4}
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#36454f',
                fontSize: '1rem',
              }}
            >
              {meeting.title}
            </Title>

            <Group gap="lg">
              {date && (
                <Group gap="xs">
                  <IconCalendar size={15} color="#e6b422" />
                  <Text size="sm" c="dark.5">
                    {format(date, 'MMM d, yyyy · h:mm a')}
                  </Text>
                </Group>
              )}

              {meeting.location && (
                <Group gap="xs">
                  <IconMapPin size={15} color="#e6b422" />
                  <Text size="sm" c="dark.5">
                    {meeting.location}
                  </Text>
                </Group>
              )}
            </Group>

            {meeting.description && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {meeting.description}
              </Text>
            )}
          </Stack>

          <Badge
            size="sm"
            style={{
              background: 'rgba(244, 196, 48, 0.2)',
              color: '#8d6708',
              border: '1px solid rgba(244, 196, 48, 0.4)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Sadhana
          </Badge>
        </Group>
      </Paper>
    </Anchor>
  );
}
