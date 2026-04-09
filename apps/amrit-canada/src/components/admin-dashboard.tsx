'use client';

import { Container, Stack, Title, Text, Paper, Divider } from '@mantine/core';
import { AdminMeetingForm } from './admin-meeting-form';
import { MeetingListItem } from './meeting-list-item';
import { Meeting } from './types';

interface AdminDashboardProps {
  userEmail: string;
  meetings: Meeting[];
}

export function AdminDashboard({ userEmail, meetings }: AdminDashboardProps) {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1} style={{ fontFamily: "'Cinzel', serif", color: '#36454f' }}>
            Admin
          </Title>
          <Text c="dimmed" size="sm">
            Signed in as {userEmail}
          </Text>
        </Stack>

        <hr className="saffron-divider" />

        {/* Schedule new session */}
        <Paper
          p="xl"
          style={{
            background: 'linear-gradient(135deg, #fffde7 0%, #fdf5e6 100%)',
            border: '1px solid rgba(244,196,48,0.4)',
          }}
        >
          <Stack gap="md">
            <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: '#36454f', fontSize: '1.1rem' }}>
              Schedule a Sadhana Session
            </Title>
            <AdminMeetingForm />
          </Stack>
        </Paper>

        <Divider color="rgba(244,196,48,0.3)" />

        {/* Existing sessions */}
        <Stack gap="md">
          <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: '#36454f', fontSize: '1.1rem' }}>
            Upcoming Sessions
          </Title>
          {meetings.length === 0 ? (
            <Text c="dimmed" size="sm" style={{ fontStyle: 'italic' }}>
              No sessions scheduled yet.
            </Text>
          ) : (
            meetings.map((m) => <MeetingListItem key={m.id} meeting={m} />)
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
