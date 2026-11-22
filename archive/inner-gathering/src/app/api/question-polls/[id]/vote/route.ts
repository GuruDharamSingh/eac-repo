/**
 * Question Poll Voting API Routes
 * POST /api/question-polls/[id]/vote - Cast a vote
 * DELETE /api/question-polls/[id]/vote - Retract a vote
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import {
  getQuestionPollById,
  voteOnPoll,
  unvoteOnPoll,
  getUserVotes,
} from '@elkdonis/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const poll = await getQuestionPollById(id);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    if (poll.status !== 'open') {
      return NextResponse.json(
        { error: 'Poll is closed for voting' },
        { status: 400 }
      );
    }

    if (poll.deadline && new Date(poll.deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Poll deadline has passed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { optionId } = body;

    if (!optionId) {
      return NextResponse.json(
        { error: 'optionId is required' },
        { status: 400 }
      );
    }

    // Verify option belongs to this poll
    const validOption = poll.options.find((o) => o.id === optionId);
    if (!validOption) {
      return NextResponse.json(
        { error: 'Invalid option for this poll' },
        { status: 400 }
      );
    }

    await voteOnPoll(id, optionId, session.user.id);

    // Return updated poll and user votes
    const updatedPoll = await getQuestionPollById(id);
    const userVotes = await getUserVotes(id, session.user.id);

    return NextResponse.json({ poll: updatedPoll, userVotes });
  } catch (error) {
    console.error('Failed to cast vote:', error);
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { optionId } = body;

    if (!optionId) {
      return NextResponse.json(
        { error: 'optionId is required' },
        { status: 400 }
      );
    }

    await unvoteOnPoll(id, optionId, session.user.id);

    const updatedPoll = await getQuestionPollById(id);
    const userVotes = await getUserVotes(id, session.user.id);

    return NextResponse.json({ poll: updatedPoll, userVotes });
  } catch (error) {
    console.error('Failed to retract vote:', error);
    return NextResponse.json(
      { error: 'Failed to retract vote' },
      { status: 500 }
    );
  }
}
