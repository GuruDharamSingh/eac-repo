"use client";

import { Box, Container, Text, Stack, Anchor, Group } from "@mantine/core";
import { Mail } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #050507 100%)",
        borderTop: "1px solid rgba(201, 169, 98, 0.1)",
      }}
      py={60}
    >
      <Container size="lg">
        <Stack gap="xl" align="center" style={{ textAlign: "center" }}>
          {/* Contact section */}
          <Stack gap="md" align="center">
            <Text
              size="lg"
              c="gray.3"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: "1.25rem",
              }}
            >
              Interested in volunteering or joining the collective?
            </Text>
            <Anchor
              href="mailto:info@elkdonis-arts.org"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#c9a962",
                textDecoration: "none",
                fontWeight: 500,
                transition: "opacity 0.3s",
              }}
            >
              <Mail size={18} />
              info@elkdonis-arts.org
            </Anchor>
          </Stack>

          {/* Divider */}
          <Box
            style={{
              width: "100px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(201, 169, 98, 0.3), transparent)",
            }}
          />

          {/* Sacred space message */}
          <Text
            size="sm"
            c="gray.5"
            maw={600}
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontStyle: "italic",
              lineHeight: 1.7,
            }}
          >
            We consider online spaces to be real sacred spaces held in the minds,
            hearts, and bodies of the members.
          </Text>

          <Text
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: "1.5rem",
              fontWeight: 400,
              color: "#c9a962",
              letterSpacing: "0.1em",
            }}
          >
            Welcome.
          </Text>

          {/* Legal section */}
          <Stack gap="xs" mt="xl">
            <Text size="xs" c="gray.6" maw={700} style={{ lineHeight: 1.6 }}>
              Elkdonis Arts Collective operates as a private membership association.
              Using this website means you agree to our terms and conditions and privacy
              policies. The material on this site may not be reproduced, distributed,
              transmitted, cached, or otherwise used, except with the prior written
              permission of Elkdonis Arts Collective.
            </Text>

            <Group gap="xs" justify="center" mt="sm">
              <Text size="xs" c="gray.6">
                © 2019-{currentYear} Elkdonis Arts Collective. All rights reserved.
              </Text>
            </Group>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
