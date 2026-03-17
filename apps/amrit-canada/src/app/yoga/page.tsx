import { Container, Stack, Title, Text, Paper, Group, Badge, Divider } from '@mantine/core';
import { IconCalendar, IconMapPin, IconClock } from '@tabler/icons-react';
import { format } from 'date-fns';
import { getMeetingsBySection } from '@/lib/data';
import { RsvpForm } from '@elkdonis/ui';

export const metadata = {
  title: 'Yoga Classes | Amrit Vela Toronto',
};

export default async function YogaPage() {
  const meetings = await getMeetingsBySection('yoga');

  return (
    <div style={{ background: 'linear-gradient(180deg, var(--yoga-green-dim, rgba(90,138,106,0.08)) 0%, transparent 300px)' }}>
      {/* Section header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a2e1f 0%, #2d4a35 100%)',
          borderBottom: '4px solid var(--yoga-green, #5a8a6a)',
          padding: '3rem 0 2.5rem',
          textAlign: 'center',
        }}
      >
        <Container size="lg">
          <Badge
            size="lg"
            style={{
              background: 'rgba(90,138,106,0.25)',
              color: 'var(--yoga-green, #5a8a6a)',
              border: '1px solid rgba(90,138,106,0.5)',
              fontFamily: "'Lora', serif",
              marginBottom: '1rem',
            }}
          >
            Kundalini Yoga
          </Badge>
          <Title
            order={1}
            style={{
              color: 'var(--yoga-green, #5a8a6a)',
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              textShadow: '2px 2px 8px rgba(0,0,0,0.4)',
              marginBottom: '0.75rem',
            }}
          >
            Yoga Classes
          </Title>
          <Text
            style={{
              color: 'rgba(90,138,106,0.85)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              fontFamily: "'Lora', serif",
            }}
          >
            with Guru Dharam Singh
          </Text>
        </Container>
      </div>

      <Container size="lg" py="xl">
        <Stack gap="3rem">
          {/* Meeting feed */}
          {meetings.length === 0 ? (
            <Paper
              p="xl"
              style={{
                background: 'rgba(90,138,106,0.06)',
                border: '1px solid rgba(90,138,106,0.2)',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <Text c="dimmed" style={{ fontStyle: 'italic' }}>
                No upcoming yoga classes scheduled yet. Check back soon.
              </Text>
            </Paper>
          ) : (
            <Stack gap="xl">
              {meetings.map((meeting) => {
                const date = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;
                return (
                  <Paper
                    key={meeting.id}
                    p="xl"
                    style={{
                      background: 'linear-gradient(135deg, #f0f7f2 0%, #e8f4ec 100%)',
                      border: '1px solid rgba(90,138,106,0.3)',
                      borderRadius: '20px',
                      boxShadow: '0 4px 24px rgba(90,138,106,0.12)',
                    }}
                  >
                    <Stack gap="lg">
                      <Title
                        order={2}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          color: 'var(--charcoal)',
                          fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
                        }}
                      >
                        {meeting.title}
                      </Title>

                      <Stack gap="xs">
                        {date && (
                          <Group gap="sm">
                            <IconCalendar size={18} color="var(--yoga-green, #5a8a6a)" />
                            <Text size="sm" c="dark.6">{format(date, 'EEEE, MMMM d, yyyy')}</Text>
                          </Group>
                        )}
                        {date && (
                          <Group gap="sm">
                            <IconClock size={18} color="var(--yoga-green, #5a8a6a)" />
                            <Text size="sm" c="dark.6">
                              {format(date, 'h:mm a')}
                              {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ''}
                            </Text>
                          </Group>
                        )}
                        {meeting.location && (
                          <Group gap="sm">
                            <IconMapPin size={18} color="var(--yoga-green, #5a8a6a)" />
                            <Text size="sm" c="dark.6">{meeting.location}</Text>
                          </Group>
                        )}
                      </Stack>

                      {meeting.description && (
                        <>
                          <Divider color="rgba(90,138,106,0.2)" />
                          <Text size="md" c="dark.6" style={{ lineHeight: 1.8 }}>
                            {meeting.description}
                          </Text>
                        </>
                      )}

                      <Divider color="rgba(90,138,106,0.15)" />

                      <RsvpForm
                        meetingId={meeting.id}
                        meetingTitle={meeting.title}
                        apiPath="/api/rsvp"
                      />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          <hr style={{ height: '3px', background: 'linear-gradient(90deg, transparent, var(--yoga-green, #5a8a6a), transparent)', border: 'none', margin: '1rem 0' }} />

          {/* About section */}
          <Paper
            p="xl"
            style={{
              background: 'linear-gradient(135deg, #f0f7f2 0%, #e8f4ec 100%)',
              border: '1px solid rgba(90,138,106,0.25)',
              borderRadius: '20px',
            }}
          >
            <Stack gap="md">
              <Title order={2} style={{ fontFamily: "'Cinzel', serif", color: 'var(--charcoal)', fontSize: '1.6rem', fontWeight: 700 }}>
                About the Classes
              </Title>
              <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
                <strong style={{ color: 'var(--yoga-green, #5a8a6a)' }}>Guru Dharam Singh</strong> leads Kundalini Yoga classes
                as part of the Amrit Canada community. These classes weave together breath, movement, mantra, and
                meditation in the tradition of Yogi Bhajan.
              </Text>
              <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
                Whether you are new to yoga or have practiced for years, these classes offer a powerful technology
                for elevating consciousness, strengthening the nervous system, and opening the heart.
              </Text>
              <blockquote className="amrit-quote">
                "Kundalini Yoga is the yoga of awareness. It works on the total being — body, mind, and soul."
              </blockquote>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </div>
  );
}
