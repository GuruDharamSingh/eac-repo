"use client";

import { Box, Container, Title, Text, Button, Stack, Group } from "@mantine/core";
import { ExternalLink } from "lucide-react";

export function Hero() {
  return (
    <Box
      component="section"
      className="hero-gradient"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sacred geometry decorative elements */}
      <Box
        className="sacred-geometry animate-float"
        style={{
          width: "600px",
          height: "600px",
          top: "-200px",
          right: "-200px",
        }}
      />
      <Box
        className="sacred-geometry animate-float delay-300"
        style={{
          width: "400px",
          height: "400px",
          bottom: "-100px",
          left: "-100px",
        }}
      />
      <Box
        className="sacred-geometry animate-float delay-500"
        style={{
          width: "300px",
          height: "300px",
          top: "50%",
          right: "10%",
        }}
      />

      <Container size="lg" py={80}>
        <Stack gap="xl" align="center" style={{ textAlign: "center" }}>
          {/* Main Title */}
          <Title
            order={1}
            className="hero-title opacity-0 animate-fade-in-up"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: "4rem",
              fontWeight: 300,
              letterSpacing: "0.1em",
              color: "#f3f4f6",
              textTransform: "uppercase",
            }}
          >
            Elkdonis Arts Collective
          </Title>

          {/* Decorative line */}
          <Box
            className="opacity-0 animate-fade-in delay-200"
            style={{
              width: "80px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, #c9a962, transparent)",
            }}
          />

          {/* Main Quote */}
          <Box
            className="opacity-0 animate-fade-in-up delay-300"
            style={{
              maxWidth: "800px",
              padding: "40px",
              background: "rgba(17, 17, 24, 0.6)",
              borderRadius: "12px",
              border: "1px solid rgba(201, 169, 98, 0.2)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Text
              className="quote-text"
              size="lg"
              c="gray.3"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "1.25rem",
                lineHeight: 1.9,
              }}
            >
              Real attention is a radiant field of energy…a timeless medium for the
              instantaneous transfer of experience. It is a function or property of
              space in which we can participate voluntarily, or not. It is the
              congruence of perception and will which, when voluntarized, connects us
              to our experience. It is the catalyst which transforms sensation into
              consciousness. It is the necessary and sufficient condition of our
              possible evolution.
            </Text>
            <Text
              size="sm"
              c="gray.5"
              mt="md"
              style={{ fontStyle: "italic" }}
            >
              — inpresence.org
            </Text>
          </Box>

          {/* CTA Button */}
          <Group gap="md" className="opacity-0 animate-fade-in-up delay-500">
            <Button
              component="a"
              href="https://inpresence.org"
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="gradient"
              gradient={{ from: "violet", to: "grape", deg: 135 }}
              rightSection={<ExternalLink size={18} />}
              className="animate-pulse-glow"
              styles={{
                root: {
                  fontFamily: '"Inter", sans-serif',
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "0 32px",
                  height: "52px",
                },
              }}
            >
              Free Courses & Study Groups
            </Button>
          </Group>

          {/* Scroll indicator */}
          <Box
            className="opacity-0 animate-fade-in delay-700"
            style={{
              position: "absolute",
              bottom: "40px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <Box
              component="a"
              href="#about"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                color: "#9ca3af",
                textDecoration: "none",
                transition: "color 0.3s",
              }}
            >
              <Text size="xs" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Discover
              </Text>
              <Box
                style={{
                  width: "24px",
                  height: "40px",
                  border: "2px solid rgba(201, 169, 98, 0.4)",
                  borderRadius: "12px",
                  position: "relative",
                }}
              >
                <Box
                  style={{
                    width: "4px",
                    height: "8px",
                    background: "#c9a962",
                    borderRadius: "2px",
                    position: "absolute",
                    top: "8px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    animation: "float 2s ease-in-out infinite",
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
