import { Container, Stack, Title, Text, Paper, Group, Badge, Divider, Button, SimpleGrid, ThemeIcon } from '@mantine/core';
import { IconCalendar, IconMapPin, IconClock, IconFileText, IconMusic, IconDownload } from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getMeetingsBySection } from '@/lib/data';
import { RsvpForm } from '@elkdonis/ui';

export const metadata = {
  title: 'Amrit Vela Sadhana | Amrit Vela Toronto',
};

const aquarianSteps = [
  'Japji Sahib – 20 min',
  'Kundalini Yoga Kriya – 30 min',
  'Savasana – 5 min',
  'Long Chant (Ong Namo) – 7 min',
  'Seven Aquarian Sadhana Chants – 62 min',
  'Long Time Sun – 3 min',
];

export default async function SadhanaPage() {
  const meetings = await getMeetingsBySection('amrit_vela');

  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(244,196,48,0.08) 0%, transparent 300px)' }}>
      {/* Section header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)',
          borderBottom: '4px solid var(--saffron-bright)',
          padding: '3rem 0 2.5rem',
          textAlign: 'center',
        }}
      >
        <Container size="lg">
          <Badge
            size="lg"
            style={{
              background: 'rgba(244,196,48,0.2)',
              color: 'var(--saffron-bright)',
              border: '1px solid rgba(244,196,48,0.4)',
              fontFamily: "'Lora', serif",
              marginBottom: '1rem',
            }}
          >
            4:00 AM · 2.5 Hours
          </Badge>
          <Title
            order={1}
            style={{
              color: 'var(--saffron-bright)',
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              textShadow: '2px 2px 8px rgba(0,0,0,0.4)',
              marginBottom: '0.75rem',
            }}
          >
            Amrit Vela Sadhana
          </Title>
          <Text
            style={{
              color: 'rgba(244,196,48,0.8)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              fontFamily: "'Lora', serif",
            }}
          >
            Crown yourself in the early hours of the morning
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
                background: 'rgba(244,196,48,0.06)',
                border: '1px solid rgba(244,196,48,0.2)',
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <Text c="dimmed" style={{ fontStyle: 'italic' }}>
                No upcoming sadhanas scheduled yet. Check back soon.
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
                      background: 'linear-gradient(135deg, #fffde7 0%, #fdf5e6 100%)',
                      border: '1px solid rgba(244,196,48,0.4)',
                      borderRadius: '20px',
                      boxShadow: '0 4px 24px rgba(180,100,20,0.10)',
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
                            <IconCalendar size={18} color="var(--saffron-medium)" />
                            <Text size="sm" c="dark.6">{format(date, 'EEEE, MMMM d, yyyy')}</Text>
                          </Group>
                        )}
                        {date && (
                          <Group gap="sm">
                            <IconClock size={18} color="var(--saffron-medium)" />
                            <Text size="sm" c="dark.6">
                              {format(date, 'h:mm a')}
                              {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ' · 2.5 hours'}
                            </Text>
                          </Group>
                        )}
                        {meeting.location && (
                          <Group gap="sm">
                            <IconMapPin size={18} color="var(--saffron-medium)" />
                            <Text size="sm" c="dark.6">{meeting.location}</Text>
                          </Group>
                        )}
                      </Stack>

                      {meeting.description && (
                        <>
                          <Divider color="rgba(244,196,48,0.25)" />
                          <Text size="md" c="dark.6" style={{ lineHeight: 1.8 }}>
                            {meeting.description}
                          </Text>
                        </>
                      )}

                      <Divider color="rgba(244,196,48,0.2)" />

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

          <hr className="saffron-divider" />

          {/* Resources section — from resources/page.tsx */}
          <Stack gap="xl">
            <Title
              order={2}
              style={{
                fontFamily: "'Cinzel', serif",
                color: 'var(--charcoal)',
                fontSize: '1.8rem',
                fontWeight: 700,
              }}
            >
              Sadhana Resources
            </Title>

            <blockquote className="amrit-quote">
              "Join us for the sacred early morning practice. Amrit Vela, the 'ambrosial hours'
              before dawn, is the most powerful time for spiritual practice. Experience
              transformation through this 2.5-hour journey of consciousness."
            </blockquote>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
              {/* Jap Ji PDF */}
              <Paper
                p="xl"
                className="card-natural"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Stack gap="md" style={{ flex: 1 }}>
                  <Group gap="md">
                    <ThemeIcon size="xl" radius="md" style={{ background: 'rgba(244,196,48,0.2)', color: 'var(--saffron-bright)' }}>
                      <IconFileText size={24} />
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: 'var(--charcoal)', fontSize: '1.2rem', fontWeight: 700 }}>
                        Jap Ji Sahib
                      </Title>
                      <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>The Cosmic Meditation</Text>
                    </Stack>
                  </Group>
                  <Divider color="rgba(244,196,48,0.3)" />
                  <Text size="sm" style={{ color: 'var(--charcoal)', lineHeight: 1.8 }}>
                    The foundational morning prayer of Sikh Dharma, containing the essence of all spiritual teachings.
                    Recited at the opening of every Amrit Vela practice, Jap Ji Sahib was composed by Guru Nanak
                    and describes the nature of God and the path of the soul.
                  </Text>
                  <Text size="xs" style={{ color: 'var(--saffron-medium)', fontStyle: 'italic', fontWeight: 500 }}>
                    2010 Edition with translation and transliteration
                  </Text>
                  <Group mt="auto" pt="md">
                    <Button
                      component="a"
                      href="/jap_jee_-_the_cosmic_meditation_-_2010.pdf"
                      download
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                      style={{
                        background: 'linear-gradient(135deg, var(--saffron-bright), var(--terracotta-light))',
                        color: 'white',
                        borderRadius: '12px',
                        fontWeight: 600,
                        border: 'none',
                        flex: 1,
                      }}
                    >
                      Download PDF
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              {/* Aquarian Sadhana Kirtan */}
              <Paper
                p="xl"
                className="card-natural"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Stack gap="md" style={{ flex: 1 }}>
                  <Group gap="md">
                    <ThemeIcon size="xl" radius="md" style={{ background: 'rgba(244,196,48,0.2)', color: 'var(--terracotta-bright)' }}>
                      <IconMusic size={24} />
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: 'var(--charcoal)', fontSize: '1.2rem', fontWeight: 700 }}>
                        Aquarian Sadhana Kirtan
                      </Title>
                      <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>Sacred Mantras & Chants</Text>
                    </Stack>
                  </Group>
                  <Divider color="rgba(244,196,48,0.3)" />
                  <Text size="sm" style={{ color: 'var(--charcoal)', lineHeight: 1.8 }}>
                    The sacred mantras and devotional songs used in our 2.5-hour practice. These healing sounds
                    elevate consciousness and create spiritual connection. The Aquarian Sadhana sequence includes
                    seven chants that take you through different dimensions of awareness.
                  </Text>
                  <Text size="xs" style={{ color: 'var(--terracotta-medium)', fontStyle: 'italic', fontWeight: 500 }}>
                    Lyrics shared at gatherings
                  </Text>
                  <Group mt="auto" pt="md">
                    <Text size="xs" c="dimmed" ta="center" style={{ width: '100%', fontStyle: 'italic' }}>Coming soon</Text>
                  </Group>
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Sequence card */}
            <Paper p="xl" className="card-natural">
              <Stack gap="md">
                <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: 'var(--charcoal)', fontSize: '1.4rem', fontWeight: 700 }}>
                  The Aquarian Sadhana Sequence
                </Title>
                <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
                  The complete Aquarian Sadhana is a 2.5-hour morning practice:
                </Text>
                {aquarianSteps.map((step) => (
                  <Group key={step} gap="sm">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--saffron-bright)', flexShrink: 0, boxShadow: '0 0 8px rgba(244,196,48,0.6)' }} />
                    <Text size="md" style={{ color: 'var(--charcoal)', fontWeight: 500 }}>{step}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>
    </div>
  );
}
