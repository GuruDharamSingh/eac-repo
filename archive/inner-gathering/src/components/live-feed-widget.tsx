'use client';

import { useState, useEffect } from 'react';
import { Box, Group, Paper, Text, Badge, Skeleton } from '@mantine/core';
import { Clock, Circle, Radio } from 'lucide-react';
import { VideoPlaylist, type LiveVideo } from './video-playlist';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  talkToken: string;
  location?: string;
}

interface LiveFeedData {
  status: 'active' | 'upcoming' | 'none';
  meeting: Meeting | null;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcRemaining(target: string): TimeRemaining {
  const total = new Date(target).getTime() - Date.now();
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    days: Math.floor(total / 86400000),
    hours: Math.floor((total / 3600000) % 24),
    minutes: Math.floor((total / 60000) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function formatCountdown(t: TimeRemaining): string {
  if (t.total <= 0) return 'Starting soon...';
  const parts: string[] = [];
  if (t.days > 0) parts.push(`${t.days}d`);
  if (t.hours > 0) parts.push(`${t.hours}h`);
  if (t.minutes > 0) parts.push(`${t.minutes}m`);
  parts.push(`${t.seconds}s`);
  return parts.join(' ');
}

export function LiveFeedWidget() {
  const [data, setData] = useState<LiveFeedData | null>(null);
  const [videos, setVideos] = useState<LiveVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState<TimeRemaining | null>(null);

  // Fetch live data
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const [feedRes, videosRes] = await Promise.all([
          fetch('/api/live/current'),
          fetch('/api/live/videos'),
        ]);
        if (!active) return;
        const feed = feedRes.ok ? await feedRes.json() : { status: 'none', meeting: null };
        const vids = videosRes.ok ? await videosRes.json() : { videos: [] };
        setData(feed);
        setVideos(vids.videos ?? []);
      } catch {
        // Silently fail - widget is supplementary
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Tick countdown every second when there's an upcoming meeting
  useEffect(() => {
    if (!data?.meeting?.startTime || data.status === 'none') {
      setTime(null);
      return;
    }
    const tick = () => setTime(calcRemaining(data.meeting!.startTime));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  if (loading) {
    return (
      <Paper withBorder radius="sm" p="sm" className="archive-card">
        <Skeleton height={160} radius="sm" />
      </Paper>
    );
  }

  // Nothing to show at all
  if (!data && videos.length === 0) return null;

  const isActive = data?.status === 'active';
  const isUpcoming = data?.status === 'upcoming' && data.meeting;

  const countdownFooter = isUpcoming && time ? (
    <Paper
      radius="sm"
      p="xs"
      style={{
        background: 'rgba(200, 145, 10, 0.12)',
        border: '1px solid rgba(200, 145, 10, 0.32)',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Clock size={14} color="var(--ig-ember)" />
          <Text size="xs" fw={500} truncate>
            {data.meeting!.title}
          </Text>
        </Group>
        <Badge
          variant="light"
          color="archive"
          size="sm"
          style={{ fontFamily: 'monospace', flexShrink: 0 }}
        >
          {formatCountdown(time)}
        </Badge>
      </Group>
    </Paper>
  ) : null;

  const liveBadgeFooter = isActive && data.meeting ? (
    <Paper
      radius="sm"
      p="xs"
      style={{
        background: 'var(--mantine-color-red-0)',
        border: '1px solid var(--mantine-color-red-2)',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Circle
            size={10}
            fill="var(--mantine-color-red-6)"
            color="var(--mantine-color-red-6)"
            style={{ animation: 'pulse 2s ease-in-out infinite', flexShrink: 0 }}
          />
          <Text size="xs" fw={600} c="red.7" truncate>
            LIVE: {data.meeting.title}
          </Text>
        </Group>
        <Badge
          component="a"
          href="/live"
          variant="filled"
          color="red"
          size="sm"
          style={{ cursor: 'pointer', flexShrink: 0 }}
        >
          Watch
        </Badge>
      </Group>
    </Paper>
  ) : null;

  const footer = liveBadgeFooter || countdownFooter;

  return (
    <Paper withBorder radius="sm" p="sm" className="archive-card">
      <Box>
        <Group justify="space-between" mb={6}>
          <Group gap={6}>
            <Radio size={14} color="var(--mantine-color-gray-6)" />
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Live Channel
            </Text>
          </Group>
          {isActive && (
            <Badge color="red" size="xs" variant="dot">
              Live Now
            </Badge>
          )}
        </Group>
        <VideoPlaylist videos={videos} compact footer={footer} />
      </Box>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Paper>
  );
}
