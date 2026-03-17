import { Container, Stack, Title, Text, Paper, Group, Image, Box, Grid, GridCol } from '@mantine/core';
import Link from 'next/link';
import { HeroBanner } from '@/components/hero-banner';
import { SadhanaCard } from '@/components/sadhana-card';
import { getNextMeeting } from '@/lib/data';

// Component constants from original project
const HERO_TITLE = 'Amrit Vela Sadhana';
const HERO_SUBTITLE = 'A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan';
const HERO_DESCRIPTION = 'Crown yourself in the Early Hours of the Morning. We follow a Sikh Dharma tradition rising 4 hours before sunrise in the hour known as the Amrit Vela.';
const MEETING_INFO = 'We meet once a month, either in a Church or on a Ski Hill in Etobicoke. Check above to see which and when.';

export default async function HomePage() {
  const nextMeeting = await getNextMeeting();

  return (
    <>
      {/* Hero Banner Section - Matches original carousel intent */}
      <HeroBanner />

      {/* Main Content Section - Adheres to original structure */}
      <div className="body-container" style={{ padding: '4rem 0', background: 'transparent' }}>
        <Container size="lg">
          <Stack gap="xl">
            {/* Main Call to Action Section */}
            <Box style={{ textAlign: 'center' }} mb="2rem">
              <Title
                className="gradient-text"
                style={{
                  fontSize: '2.8rem',
                  fontFamily: "'Cinzel', serif",
                  marginBottom: '1.5rem',
                }}
              >
                {HERO_TITLE}
              </Title>
              <Text
                style={{
                  fontSize: '1.4rem',
                  color: 'var(--terracotta-medium)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  marginBottom: '2rem',
                }}
              >
                {HERO_SUBTITLE}
              </Text>
              
              <Container size="sm">
                <Text
                  style={{
                    fontSize: '1.2rem',
                    color: 'var(--charcoal)',
                    lineHeight: 1.8,
                    marginBottom: '1.5rem',
                  }}
                >
                  {HERO_DESCRIPTION}
                </Text>
                <Text
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--charcoal)',
                    lineHeight: 1.8,
                    marginBottom: '2.5rem',
                  }}
                >
                  {MEETING_INFO}
                </Text>
              </Container>
            </Box>

            {/* Next Session RSVP Card */}
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <SadhanaCard meeting={nextMeeting} />
            </div>

            <hr className="saffron-divider" />

            {/* Three Section Portal Tiles */}
            <Box mb="2rem">
              <Title
                order={2}
                ta="center"
                mb="1.5rem"
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: 'var(--charcoal)',
                  fontSize: '1.8rem',
                  fontWeight: 700,
                }}
              >
                Our Practices
              </Title>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                {/* Amrit Vela portal */}
                <Link href="/sadhana" style={{ textDecoration: 'none' }}>
                  <Paper
                    p="xl"
                    className="portal-tile portal-tile--sadhana"
                    style={{
                      background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)',
                      border: '2px solid rgba(244,196,48,0.5)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    <Stack gap="sm">
                      <Text style={{ fontSize: '2rem' }}>🌅</Text>
                      <Title order={3} style={{ color: 'var(--saffron-bright)', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>
                        Amrit Vela Sadhana
                      </Title>
                      <Text size="sm" style={{ color: 'rgba(244,196,48,0.75)', lineHeight: 1.6 }}>
                        4 AM morning practice — Jap Ji, Yoga & Kirtan
                      </Text>
                      <Text size="xs" style={{ color: 'var(--saffron-bright)', fontWeight: 700, letterSpacing: '0.05em' }}>
                        View schedule →
                      </Text>
                    </Stack>
                  </Paper>
                </Link>

                {/* Yoga Classes portal */}
                <Link href="/yoga" style={{ textDecoration: 'none' }}>
                  <Paper
                    p="xl"
                    className="portal-tile portal-tile--yoga"
                    style={{
                      background: 'linear-gradient(135deg, #1a2e1f 0%, #2d4a35 100%)',
                      border: '2px solid rgba(90,138,106,0.5)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    <Stack gap="sm">
                      <Text style={{ fontSize: '2rem' }}>🧘</Text>
                      <Title order={3} style={{ color: 'var(--yoga-green, #5a8a6a)', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>
                        Yoga Classes
                      </Title>
                      <Text size="sm" style={{ color: 'rgba(90,138,106,0.8)', lineHeight: 1.6 }}>
                        Kundalini Yoga with Guru Dharam Singh
                      </Text>
                      <Text size="xs" style={{ color: 'var(--yoga-green, #5a8a6a)', fontWeight: 700, letterSpacing: '0.05em' }}>
                        View schedule →
                      </Text>
                    </Stack>
                  </Paper>
                </Link>

                {/* Gurdwara portal */}
                <Link href="/gurdwara" style={{ textDecoration: 'none' }}>
                  <Paper
                    p="xl"
                    className="portal-tile portal-tile--gurdwara"
                    style={{
                      background: 'linear-gradient(135deg, #1e0a0a 0%, #3a1212 100%)',
                      border: '2px solid rgba(139,46,46,0.5)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                    }}
                  >
                    <Stack gap="sm">
                      <Text style={{ fontSize: '2rem' }}>🕌</Text>
                      <Title order={3} style={{ color: '#e89898', fontFamily: "'Cinzel', serif", fontSize: '1.2rem' }}>
                        Gurdwara & Langar
                      </Title>
                      <Text size="sm" style={{ color: 'rgba(232,152,152,0.7)', lineHeight: 1.6 }}>
                        Sangat & communal meal at Guru Ram Das Ashram
                      </Text>
                      <Text size="xs" style={{ color: '#e89898', fontWeight: 700, letterSpacing: '0.05em' }}>
                        View schedule →
                      </Text>
                    </Stack>
                  </Paper>
                </Link>
              </div>
            </Box>

            <hr className="saffron-divider" />

            {/* Our Tradition Section */}
            <Container size="lg" mt="2rem">
              <Grid gutter="xl" align="center">
                <GridCol span={12}>
                  <Title
                    order={2}
                    mb="2rem"
                    style={{
                      fontSize: '2.4rem',
                      color: 'var(--charcoal)',
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700
                    }}
                  >
                    Our Tradition
                  </Title>
                </GridCol>

                {/* Image Column */}
                <GridCol span={{ base: 12, md: 5, lg: 4 }}>
                  <Image
                    src="/GD4to5 for Lotus.JPG"
                    alt="Guru Fatha Singh Ji"
                    style={{
                      width: '100%',
                      height: '350px',
                      objectFit: 'cover',
                      borderRadius: '20px',
                      border: '4px solid var(--saffron-bright)',
                      boxShadow: '0 12px 32px rgba(244, 196, 48, 0.3)'
                    }}
                  />
                </GridCol>

                {/* Text Content Column */}
                <GridCol span={{ base: 12, md: 7, lg: 8 }}>
                  <Box style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    height: '100%',
                    paddingLeft: '2rem'
                  }}>
                    <Text
                      size="lg"
                      style={{
                        color: 'var(--charcoal)',
                        lineHeight: 1.8,
                        fontSize: '1.2rem',
                      }}
                    >
                      <strong style={{ color: 'var(--terracotta-medium)' }}>Guru Fatha Singh Ji</strong>{' '}
                      (<a href="https://www.gurufathasingh.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--terracotta-medium)', fontWeight: 600 }}>see his website here</a>){' '}
                      began this Sadhana and we&apos;ve been carrying it on for the last decade.{' '}
                      Guru Dharam Singh has carried on the responsibility of ensuring its success since 2023.{' '}
                      You can find Guru Dharam&apos;s related effort on this site, including Yoga Classes, and Gurdwara at Guru Ram Das Ashram.
                    </Text>
                  </Box>
                </GridCol>
              </Grid>
            </Container>
          </Stack>
        </Container>
      </div>
    </>
  );
}
