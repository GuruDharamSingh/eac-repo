"use client";

import { Box, Container, Title, Text, Stack, Grid, Paper } from "@mantine/core";
import { Sparkles, Heart, Globe, Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    icon: Sparkles,
    title: "Objective Art",
    description:
      "We guide artists into transcendent sensations through inquiry into forces bigger than themselves.",
  },
  {
    icon: Heart,
    title: "Mutual Aid Society",
    description:
      "A circle of friends accelerating each other's growth while maintaining a non-hierarchical structure.",
  },
  {
    icon: Globe,
    title: "International Community",
    description:
      "Members worldwide, all welcome to join our exploration of paratheatre and fourth-way work.",
  },
  {
    icon: Eye,
    title: "Self-Observation",
    description:
      "Applying fourth-way teachings to self-observe, self-remember, and cultivate presence.",
  },
];

export function About() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Box
      component="section"
      id="about"
      ref={sectionRef}
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #111118 100%)",
        position: "relative",
        overflow: "hidden",
      }}
      py={100}
    >
      {/* Section divider */}
      <Box className="section-divider" style={{ position: "absolute", top: 0, left: 0, right: 0 }} />

      <Container size="lg">
        <Stack gap={60}>
          {/* Section Header */}
          <Stack gap="md" align="center" style={{ textAlign: "center" }}>
            <Text
              size="sm"
              c="violet.4"
              className={isVisible ? "animate-fade-in" : "opacity-0"}
              style={{
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              About Us
            </Text>
            <Title
              order={2}
              className={isVisible ? "animate-fade-in-up delay-100" : "opacity-0"}
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "3rem",
                fontWeight: 400,
                color: "#f3f4f6",
              }}
            >
              A Fourth-Way Mutual Aid Society
            </Title>
            <Box
              className={isVisible ? "animate-fade-in delay-200" : "opacity-0"}
              style={{
                width: "60px",
                height: "1px",
                background: "#c9a962",
              }}
            />
          </Stack>

          {/* Main Content */}
          <Grid gutter={60}>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="lg" className={isVisible ? "animate-slide-in-left delay-300" : "opacity-0"}>
                <Text
                  size="lg"
                  c="gray.3"
                  style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    fontSize: "1.35rem",
                    lineHeight: 1.8,
                  }}
                >
                  We are Elkdonis Arts Collective, a performance and visual arts group.
                  We work to restore the necessity of art in life for all.
                </Text>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  Our name comes from a word found in G.I. Gurdjieff's{" "}
                  <em>Beelzebub's Tales</em>: "helkdonis", meaning objective prayer
                  for God (not prayer for self).
                </Text>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  Our membership is largely comprised of students and teachers of the
                  fourth-way attempting to work objectively as artists or entrepreneurs.
                  We function as a mutual aid society helping each other apply the
                  fourth-way teachings, to self-observe and self-remember, to learn and grow.
                </Text>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  Our original group was formed in Newmarket, Ontario, Canada in 1990.
                  We opened the first internet cafe in town and held concerts and events.
                  The form the Work takes is always changing.
                </Text>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="lg" className={isVisible ? "animate-fade-in-up delay-400" : "opacity-0"}>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  There are but two paths an artist may take. One may depict or convey
                  a subjective idea, such as an advertisement or political statement.
                  The viewer will find it beautiful or ugly based on their conditioning.
                </Text>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  The other choice is to be a guide into transcendent sensations—this is
                  <strong style={{ color: "#c9a962" }}> objective art</strong>. The artist
                  holds an inquiry into something bigger than themselves until the force
                  affects them inwardly. Outwardly this produces a gesture, and the gesture
                  produces an artifact.
                </Text>
                <Text size="md" c="gray.4" style={{ lineHeight: 1.8 }}>
                  The artifact is completed by the viewer, who will be moved into the same
                  emotional experience as the artist during the inquiry. This is an objective
                  communication—an act of revelation.
                </Text>
                <Box
                  mt="md"
                  p="lg"
                  style={{
                    background: "rgba(124, 58, 237, 0.1)",
                    borderLeft: "3px solid #7c3aed",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <Text
                    size="sm"
                    c="gray.3"
                    style={{
                      fontFamily: '"Cormorant Garamond", Georgia, serif',
                      fontStyle: "italic",
                      fontSize: "1.1rem",
                      lineHeight: 1.7,
                    }}
                  >
                    "While working together in an asocial climate, a unique group unity
                    unfolds from each person's heightened commitment to their own internal
                    sources while sharing that Presence with others and being acted on by
                    the Presence of others."
                  </Text>
                  <Text size="xs" c="gray.5" mt="sm">
                    — Antero Alli
                  </Text>
                </Box>
              </Stack>
            </Grid.Col>
          </Grid>

          {/* Feature Cards */}
          <Grid gutter="lg" mt={40}>
            {features.map((feature, index) => (
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={feature.title}>
                <Paper
                  className={`team-card ${isVisible ? `animate-scale-in delay-${(index + 5) * 100}` : "opacity-0"}`}
                  p="xl"
                  style={{
                    background: "rgba(17, 17, 24, 0.8)",
                    border: "1px solid rgba(124, 58, 237, 0.2)",
                    height: "100%",
                  }}
                >
                  <Stack gap="md" align="center" style={{ textAlign: "center" }}>
                    <Box
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(91, 33, 182, 0.3))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <feature.icon size={28} color="#c9a962" strokeWidth={1.5} />
                    </Box>
                    <Title
                      order={4}
                      style={{
                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                        fontSize: "1.25rem",
                        fontWeight: 500,
                        color: "#f3f4f6",
                      }}
                    >
                      {feature.title}
                    </Title>
                    <Text size="sm" c="gray.5" style={{ lineHeight: 1.6 }}>
                      {feature.description}
                    </Text>
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>

          {/* Additional Quote */}
          <Box
            mt={40}
            p="xl"
            className={isVisible ? "animate-fade-in delay-800" : "opacity-0"}
            style={{
              background: "rgba(10, 10, 15, 0.6)",
              border: "1px solid rgba(201, 169, 98, 0.15)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <Text
              className="quote-text"
              c="gray.4"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "1.15rem",
                lineHeight: 1.8,
                maxWidth: "900px",
                margin: "0 auto",
              }}
            >
              "To cultivate resonance with vertical sources is not easy. This kind of inner
              work persists as an uphill struggle against the grain of decades of horizontal,
              socially-conditioned, externally-directed habit patterns. Accessing our verticality
              can act as an irritant to anyone identified exclusively with the horizontal plane
              of existence. The shock of authentic vertical contact, no matter how fleeting,
              can shatter unchecked assumptions about the world around us and who we think we are."
            </Text>
            <Text size="sm" c="gray.6" mt="md">
              — Antero Alli
            </Text>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
