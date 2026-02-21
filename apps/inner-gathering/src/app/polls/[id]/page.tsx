/**
 * Individual Poll Page
 * Handles both availability polls and question polls
 */

import { use } from 'react';
import { PollVoting } from '@/components/poll-voting';
import { QuestionPollDetail } from '@/components/question-poll-detail';

export default function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = use(params);
  const { type } = use(searchParams);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {type === 'question' ? (
        <QuestionPollDetail pollId={id} />
      ) : (
        <PollVoting pollId={id} />
      )}
    </div>
  );
}
