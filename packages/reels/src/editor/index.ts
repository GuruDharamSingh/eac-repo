import * as React from 'react';
import type { StudioExtension } from '@elkdonis/studio/frame';
import { VideoKind } from './VideoKind';
import type { VideoKindProps } from './types';

export { VideoKind };
export { LiveCard } from './LiveCard';
export type { LiveCardProps } from './LiveCard';
export { RelayPanel } from './RelayPanel';
export { RelayFeeds } from './RelayFeeds';
export { RelayChat } from './RelayChat';
export type { RelayChatProps } from './RelayChat';
export type { RelayFeedsProps } from './RelayFeeds';
export type * from './relay-types';
export type * from './types';

/** The Video kind, for a host's StudioShell `extensions`. */
export function videoExtension(props: VideoKindProps): StudioExtension {
  return {
    id: 'video',
    label: 'Video',
    listLabel: 'Reels',
    render: () => React.createElement(VideoKind, props),
    // "Live" leads to the Go live card, which the host passes only to viewers who may go live (2026-11-12).
    newEntries: props.broadcast ? [{ id: 'live', label: 'Live', as: 'live' }] : undefined,
  };
}
