'use client';

import { useState, useEffect } from 'react';
import { Box, Container, Stack, Title, Text, Loader, Center } from '@mantine/core';
import { CountdownWidget } from '@/components/countdown-widget';
import { LiveVideoPlayer } from '@/components/live-video-player';
import { VideoPlaylist, type LiveVideo } from '@/components/video-playlist';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  talkToken: string;
  location?: string;
  description?: string;
}

interface LiveFeedData {
  status: 'active' | 'upcoming' | 'none';
  meeting: Meeting | null;
}

export default function LivePage() {
  const [data, setData] = useState<LiveFeedData | null>(null);
  const [videos, setVideos] = useState<LiveVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveFeed = async () => {
    try {
      const [feedRes, videosRes] = await Promise.all([
        fetch('/api/live/current'),
        fetch('/api/live/videos'),
      ]);
      if (!feedRes.ok) throw new Error('Failed to fetch live feed data');
      const feedResult = await feedRes.json();
      const videosResult = videosRes.ok ? await videosRes.json() : { videos: [] };
      setData(feedResult);
      setVideos(videosResult.videos ?? []);
      setError(null);
    } catch (err) {
      console.error('Error fetching live feed:', err);
      setError('Failed to load live feed. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLiveFeed();

    // Poll every 30 seconds
    const interval = setInterval(fetchLiveFeed, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box className="archive-shell">
      <Container size="lg" py="xl">
        <Center style={{ minHeight: '400px' }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="archive" />
            <Text className="archive-muted">Tuning the live signal...</Text>
          </Stack>
        </Center>
      </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="archive-shell">
      <Container size="lg" py="xl">
        <Text c="red">{error}</Text>
      </Container>
      </Box>
    );
  }

  return (
    <Box className="archive-shell">
    <Container size="lg" py="xl" pb={128}>
      <Stack gap="xl">
        <div className="archive-page-header">
          <Text className="archive-kicker">Signal room</Text>
          <Title order={1} className="archive-title">Live Video Feed</Title>
          <Text className="archive-muted" mt="sm">
            Watch live meetings or see when the next signal begins
          </Text>
        </div>

        {data?.status === 'active' && data.meeting && (
          <LiveVideoPlayer meeting={data.meeting} />
        )}

        {data?.status === 'upcoming' && data.meeting && (
          <>
            <CountdownWidget meeting={data.meeting} />
            <VideoPlaylist videos={videos} />
          </>
        )}

        {data?.status === 'none' && (
          <VideoPlaylist videos={videos} />
        )}
      </Stack>
    </Container>
    </Box>
  );
}
