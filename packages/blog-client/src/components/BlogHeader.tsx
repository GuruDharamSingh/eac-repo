import Link from 'next/link';
import { Group, Stack, Text, Title, Button } from '@mantine/core';
import type { BlogConfig } from '../types';

interface BlogHeaderProps {
  config: BlogConfig;
  isOwner?: boolean; // Whether current user is authenticated owner
}

export function BlogHeader({ config, isOwner = false }: BlogHeaderProps) {
  const { orgName, tagline, navLinks = [], hero } = config;

  // Filter nav links based on owner status
  const visibleNavLinks = navLinks.filter(link => !link.ownerOnly || isOwner);

  // Check if CTA should be shown
  const showCta = hero?.ctaHref && hero?.ctaLabel && (!hero.ctaOwnerOnly || isOwner);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <Stack gap={4} style={{ flex: 1 }}>
          <Title order={1} size="h2">
            {orgName}
          </Title>
          {tagline ? (
            <Text size="sm" c="dimmed">
              {tagline}
            </Text>
          ) : null}
        </Stack>

        <Group gap="lg">
          {visibleNavLinks.map((link) =>
            link.external ? (
              <Text
                key={link.href}
                component="a"
                href={link.href}
                target="_blank"
                rel="noreferrer"
                c="blue"
              >
                {link.label}
              </Text>
            ) : (
              <Text key={link.href} component={Link} href={link.href} c="blue">
                {link.label}
              </Text>
            )
          )}
          {showCta ? (
            <Button component={Link} href={hero!.ctaHref!} variant="light">
              {hero!.ctaLabel}
            </Button>
          ) : null}
        </Group>
      </div>
    </header>
  );
}
