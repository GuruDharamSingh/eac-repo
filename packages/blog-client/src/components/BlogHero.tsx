import { Box, Button, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import type { BlogHeroConfig } from '../types';

interface BlogHeroProps {
  hero?: BlogHeroConfig;
  isOwner?: boolean;
}

export function BlogHero({ hero, isOwner = false }: BlogHeroProps) {
  if (!hero) return null;

  // Check if CTA should be shown
  const showCta = hero.ctaHref && hero.ctaLabel && (!hero.ctaOwnerOnly || isOwner);

  return (
    <Paper withBorder radius="lg" p="xl" shadow="sm">
      <Stack gap="md">
        <Title order={2}>{hero.title}</Title>
        {hero.description ? (
          <Text size="md" c="dimmed">
            {hero.description}
          </Text>
        ) : null}
        {showCta ? (
          <Box>
            <Button component={Link} href={hero.ctaHref!}>
              {hero.ctaLabel}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
