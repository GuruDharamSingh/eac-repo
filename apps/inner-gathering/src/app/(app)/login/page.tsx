"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Box,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Sparkles } from "lucide-react";
import { BaroqueSignup } from "@elkdonis/ui";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get('returnTo');
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
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: "xl", sm: "xl", md: 48 }}>
          {/* Welcome content (left on desktop, top on mobile) */}
          <Stack gap="xl" style={{ order: 1 }}>
            <Stack gap="sm">
              <Group gap="xs" align="center">
                <Sparkles size={20} color="#d45c08" />
                <Text size="xs" tt="uppercase" fw={600} c="#8c3705" style={{ letterSpacing: "0.15em" }}>
                  Elkdonis Arts Collective
                </Text>
              </Group>
            </Stack>

            <Box
              style={{
                position: "relative",
                width: "100%",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 12px 32px rgba(60, 30, 4, 0.18)",
                border: "1px solid #e8c595",
                lineHeight: 0,
              }}
            >
              <Image
                src="/surrealistcollageMcCool-1-760x1536.jpg"
                alt="Surrealist collage — Mandala de Compassion"
                width={760}
                height={1536}
                priority
                sizes="(max-width: 768px) 100vw, 40vw"
                style={{ width: "100%", height: "auto", display: "block" }}
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

            <Box
              style={{
                position: "relative",
                width: "100%",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(60, 30, 4, 0.15)",
                border: "1px solid #e8c595",
                lineHeight: 0,
              }}
            >
              <Image
                src="/101094278_787250818348261_3132422973001039872_n.jpg"
                alt="Surrealist artwork — Wait"
                width={522}
                height={1024}
                sizes="(max-width: 768px) 100vw, 40vw"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </Box>
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
                onSuccess={({ mode: m }) => {
                  if (returnTo) {
                    window.location.href = returnTo;
                  } else {
                    window.location.href = m === "signup" ? "/feed?welcome=1" : "/feed";
                  }
                }}
              />
            </Box>
          </Box>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
