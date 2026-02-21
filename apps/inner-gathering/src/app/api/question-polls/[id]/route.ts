/**
 * Individual Question Poll API Routes
 * GET /api/question-polls/[id] - Get poll with options and vote counts
 * DELETE /api/question-polls/[id] - Delete a poll (creator only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import {
  getQuestionPollById,
  getUserVotes,
  deleteQuestionPoll,
} from '@elkdonis/services';

export async function GET(
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

    // Get user's votes for this poll
    const userVotes = await getUserVotes(id, session.user.id);

    return NextResponse.json({ poll, userVotes });
  } catch (error) {
    console.error('Failed to fetch question poll:', error);
    return NextResponse.json(
      { error: 'Failed to fetch poll' },
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

    const poll = await getQuestionPollById(id);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    if (poll.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteQuestionPoll(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete question poll:', error);
    return NextResponse.json(
      { error: 'Failed to delete poll' },
      { status: 500 }
    );
  }
}
