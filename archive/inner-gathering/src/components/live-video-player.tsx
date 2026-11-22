'use client';

import { Card, Stack, Text, Title, Badge, Box } from '@mantine/core';
import { Circle } from 'lucide-react';
import { TalkEmbed } from '@elkdonis/nextcloud/components';

interface LiveVideoPlayerProps {
  meeting: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    talkToken: string;
    location?: string;
  };
}

export function LiveVideoPlayer({ meeting }: LiveVideoPlayerProps) {
  return (
    <Card shadow="sm" padding="lg" radius="sm" withBorder className="archive-card-dark">
      <Stack gap="md">
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title order={3} style={{ color: '#fff8ec' }}>{meeting.title}</Title>
          <Badge
            color="red"
            size="lg"
            leftSection={
              <Circle
                size={12}
                fill="currentColor"
                style={{
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            }
          >
            LIVE
          </Badge>
        </Box>

        {meeting.location && (
          <Text size="sm">
            <strong>Location:</strong> {meeting.location}
          </Text>
        )}

        <Text size="sm" c="dimmed">
          Started:{' '}
          {new Date(meeting.startTime).toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          • Ends:{' '}
          {new Date(meeting.endTime).toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>

        <Box
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%', // 16:9 aspect ratio
            overflow: 'hidden',
            borderRadius: '8px',
          }}
        >
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <TalkEmbed roomToken={meeting.talkToken} />
          </Box>
        </Box>
      </Stack>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </Card>
  );
}
