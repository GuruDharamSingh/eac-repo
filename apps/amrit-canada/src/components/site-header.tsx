'use client';

import { Box, Container, Group, Text, Anchor, Title, Burger, Drawer, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Amrit Vela', href: '/sadhana' },
  { label: 'Yoga Classes', href: '/yoga' },
  { label: 'Gurdwara', href: '/gurdwara' },
];

export function SiteHeader() {
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <Box
      component="header"
      style={{
        background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)',
        borderBottom: '3px solid var(--saffron-bright)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Container size="lg" py="md">
        <Group justify="space-between" align="center">
          {/* Brand */}
          <Anchor component={Link} href="/" underline="never">
            <Stack gap={2}>
              <Title
                order={1}
                style={{
                  color: 'var(--saffron-bright)',
                  fontSize: '1.6rem',
                  fontFamily: "'Cinzel', serif",
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.4)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.5px',
                }}
              >
                Amrit Vela Toronto
              </Title>
              <Text
                size="xs"
                style={{
                  color: 'var(--saffron-medium)',
                  fontStyle: 'italic',
                  fontWeight: 300,
                  textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
                }}
              >
                Crown your self in the early hours of the morning
              </Text>
            </Stack>
          </Anchor>

          {/* Desktop nav */}
          <Group gap="md" visibleFrom="sm">
            {navLinks.map((link) => (
              <Anchor
                key={link.href}
                component={Link}
                href={link.href}
                underline="never"
                style={{
                  color: 'var(--saffron-bright)',
                  fontSize: '0.95rem',
                  padding: '0.7rem 1.2rem',
                  borderRadius: '12px',
                  background: 'rgba(244, 196, 48, 0.15)',
                  border: '1px solid rgba(244, 196, 48, 0.4)',
                  backdropFilter: 'blur(10px)',
                  fontFamily: "'Lora', serif",
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 196, 48, 0.25)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(244, 196, 48, 0.4)';
                  e.currentTarget.style.borderColor = 'var(--saffron-bright)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 196, 48, 0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(244, 196, 48, 0.4)';
                }}
              >
                {link.label}
              </Anchor>
            ))}
          </Group>

          {/* Mobile burger */}
          <Burger
            opened={opened}
            onClick={toggle}
            color="var(--saffron-bright)"
            hiddenFrom="sm"
            size="sm"
          />
        </Group>
      </Container>

      {/* Mobile drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        title="Menu"
        position="right"
        size="xs"
        styles={{
          header: { 
            background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)', 
            color: 'var(--saffron-bright)',
            borderBottom: '1px solid rgba(244, 196, 48, 0.2)'
          },
          body: { 
            background: 'linear-gradient(135deg, var(--charcoal) 0%, #2C3E50 100%)',
            padding: '20px'
          },
          close: { color: 'var(--saffron-bright)' },
        }}
      >
        <Stack gap="md" pt="md">
          {navLinks.map((link) => (
            <Anchor
              key={link.href}
              component={Link}
              href={link.href}
              underline="never"
              onClick={close}
              style={{
                color: 'var(--saffron-bright)',
                fontSize: '1.1rem',
                fontFamily: "'Lora', serif",
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(244, 196, 48, 0.1)',
                border: '1px solid rgba(244, 196, 48, 0.2)',
                fontWeight: 500,
              }}
            >
              {link.label}
            </Anchor>
          ))}
        </Stack>
      </Drawer>
    </Box>
  );
}
