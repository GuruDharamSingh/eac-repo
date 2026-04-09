'use client';

import { useState, useEffect } from 'react';
import { Container, Stack, Title, Text, Loader, Center, Alert } from '@mantine/core';
import { Info } from 'lucide-react';
import { CountdownWidget } from '@/components/countdown-widget';
import { LiveVideoPlayer } from '@/components/live-video-player';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveFeed = async () => {
    try {
      const response = await fetch('/api/live/current');
      if (!response.ok) {
        throw new Error('Failed to fetch live feed data');
      }
      const result = await response.json();
      setData(result);
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
      <Container size="lg" py="xl">
        <Center style={{ minHeight: '400px' }}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Loading live feed...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<Info size={16} />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1}>Live Video Feed</Title>
          <Text c="dimmed" mt="sm">
            Watch live meetings or see when the next one starts
          </Text>
        </div>

        {data?.status === 'active' && data.meeting && (
          <LiveVideoPlayer meeting={data.meeting} />
        )}

        {data?.status === 'upcoming' && data.meeting && (
          <CountdownWidget meeting={data.meeting} />
        )}

        {data?.status === 'none' && (
          <Alert icon={<Info size={16} />} title="No Meetings Scheduled" color="blue">
            There are currently no live meetings or upcoming meetings scheduled.
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
