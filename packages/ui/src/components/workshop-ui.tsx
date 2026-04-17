"use client";

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Text,
  Title,
  Avatar,
  Group,
  Stack,
  Collapse,
  UnstyledButton,
  ThemeIcon,
  Button,
  Transition,
  rem,
  Divider,
} from '@mantine/core';
import { 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  Play, 
  FileText, 
  Link as LinkIcon, 
  Video, 
  MapPin, 
  Clock, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { useWindowScroll } from '@mantine/hooks';

/* -------------------------------------------------------------------------- */
/*                                DigitalFlyer                                */
/* -------------------------------------------------------------------------- */

interface DigitalFlyerProps {
  src?: string;
  alt: string;
  children?: React.ReactNode;
}

export function DigitalFlyer({ src, alt, children }: DigitalFlyerProps) {
  return (
    <Box pos="relative">
      <Paper
        shadow="xl"
        radius="lg"
        withBorder
        style={{
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-gray-0)',
          borderColor: 'var(--mantine-color-gray-3)',
          borderWidth: rem(2),
        }}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              maxHeight: rem(600),
              objectFit: 'contain',
            }}
          />
        ) : (
          <Box 
            h={300} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'linear-gradient(45deg, var(--mantine-color-gray-1) 0%, var(--mantine-color-gray-2) 100%)'
            }}
          >
            <Text c="dimmed" fs="italic">No Flyer Image</Text>
          </Box>
        )}
      </Paper>
      {children}
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 GuideBadge                                 */
/* -------------------------------------------------------------------------- */

interface GuideBadgeProps {
  name: string;
  avatarUrl?: string;
  role?: string;
}

export function GuideBadge({ name, avatarUrl, role = 'Guide' }: GuideBadgeProps) {
  return (
    <Paper
      shadow="md"
      radius="xl"
      withBorder
      p={rem(4)}
      pr="md"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 10,
        position: 'absolute',
        top: rem(16),
        right: rem(16),
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <Avatar src={avatarUrl} size="sm" radius="xl" color="indigo">
          {name[0]}
        </Avatar>
        <Stack gap={0}>
          <Text size="xs" fw={700} lh={1}>
            {name}
          </Text>
          <Text size="calc(0.6rem)" c="dimmed" lh={1} tt="uppercase" lts={1}>
            {role}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 ActionCard                                 */
/* -------------------------------------------------------------------------- */

interface Resource {
  id: string;
  title: string;
  type: 'link' | 'pdf' | 'video' | 'audio' | 'other';
  url: string;
  isPublic: boolean;
  description?: string;
}

interface ActionCardProps {
  title: string;
  description?: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  isOnline?: boolean;
  resources?: Resource[];
  isJoined?: boolean;
  order?: number;
}

export function ActionCard({
  title,
  description,
  date,
  time,
  duration,
  location,
  isOnline,
  resources = [],
  isJoined = false,
  order,
}: ActionCardProps) {
  const [opened, setOpened] = useState(false);

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'video': return <Video size={14} />;
      case 'pdf': return <FileText size={14} />;
      case 'link': return <LinkIcon size={14} />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <Paper
      withBorder
      radius="md"
      shadow={opened ? 'md' : 'xs'}
      style={{
        transition: 'all 0.2s ease',
        backgroundColor: opened ? 'var(--mantine-color-gray-0)' : 'white',
        borderLeft: order !== undefined ? `${rem(4)} solid var(--mantine-color-indigo-filled)` : undefined,
      }}
    >
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        p="md"
        w="100%"
        style={{ display: 'block' }}
      >
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Group gap="xs">
              {order !== undefined && (
                <Text size="sm" fw={700} c="indigo">
                  Session {order}
                </Text>
              )}
              <Title order={4} size="h5" style={{ fontFamily: 'var(--mantine-font-family-serif, serif)' }}>
                {title}
              </Title>
            </Group>
            
            <Group gap="md">
              {date && (
                <Group gap={4}>
                  <Calendar size={14} className="text-indigo-600" />
                  <Text size="xs" c="dimmed">{date}</Text>
                </Group>
              )}
              {time && (
                <Group gap={4}>
                  <Clock size={14} className="text-indigo-600" />
                  <Text size="xs" c="dimmed">{time} {duration && `(${duration})`}</Text>
                </Group>
              )}
            </Group>
          </Stack>

          <Box mt={4}>
            {opened ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </Box>
        </Group>
      </UnstyledButton>

      <Collapse in={opened}>
        <Box px="md" pb="md">
          <Divider mb="sm" variant="dotted" />
          
          {description && (
            <Text size="sm" mb="md" style={{ whiteSpace: 'pre-wrap' }}>
              {description}
            </Text>
          )}

          {(location || isOnline) && (
            <Group gap="xs" mb="md">
              <ThemeIcon variant="light" size="sm" radius="xl">
                <MapPin size={12} />
              </ThemeIcon>
              <Text size="xs" fw={500}>
                {isOnline ? 'Online Meeting' : location}
              </Text>
            </Group>
          )}

          {resources.length > 0 && (
            <Stack gap="xs">
              <Text size="xs" fw={700} tt="uppercase" lts={1} c="dimmed">
                Resources
              </Text>
              {resources.map((res) => {
                const isLocked = !res.isPublic && !isJoined;
                return (
                  <Group 
                    key={res.id} 
                    justify="space-between" 
                    p="xs" 
                    style={{ 
                      borderRadius: 'var(--mantine-radius-sm)',
                      backgroundColor: isLocked ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-indigo-light)',
                      border: '1px solid var(--mantine-color-gray-2)',
                      opacity: isLocked ? 0.7 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Group gap="sm">
                      <ThemeIcon variant="transparent" color={isLocked ? 'gray' : 'indigo'} size="sm">
                        {isLocked ? <Lock size={14} /> : getResourceIcon(res.type)}
                      </ThemeIcon>
                      <Stack gap={0}>
                        <Text size="sm" fw={isLocked ? 400 : 600} c={isLocked ? 'dimmed' : undefined}>
                          {res.title}
                        </Text>
                        {res.description && <Text size="xs" c="dimmed">{res.description}</Text>}
                      </Stack>
                    </Group>
                    
                    {!isLocked && (
                      <Button variant="subtle" size="compact-xs" rightSection={<Play size={10} />}>
                        Access
                      </Button>
                    )}
                  </Group>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

/* -------------------------------------------------------------------------- */
/*                              StickyBottomBar                               */
/* -------------------------------------------------------------------------- */

interface StickyBottomBarProps {
  label: string;
  price?: string;
  onAction: () => void;
  showAfterPx?: number;
  isJoined?: boolean;
}

export function StickyBottomBar({ 
  label, 
  price, 
  onAction, 
  showAfterPx = 400,
  isJoined = false 
}: StickyBottomBarProps) {
  const [scroll] = useWindowScroll();
  const visible = scroll.y > showAfterPx;

  return (
    <Transition mounted={visible} transition="slide-up" duration={400} timingFunction="ease">
      {(styles) => (
        <Paper
          shadow="xl"
          p="md"
          withBorder
          style={{
            ...styles,
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: 0,
            borderLeft: 0,
            borderRight: 0,
          }}
        >
          <Box maw={rem(800)} mx="auto">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" fw={700} tt="uppercase" lts={1} c="dimmed">
                  {isJoined ? 'You are enrolled' : 'Limited Spaces'}
                </Text>
                <Title order={4} size="h5">{label}</Title>
              </Stack>
              
              <Group gap="md">
                {price && !isJoined && (
                  <Text fw={700} size="xl" c="indigo">
                    {price}
                  </Text>
                )}
                <Button 
                  size="md" 
                  radius="xl" 
                  onClick={onAction}
                  color={isJoined ? 'teal' : 'indigo'}
                  leftSection={isJoined ? <CheckCircle2 size={18} /> : undefined}
                >
                  {isJoined ? 'Enter Workshop' : 'Join Workshop'}
                </Button>
              </Group>
            </Group>
          </Box>
        </Paper>
      )}
    </Transition>
  );
}
