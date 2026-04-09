import { Container, Stack, Title, Text, Paper, Group, ThemeIcon, SimpleGrid, Divider, Button } from '@mantine/core';
import { IconFileText, IconMusic, IconDownload } from '@tabler/icons-react';

export const metadata = {
  title: 'Resources | Amrit Vela Toronto',
};

const resources = [
  {
    icon: IconFileText,
    title: 'Jap Ji Sahib',
    subtitle: 'The Cosmic Meditation',
    description:
      'The foundational morning prayer of Sikh Dharma, containing the essence of all spiritual teachings. Recited at the opening of every Amrit Vela practice, Jap Ji Sahib was composed by Guru Nanak and describes the nature of God and the path of the soul.',
    note: '2010 Edition with translation and transliteration',
    href: '/jap_jee_-_the_cosmic_meditation_-_2010.pdf',
    color: 'var(--saffron-bright)',
  },
  {
    icon: IconMusic,
    title: 'Aquarian Sadhana Kirtan',
    subtitle: 'Sacred Mantras & Chants',
    description:
      'The sacred mantras and devotional songs used in our 2.5-hour practice. These healing sounds elevate consciousness and create spiritual connection. The Aquarian Sadhana sequence includes seven chants that take you through different dimensions of awareness.',
    note: 'Lyrics shared at gatherings',
    color: 'var(--terracotta-bright)',
  },
];

export default function ResourcesPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title
            order={1}
            style={{ 
              fontFamily: "'Cinzel', serif", 
              color: 'var(--charcoal)', 
              fontSize: '2.2rem',
              fontWeight: 700 
            }}
          >
            Sadhana Resources
          </Title>
          <Text 
            size="lg" 
            style={{ 
              color: 'var(--terracotta-medium)', 
              lineHeight: 1.6, 
              fontStyle: 'italic' 
            }}
          >
            Sacred texts and songs to support your practice
          </Text>
        </Stack>

        <hr className="saffron-divider" />

        <blockquote className="amrit-quote">
          "Join us for the sacred early morning practice. Amrit Vela, the 'ambrosial hours'
          before dawn, is the most powerful time for spiritual practice. Experience
          transformation through this 2.5-hour journey of consciousness."
        </blockquote>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          {resources.map((r) => (
            <Paper
              key={r.title}
              p="xl"
              className="card-natural"
              style={{
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Stack gap="md" style={{ flex: 1 }}>
                <Group gap="md">
                  <ThemeIcon
                    size="xl"
                    radius="md"
                    style={{ background: `rgba(244, 196, 48, 0.2)`, color: r.color }}
                  >
                    <r.icon size={24} />
                  </ThemeIcon>
                  <Stack gap={2}>
                    <Title
                      order={3}
                      style={{
                        fontFamily: "'Cinzel', serif",
                        color: 'var(--charcoal)',
                        fontSize: '1.2rem',
                        fontWeight: 700
                      }}
                    >
                      {r.title}
                    </Title>
                    <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                      {r.subtitle}
                    </Text>
                  </Stack>
                </Group>

                <Divider color="rgba(244, 196, 48, 0.3)" />

                <Text size="sm" style={{ color: 'var(--charcoal)', lineHeight: 1.8 }}>
                  {r.description}
                </Text>

                <Text
                  size="xs"
                  style={{
                    color: r.color === 'var(--saffron-bright)' ? 'var(--saffron-medium)' : 'var(--terracotta-medium)',
                    fontStyle: 'italic',
                    fontWeight: 500
                  }}
                >
                  {r.note}
                </Text>

                <Group mt="auto" pt="md">
                  {r.href ? (
                    <Button
                      component="a"
                      href={r.href}
                      download
                      size="sm"
                      style={{
                        background: 'linear-gradient(135deg, var(--saffron-bright), var(--terracotta-light))',
                        color: 'white',
                        borderRadius: '12px',
                        fontWeight: 600,
                        boxShadow: '0 4px 16px rgba(244, 196, 48, 0.4)',
                        border: 'none',
                        flex: 1
                      }}
                      leftSection={<IconDownload size={16} />}
                    >
                      Download PDF
                    </Button>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" style={{ width: '100%', fontStyle: 'italic' }}>
                      Coming soon
                    </Text>
                  )}
                </Group>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>

        <hr className="saffron-divider" />

        <Paper
          p="xl"
          className="card-natural"
        >
          <Stack gap="md">
            <Title
              order={3}
              style={{ 
                fontFamily: "'Cinzel', serif", 
                color: 'var(--charcoal)', 
                fontSize: '1.4rem',
                fontWeight: 700 
              }}
            >
              The Aquarian Sadhana Sequence
            </Title>
            <Text size="md" style={{ color: 'var(--charcoal)', lineHeight: 1.9 }}>
              The complete Aquarian Sadhana is a 2.5-hour morning practice:
            </Text>
            {[
              'Japji Sahib – 20 min',
              'Kundalini Yoga Kriya – 30 min',
              'Savasana – 5 min',
              'Long Chant (Ong Namo) – 7 min',
              'Seven Aquarian Sadhana Chants – 62 min',
              'Long Time Sun – 3 min',
            ].map((step) => (
              <Group key={step} gap="sm">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--saffron-bright)',
                    flexShrink: 0,
                    boxShadow: '0 0 8px rgba(244, 196, 48, 0.6)'
                  }}
                />
                <Text size="md" style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                  {step}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
