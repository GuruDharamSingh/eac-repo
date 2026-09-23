'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Group, ActionIcon, Tooltip } from '@mantine/core';
import { EyeOff, Eye, Lock, Unlock, Pin, PinOff } from 'lucide-react';

interface ModerationActionsProps {
  resourceType: 'post' | 'meeting';
  resourceId: string;
}

type ActionKey = 'hide' | 'unhide' | 'pin' | 'unpin' | 'lock' | 'unlock';

export function ModerationActions({ resourceType, resourceId }: ModerationActionsProps) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState<ActionKey | null>(null);

  const run = async (action: ActionKey) => {
    setPending(action);
    try {
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resourceType, resourceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Failed to ${action}`);
        return;
      }
      if (action === 'hide') setHidden(true);
      if (action === 'unhide') setHidden(false);
      if (action === 'pin') setPinned(true);
      if (action === 'unpin') setPinned(false);
      if (action === 'lock') setLocked(true);
      if (action === 'unlock') setLocked(false);
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <Group gap="xs">
      <Tooltip label={hidden ? 'Unhide from forum' : 'Hide from forum'}>
        <ActionIcon
          variant={hidden ? 'filled' : 'subtle'}
          color="orange"
          size="sm"
          loading={pending === 'hide' || pending === 'unhide'}
          onClick={() => run(hidden ? 'unhide' : 'hide')}
        >
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label={pinned ? 'Unpin from forum' : 'Pin to forum'}>
        <ActionIcon
          variant={pinned ? 'filled' : 'subtle'}
          color="blue"
          size="sm"
          loading={pending === 'pin' || pending === 'unpin'}
          onClick={() => run(pinned ? 'unpin' : 'pin')}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label={locked ? 'Unlock thread' : 'Lock thread'}>
        <ActionIcon
          variant={locked ? 'filled' : 'subtle'}
          color="gray"
          size="sm"
          loading={pending === 'lock' || pending === 'unlock'}
          onClick={() => run(locked ? 'unlock' : 'lock')}
        >
          {locked ? <Unlock size={14} /> : <Lock size={14} />}
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
