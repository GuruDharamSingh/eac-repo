"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Container, Group, Modal, Paper, Text, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Newspaper, LogIn, UserCircle, MessageCircleQuestion, HelpCircle } from "lucide-react";
import { BaroqueSignup } from "@elkdonis/ui";
import { supabase } from "@/lib/supabase";

// Sticky top banner + nav row, persisted across every (app) page (see
// layout-wrapper.tsx). "Current Work Question" and "Help" both hand off to
// /feed via query params (?wq=1 / ?welcome=1) — feed-client.tsx and
// welcome-popup.tsx pick those up, same mechanism, so both work whether
// you're already on /feed or navigating in from elsewhere.
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loginModalOpened, { open: openLoginModal, close: closeLoginModal }] = useDisclosure(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [pathname]);

  const isFeed = pathname === "/feed";

  return (
    <>
      <Paper
        shadow="md"
        p="md"
        className="archive-topbar"
        style={{ position: "sticky", top: 0, zIndex: 50 }}
      >
        <Container fluid style={{ position: "relative" }}>
          <Title
            order={2}
            fw={400}
            style={{
              color: '#fdf0d0',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: "'Brothers', 'Cinzel', serif",
              fontSize: 'clamp(1.98rem, 6.2vw, 4.22rem)',
              lineHeight: 1.1,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL}
                style={{ color: 'inherit', textDecoration: 'none' }}
                title="Elkdonis Arts Collective — the network"
              >
                Elkdonis Arts Collective
              </a>
            ) : (
              'Elkdonis Arts Collective'
            )}
          </Title>
          <Group justify="center" gap="lg" mt="xs" wrap="wrap">
            {!isFeed && (
              <UnstyledButton onClick={() => router.push('/feed')} className="archive-header-navlink">
                <Group gap={6} wrap="nowrap">
                  <Newspaper size={14} />
                  <Text size="xs" tt="uppercase" fw={600} style={{ letterSpacing: '0.1em' }}>
                    Feed
                  </Text>
                </Group>
              </UnstyledButton>
            )}
            {userId ? (
              <UnstyledButton onClick={() => router.push('/account')} className="archive-header-navlink">
                <Group gap={6} wrap="nowrap">
                  <UserCircle size={14} />
                  <Text size="xs" tt="uppercase" fw={600} style={{ letterSpacing: '0.1em' }}>
                    Account
                  </Text>
                </Group>
              </UnstyledButton>
            ) : (
              <UnstyledButton onClick={openLoginModal} className="archive-header-navlink">
                <Group gap={6} wrap="nowrap">
                  <LogIn size={14} />
                  <Text size="xs" tt="uppercase" fw={600} style={{ letterSpacing: '0.1em' }}>
                    Login
                  </Text>
                </Group>
              </UnstyledButton>
            )}
            <UnstyledButton onClick={() => router.push('/feed?wq=1')} className="archive-header-navlink">
              <Group gap={6} wrap="nowrap">
                <MessageCircleQuestion size={14} />
                <Text size="xs" tt="uppercase" fw={600} style={{ letterSpacing: '0.1em' }}>
                  Current Work Question
                </Text>
              </Group>
            </UnstyledButton>
            <UnstyledButton onClick={() => router.push('/feed?welcome=1')} className="archive-header-navlink">
              <Group gap={6} wrap="nowrap">
                <HelpCircle size={14} />
                <Text size="xs" tt="uppercase" fw={600} style={{ letterSpacing: '0.1em' }}>
                  Help
                </Text>
              </Group>
            </UnstyledButton>
          </Group>
        </Container>
      </Paper>

      <Modal
        opened={loginModalOpened}
        onClose={closeLoginModal}
        centered
        size="sm"
        radius="md"
        title={<Text fw={700} size="lg">Sign in</Text>}
      >
        <BaroqueSignup
          initialMode="signin"
          onSuccess={() => {
            closeLoginModal();
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
