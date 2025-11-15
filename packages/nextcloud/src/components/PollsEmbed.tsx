/**
 * Nextcloud Polls Embed Component
 * Specialized wrapper for embedding Nextcloud Polls app
 */

'use client';

import React from 'react';
import { NextcloudEmbed } from './NextcloudEmbed';

export interface PollsEmbedProps {
  /** Nextcloud base URL */
  baseUrl: string;
  /** Specific poll ID to show (optional) */
  pollId?: number;
  /** View mode: 'list' or 'poll' */
  view?: 'list' | 'poll';
  /** Container className */
  className?: string;
  /** Height of the iframe */
  height?: string | number;
  /** Callback when poll is voted on */
  onVoted?: (pollId: number) => void;
}

/**
 * Embed Nextcloud Polls app
 *
 * Shows either:
 * - List of all polls (default)
 * - Specific poll if pollId provided
 *
 * Usage:
 * ```tsx
 * // Show all polls
 * <PollsEmbed />
 *
 * // Show specific poll
 * <PollsEmbed pollId={123} />
 * ```
 */
export function PollsEmbed({
  baseUrl,
  pollId,
  view = 'list',
  className,
  height = '700px',
  onVoted,
}: PollsEmbedProps) {
  // Build app path based on view
  const appPath = pollId
    ? `/apps/polls/poll/${pollId}`
    : '/apps/polls';

  // Handle messages from iframe (for detecting poll votes)
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin matches Nextcloud URL
      if (!baseUrl || !event.origin.startsWith(baseUrl)) {
        return;
      }

      // Handle poll vote events
      if (event.data?.type === 'poll-voted' && event.data?.pollId) {
        onVoted?.(event.data.pollId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [baseUrl, onVoted]);

  return (
    <NextcloudEmbed
      baseUrl={baseUrl}
      appPath={appPath}
      title={pollId ? `Poll ${pollId}` : 'Polls'}
      className={className}
      height={height}
    />
  );
}

/**
 * Embed a specific poll by ID
 */
export function PollEmbed({
  baseUrl,
  pollId,
  className,
  height = '600px',
  onVoted,
}: Omit<PollsEmbedProps, 'view'> & { pollId: number }) {
  return (
    <PollsEmbed
      baseUrl={baseUrl}
      pollId={pollId}
      view="poll"
      className={className}
      height={height}
      onVoted={onVoted}
    />
  );
}
