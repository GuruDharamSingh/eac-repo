'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  Stack,
  Text,
  Title,
  Badge,
  Group,
  ActionIcon,
  Paper,
  ScrollArea,
} from '@mantine/core';
import { SkipBack, SkipForward, Film } from 'lucide-react';

export interface LiveVideo {
  name: string;
  proxyUrl: string;
  size: number;
  lastmod: string;
}

export interface VideoPlaylistProps {
  videos: LiveVideo[];
  /** Render a compact player without the card wrapper, title header, or playlist list */
  compact?: boolean;
  /** Extra content to render below the video (e.g. countdown timer) */
  footer?: React.ReactNode;
}

function formatName(filename: string): string {
  return filename
    .replace(/\.(mp4|webm|mov)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VideoPlaylist({ videos, compact = false, footer }: VideoPlaylistProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    video.play().catch(() => {});
  }, [currentIndex]);

  if (videos.length === 0) {
    if (compact) return null;
    return (
      <Card shadow="sm" padding="lg" radius="sm" withBorder className="archive-card">
        <Stack align="center" gap="md" py="xl">
          <Film size={48} opacity={0.3} />
          <Text c="dimmed" ta="center">
            No videos available.
          </Text>
        </Stack>
      </Card>
    );
  }

  const current = videos[currentIndex];
  const goTo = (index: number) => setCurrentIndex(index);
  const prev = () => goTo((currentIndex - 1 + videos.length) % videos.length);
  const next = () => goTo((currentIndex + 1) % videos.length);

  const videoElement = (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%',
        borderRadius: compact ? 6 : 8,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <video
        ref={videoRef}
        src={current.proxyUrl}
        controls
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        onEnded={next}
      />
    </Box>
  );

  if (compact) {
    return (
      <Stack gap="xs">
        {videoElement}
        <Group justify="space-between" px={2}>
          <Text size="xs" fw={500} truncate style={{ flex: 1 }}>
            {formatName(current.name)}
          </Text>
          <Group gap={4}>
            <ActionIcon variant="subtle" size="sm" onClick={prev} aria-label="Previous video">
              <SkipBack size={14} />
            </ActionIcon>
            <Text size="xs" c="dimmed">
              {currentIndex + 1}/{videos.length}
            </Text>
            <ActionIcon variant="subtle" size="sm" onClick={next} aria-label="Next video">
              <SkipForward size={14} />
            </ActionIcon>
          </Group>
        </Group>
        {footer}
      </Stack>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="sm" withBorder className="archive-card">
      <Stack gap="md">
        <Group justify="space-between">
          <Box>
            <Title order={3}>{formatName(current.name)}</Title>
            <Text size="xs" c="dimmed">
              {currentIndex + 1} / {videos.length}
            </Text>
          </Box>
          <Badge color="archive" size="lg" leftSection={<Film size={12} />}>
            VIDEO
          </Badge>
        </Group>

        {videoElement}

        <Group justify="center" gap="md">
          <ActionIcon variant="default" size="lg" onClick={prev} aria-label="Previous video">
            <SkipBack size={18} />
          </ActionIcon>
          <ActionIcon variant="default" size="lg" onClick={next} aria-label="Next video">
            <SkipForward size={18} />
          </ActionIcon>
        </Group>

        {videos.length > 1 && (
          <ScrollArea.Autosize mah={220}>
            <Stack gap={4}>
              {videos.map((video, index) => (
                <Paper
                  key={video.name}
                  p="xs"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    borderColor: index === currentIndex ? 'var(--ig-gold)' : undefined,
                    background:
                      index === currentIndex ? 'rgba(200, 145, 10, 0.12)' : undefined,
                  }}
                  onClick={() => goTo(index)}
                >
                  <Group gap="xs">
                    <Film size={14} opacity={0.6} />
                    <Text size="sm" fw={index === currentIndex ? 600 : 400} truncate>
                      {formatName(video.name)}
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        {footer}
      </Stack>
    </Card>
  );
}
