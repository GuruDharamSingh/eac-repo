"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Box,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Sparkles, MapPin, Tent, Compass } from "lucide-react";
import { BaroqueSignup } from "@elkdonis/ui";

export default function LoginPage() {
  // The left content column is identical between signup and login; the right
  // column (BaroqueSignup) owns its own mode toggle, so this page no longer
  // needs to track auth state. We keep this file as a thin server-friendly
  // wrapper so the marketing content keeps its place.
  const [mode] = useState<"login" | "signup">("signup");
  void mode;

  return (
    <Box
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fff8f0 0%, #ffecd8 60%, #ffd4ad 100%)",
      }}
    >
      <Container size="xl" py={{ base: "lg", md: "xl" }} px={{ base: "md", md: "xl" }}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 48 }}>
          {/* Welcome content (left on desktop, top on mobile) */}
          <Stack gap="xl" style={{ order: 1 }}>
            <Stack gap="sm">
              <Group gap="xs" align="center">
                <Sparkles size={20} color="#d45c08" />
                <Text size="xs" tt="uppercase" fw={600} c="#8c3705" style={{ letterSpacing: "0.15em" }}>
                  Elkdonis Arts Collective
                </Text>
              </Group>
              <Title
                order={1}
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.6rem)",
                  fontWeight: 700,
                  lineHeight: 1.15,
                  color: "#3d1f04",
                }}
              >
                Thank you for checking us out — and for helping us become a collective.
              </Title>
              <Text c="#6a4520" size="lg" style={{ fontFamily: "'Crimson Text', serif", fontStyle: "italic" }}>
                You are among our early members. We're glad you're here while we build.
              </Text>
            </Stack>

            <Box
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "760 / 1536",
                maxHeight: 520,
                overflow: "hidden",
                borderRadius: 8,
                boxShadow: "0 12px 32px rgba(60, 30, 4, 0.18)",
                border: "1px solid #e8c595",
              }}
            >
              <Image
                src="/surrealistcollageMcCool-1-760x1536.jpg"
                alt="Surrealist collage — Mandala de Compassion"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 40vw"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
            </Box>

            <Stack gap="md">
              <Title order={2} size="h3" style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                About Elkdonis
              </Title>
              <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                Elkdonis Arts is a <strong>mutual aid society</strong> — a community of artists, educators, thinkers,
                and seekers dedicated to objective arts, cultural exchange, and education for public benefit. Our
                roots trace back to Newmarket, Ontario in 1990, when we opened the first internet café in town and
                hosted concerts, raves, theatrical and literary events. Our members are now based in{" "}
                <strong>Paris, Los Angeles, and the Toronto area</strong>, and we've recently acquired forested land
                near conservation country to build a permaculture-aligned compound with artist residences, studios,
                and galleries.
              </Text>
              <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65, fontStyle: "italic" }}>
                Online or in person, we consider these spaces real and sacred — held in the minds, hearts, and bodies
                of our members. Welcome.
              </Text>
            </Stack>

            <Divider color="#e8c595" />

            <Stack gap="md">
              <Title order={3} size="h4" style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                Why we ask you to create an account
              </Title>
              <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                Creating an account is how we stay in touch. It's a way for us to{" "}
                <strong>keep you up to date</strong> on the collective's work, a way for{" "}
                <strong>you to show your support</strong>, and a{" "}
                <strong>secure key into the offerings</strong> of our growing network.
              </Text>
            </Stack>

            <Stack gap="md">
              <Title order={3} size="h4" style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                What you can take a look at today
              </Title>
              <Stack gap="md">
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <Tent size={22} color="#d45c08" style={{ flexShrink: 0, marginTop: 4 }} />
                  <Stack gap={2}>
                    <Text fw={600} c="#3d1f04">Inner Gathering</Text>
                    <Text c="#3d2412" size="sm" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.55 }}>
                      This site, your preliminary view of what's to come. Create posts, host meetings, and RSVP to
                      gatherings other members are organizing.
                    </Text>
                  </Stack>
                </Group>
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <Sparkles size={22} color="#d45c08" style={{ flexShrink: 0, marginTop: 4 }} />
                  <Stack gap={2}>
                    <Text fw={600} c="#3d1f04">Nextcloud</Text>
                    <Text c="#3d2412" size="sm" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.55 }}>
                      Our shared storage and central repository for collective content. Send us photos, recordings,
                      or notes from the art scene around you.{" "}
                      <Text component="span" c="#6a4520" fs="italic" size="sm">
                        (A "drop zone" surface that pulls the best of it into everyone's feed is on the way.)
                      </Text>
                    </Text>
                  </Stack>
                </Group>
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <Compass size={22} color="#d45c08" style={{ flexShrink: 0, marginTop: 4 }} />
                  <Stack gap={2}>
                    <Text fw={600} c="#3d1f04">Artist Directory</Text>
                    <Text c="#3d2412" size="sm" style={{ fontFamily: "'Crimson Text', serif", lineHeight: 1.55 }}>
                      Tell us about artists local to you that you think could use a shout-out.
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Stack>

            <Box
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 320,
                aspectRatio: "522 / 1024",
                maxHeight: 380,
                overflow: "hidden",
                borderRadius: 8,
                margin: "0 auto",
                boxShadow: "0 8px 24px rgba(60, 30, 4, 0.15)",
                border: "1px solid #e8c595",
              }}
            >
              <Image
                src="/101094278_787250818348261_3132422973001039872_n.jpg"
                alt="Surrealist artwork — Wait"
                fill
                sizes="(max-width: 768px) 80vw, 320px"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
            </Box>

            <Stack gap="md">
              <Title order={3} size="h4" style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                What's coming
              </Title>
              <Stack gap="xs">
                <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                  • The full <strong>Arts Collective</strong> site at{" "}
                  <Text component="span" ff="monospace" size="sm">network.elkdonis-arts.org</Text> —
                  workshop pages, public-facing feed, community newspaper.
                </Text>
                <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                  • <strong>OAD — the Online Artist Directory</strong> — a public-file system for documenting and
                  connecting artists, works, and local arts activity, presented by Elkdonis.
                </Text>
                <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                  • <strong>Google sign-in</strong> — for now, email and password works fine.
                </Text>
                <Text c="#3d2412" style={{ fontFamily: "'Crimson Text', serif", fontSize: "1.05rem", lineHeight: 1.65 }}>
                  • A <strong>major launch in summer 2026</strong>.
                </Text>
              </Stack>
              <Paper bg="#fff5e1" radius="sm" p="md" withBorder style={{ borderColor: "#e8c595" }}>
                <Group gap="xs" wrap="nowrap">
                  <MapPin size={18} color="#d45c08" style={{ flexShrink: 0 }} />
                  <Text c="#3d1f04" fw={500} style={{ fontFamily: "'Crimson Text', serif" }}>
                    Signing up now means you're already in for everything as it lands.
                  </Text>
                </Group>
              </Paper>
              <Text c="#6a4520" size="sm" fs="italic" style={{ fontFamily: "'Crimson Text', serif" }}>
                You can fill in your display name, photo, bio, and comment color from your account page anytime — no
                need to get it perfect today.
              </Text>
            </Stack>
          </Stack>

          {/* Form (right on desktop, bottom on mobile) */}
          <Box style={{ position: "relative", order: 2 }}>
            <Box
              style={{
                position: "sticky",
                top: 24,
              }}
            >
              <BaroqueSignup
                initialMode="signup"
                subtitle="Just an email and a password — the rest can come later."
                onSuccess={({ mode: m }) => {
                  window.location.href = m === "signup" ? "/feed?welcome=1" : "/feed";
                }}
              />
            </Box>
          </Box>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
