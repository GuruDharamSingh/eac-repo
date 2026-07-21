"use client";

import React from 'react';
import { 
  Container, 
  Stack, 
  Title, 
  Text, 
  Box, 
  Paper, 
  TypographyStylesProvider,
  Divider,
  Group
} from '@mantine/core';
import {
  DigitalFlyer,
  GuideBadge,
  ActionCard,
  StickyBottomBar
} from '@elkdonis/ui';
import { Button, ThemeIcon } from '@mantine/core';
import { MessageCircle, FileText } from 'lucide-react';
import type { Workshop, Meeting, WorkshopSession, WorkshopResource } from '@elkdonis/types';
import { sanitizeRichText } from '@elkdonis/utils';
import { CommentSection } from './comment-section';
import { CycleHistory } from './cycle-history';

interface GatheringDetailsProps {
  gathering: Workshop | Meeting;
  type: 'workshop' | 'meeting' | 'event';
  isJoined?: boolean;
  currentUser?: {
    id: string;
    displayName: string | null;
    initials: string | null;
  } | null;
  replies?: any[];
}

export function GatheringDetails({ 
  gathering, 
  type,
  isJoined = false, 
  currentUser,
  replies = []
}: GatheringDetailsProps) {
  
  const handleJoin = () => {
    // Logic for joining/RSVP would go here
    console.log('Join clicked');
  };

  const formatDate = (date: Date) => 
    new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(new Date(date));

  const formatTime = (date: Date) => 
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    }).format(new Date(date));

  const isWorkshop = type === 'workshop';
  const asMeeting = gathering as Meeting;
  const asWorkshop = gathering as Workshop;
  const sessions = asWorkshop.sessions || [];
  const flyerUrl = isWorkshop ? asWorkshop.flyerImage?.url : asMeeting.coverImage?.url;

  return (
    <Box pb={100} style={{ backgroundColor: 'var(--mantine-color-gray-0)', minHeight: '100vh' }}>
      <Container size="sm" py="xl">
        <Stack gap="xl">
          {/* Header & Flyer */}
          <Box pos="relative">
            <DigitalFlyer 
              src={flyerUrl} 
              alt={gathering.title}
            />
            {(isWorkshop ? asWorkshop.guide : (asMeeting.guide || asMeeting.creator)) && (
              <GuideBadge
                name={(isWorkshop
                  ? asWorkshop.guide?.displayName
                  : (asMeeting.guide?.displayName || asMeeting.creator?.displayName)
                ) || 'Unknown Guide'}
                avatarUrl={isWorkshop
                  ? asWorkshop.guide?.avatarUrl
                  : (asMeeting.guide?.avatarUrl || asMeeting.creator?.avatarUrl)
                }
              />
            )}
          </Box>

          {/* Title & Stats */}
          <Stack gap="xs" align="center" ta="center">
            <Title 
              order={1} 
              size="h2" 
              style={{ 
                fontFamily: 'var(--mantine-font-family-serif, serif)',
                fontSize: '2.5rem'
              }}
            >
              {gathering.title}
            </Title>
            <Group gap="xs">
              <Text size="sm" c="dimmed" fw={500}>
                {gathering.organization?.name || 'InnerGathering'}
              </Text>
              <Text size="sm" c="dimmed">•</Text>
              <Text size="sm" c="dimmed">
                {gathering.attendeeCount || 0} participants
              </Text>
            </Group>
          </Stack>

          {/* Date for single events */}
          {!isWorkshop && asMeeting.scheduledAt && (
            <Paper p="md" radius="md" withBorder ta="center" bg="white">
              <Text fw={700} size="lg" c="indigo">
                {formatDate(asMeeting.scheduledAt)}
              </Text>
              <Text size="sm" c="dimmed">
                {formatTime(asMeeting.scheduledAt)}
              </Text>
            </Paper>
          )}

          {/* Talk Room / living document — anyone can join the Talk room as a
              guest, no enrollment gate (unlike workshop discussion rooms) */}
          {!isWorkshop && (asMeeting.nextcloudTalkToken || (asMeeting as any).documentUrl) && (
            <Stack gap="sm">
              {asMeeting.nextcloudTalkToken && (
                <Paper withBorder radius="md" p="md" style={{ background: '#f0fdfa', borderColor: '#5eead4' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ThemeIcon color="teal" variant="light" radius="xl" size="lg">
                        <MessageCircle size={18} />
                      </ThemeIcon>
                      <Stack gap={0}>
                        <Text fw={700} size="sm">Talk Room</Text>
                        <Text size="xs" c="dimmed">Join the live video call — no account needed to sit in as a guest</Text>
                      </Stack>
                    </Group>
                    <Button
                      component="a"
                      href={`/api/talk/join?token=${asMeeting.nextcloudTalkToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="filled"
                      color="teal"
                      size="sm"
                      radius="xl"
                      leftSection={<MessageCircle size={14} />}
                    >
                      Join Talk Room
                    </Button>
                  </Group>
                </Paper>
              )}
              {(asMeeting as any).documentUrl && (
                <Paper withBorder radius="md" p="md" style={{ background: '#f0fdfa', borderColor: '#5eead4' }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ThemeIcon color="teal" variant="light" radius="xl" size="lg">
                        <FileText size={18} />
                      </ThemeIcon>
                      <Stack gap={0}>
                        <Text fw={700} size="sm">Living Document</Text>
                        <Text size="xs" c="dimmed">Shared notes for this gathering</Text>
                      </Stack>
                    </Group>
                    <Button
                      component="a"
                      href={(asMeeting as any).documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="filled"
                      color="teal"
                      size="sm"
                      radius="xl"
                      leftSection={<FileText size={14} />}
                    >
                      Open Document
                    </Button>
                  </Group>
                </Paper>
              )}
            </Stack>
          )}

          {/* The Pitch / Description */}
          <Paper p="xl" radius="lg" withBorder shadow="sm" bg="white">
            <TypographyStylesProvider>
              <div 
                style={{ fontSize: '1.1rem', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: sanitizeRichText((gathering as any).pitch || gathering.description || '') }} 
              />
            </TypographyStylesProvider>
          </Paper>

          {/* Sessions Stack (Only for Workshops) */}
          {isWorkshop && sessions.length > 0 && (
            <Stack gap="md">
              <Group justify="space-between" align="flex-end">
                <Stack gap={0}>
                  <Text size="xs" fw={700} tt="uppercase" lts={1} c="indigo">
                    Curriculum
                  </Text>
                  <Title order={3}>Workshop Sessions</Title>
                </Stack>
                <Text size="sm" c="dimmed">
                  {sessions.length} sessions
                </Text>
              </Group>

              <Stack gap="sm">
                {sessions.sort((a, b) => a.orderIndex - b.orderIndex).map((session, index) => (
                  <ActionCard
                    key={session.id}
                    order={index + 1}
                    title={session.title}
                    description={session.description}
                    date={formatDate(session.scheduledAt)}
                    time={formatTime(session.scheduledAt)}
                    duration={session.durationMinutes ? `${session.durationMinutes}m` : undefined}
                    isOnline={session.isOnline}
                    location={session.location}
                    isJoined={isJoined}
                    resources={session.resources}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          {/* Resources for single meetings */}
          {!isWorkshop && asMeeting.media && asMeeting.media.length > 0 && (
            <Stack gap="md">
              <Title order={3} size="h4">Resources</Title>
              <Stack gap="xs">
                {asMeeting.media.map((item) => (
                  <ActionCard
                    key={item.id}
                    title={item.filename || 'Resource'}
                    isJoined={isJoined}
                    resources={[{
                      id: item.id,
                      title: item.filename || 'Download',
                      type: (item.type as any) || 'link',
                      url: item.url,
                      isPublic: false
                    }]}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          {/* Cycle history for recurring meetings */}
          {!isWorkshop && asMeeting.recurrencePattern && asMeeting.recurrencePattern !== 'NONE' && (
            <>
              <Divider my="xl" label="Recurring" labelPosition="center" />
              <CycleHistory meetingId={gathering.id} />
            </>
          )}

          <Divider my="xl" label="Discussion" labelPosition="center" />

          {/* Unified Forum Feed */}
          <CommentSection
            initialReplies={replies}
            meetingId={gathering.id}
            threadKind={type === 'workshop' ? 'workshop' : 'meeting'}
            currentUserId={currentUser?.id ?? null}
            currentUserName={currentUser?.displayName ?? null}
            currentUserInitials={currentUser?.initials ?? null}
          />
        </Stack>
      </Container>

      {/* Persistent CTA */}
      <StickyBottomBar 
        label={gathering.title}
        price={(gathering as any).price ? `$${(gathering as any).price}` : 'Free'}
        isJoined={isJoined}
        onAction={handleJoin}
      />
    </Box>
  );
}
