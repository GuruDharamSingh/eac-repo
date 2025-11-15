/**
 * Individual Poll Page
 * Uses custom UI with Nextcloud Polls API backend (hybrid approach)
 */

import { use } from 'react';
import { PollVoting } from '@/components/poll-voting';

export default function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Poll Voting - Custom UI using Nextcloud API */}
      <PollVoting pollId={id} />
    </div>
  );
}
