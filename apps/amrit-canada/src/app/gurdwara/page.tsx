import { Container, Stack, Title, Text, Paper, Group, Badge, Divider } from '@mantine/core';
import { IconCalendar, IconMapPin, IconClock } from '@tabler/icons-react';
import { format } from 'date-fns';
import { getMeetingsBySection } from '@/lib/data';
import { RsvpForm } from '@elkdonis/ui';

export const metadata = {
  title: 'Gurdwara & Langar | Amrit Vela Toronto',
};

export default async function GurdwaraPage() {
  const meetings = await getMeetingsBySection('gurdwara');

  return (
    <div style={{ background: 'linear-gradient(180deg, var(--gurdwara-crimson-dim, rgba(139,46,46,0.08)) 0%, transparent 300px)' }}>
      {/* Section header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e0a0a 0%, #3a1212 100%)',
          borderBottom: '4px solid var(--gurdwara-crimson, #8B2E2E)',
          padding: '3rem 0 2.5rem',
          textAlign: 'center',
        }}
      >
        <Container size="lg">
          <Badge
            size="lg"
            style={{
              background: 'rgba(139,46,46,0.25)',
              color: 'var(--gurdwara-crimson, #8B2E2E)',
              border: '1px solid rgba(139,46,46,0.5)',
              fontFamily: "'Lora', serif",
              marginBottom: '1rem',
            }}
          >
            Sangat & Langar
          </Badge>
          <Title
            order={1}
            style={{
              color: '#e89898',
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
              marginBottom: '0.75rem',
            }}
          >
            Gurdwara & Langar
          </Title>
          <Text
            style={{
              color: 'rgba(232,152,152,0.8)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              fontFamily: "'Lora', serif",
            }}
          >
            at Guru Ram Das Ashram
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
                background: 'rgba(139,46,46,0.04)',
                border: '1px solid rgba(139,46,46,0.15)',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <Text c="dimmed" style={{ fontStyle: 'italic' }}>
                No upcoming Gurdwara gatherings scheduled yet. Check back soon.
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
                      background: 'linear-gradient(135deg, #fdf0f0 0%, #f7e8e8 100%)',
                      border: '1px solid rgba(139,46,46,0.2)',
                      borderRadius: '20px',
                      boxShadow: '0 4px 24px rgba(139,46,46,0.10)',
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
                            <IconCalendar size={18} color="var(--gurdwara-crimson, #8B2E2E)" />
                            <Text size="sm" c="dark.6">{format(date, 'EEEE, MMMM d, yyyy')}</Text>
                          </Group>
                        )}
                        {date && (
                          <Group gap="sm">
                            <IconClock size={18} color="var(--gurdwara-crimson, #8B2E2E)" />
                            <Text size="sm" c="dark.6">
                              {format(date, 'h:mm a')}
                              {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ''}
                            </Text>
                          </Group>
                        )}
                        {meeting.location && (
                          <Group gap="sm">
                            <IconMapPin size={18} color="var(--gurdwara-crimson, #8B2E2E)" />
                            <Text size="sm" c="dark.6">{meeting.location}</Text>
                          </Group>
                        )}
                      </Stack>

                      {meeting.description && (
                        <>
                          <Divider color="rgba(139,46,46,0.15)" />
                          <Text size="md" c="dark.6" style={{ lineHeight: 1.8 }}>
                            {meeting.description}
                          </Text>
                        </>
                      )}

                      <Divider color="rgba(139,46,46,0.12)" />

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

          <hr style={{ height: '3px', background: 'linear-gradient(90deg, transparent, var(--gurdwara-crimson, #8B2E2E), transparent)', border: 'none', margin: '1rem 0' }} />

          {/* About section */}
          <Paper
            p="xl"
            style={{
              background: 'linear-gradient(135deg, #fdf0f0 0%, #f7e8e8 100%)',
              border: '1px solid rgba(139,46,46,0.2)',
              borderRadius: '20px',
            }}
          >
            <Stack gap="md">
              <Title order={2} style={{ fontFamily: "'Cinzel', serif", color: 'var(--charcoal)', fontSize: '1.6rem', fontWeight: 700 }}>
                About the Gurdwara
              </Title>
              <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
                The <strong style={{ color: 'var(--gurdwara-crimson, #8B2E2E)' }}>Guru Ram Das Ashram</strong> hosts
                regular Gurdwara gatherings — a sacred space for prayer (Simran), scripture reading (Gurbani),
                and communal sharing. All are welcome regardless of background or tradition.
              </Text>
              <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
                <strong>Langar</strong> — the free communal meal — is served after the service, embodying the
                Sikh principle of equality: all sit together and eat together, regardless of status or faith.
              </Text>
              <blockquote className="amrit-quote" style={{ borderLeftColor: 'var(--gurdwara-crimson, #8B2E2E)', background: 'linear-gradient(90deg, rgba(139,46,46,0.08) 0%, transparent 100%)' }}>
                "The Gurdwara is the doorway to the Guru — come as you are, leave transformed."
              </blockquote>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </div>
  );
}
