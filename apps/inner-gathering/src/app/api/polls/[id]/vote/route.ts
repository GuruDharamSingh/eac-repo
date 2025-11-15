/**
 * Poll Voting API Routes
 * POST /api/polls/[id]/vote - Submit votes for poll options
 * GET /api/polls/[id]/vote - Get current votes and results
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createNextcloudClient,
  setVote,
  getAvailabilityResults,
} from '@elkdonis/nextcloud';
import { getServerSession } from '@elkdonis/auth-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pollId = parseInt(id, 10);

    if (isNaN(pollId)) {
      return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
    }

    // Get authenticated user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Nextcloud client for this user
    const client = createNextcloudClient({
      baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
      username: session.user.nextcloud_user_id,
      password: session.user.nextcloud_app_password,
    });

    // Get aggregated results
    const results = await getAvailabilityResults(client, pollId);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Failed to fetch poll results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch poll results' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pollId = parseInt(id, 10);

    if (isNaN(pollId)) {
      return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
    }

    // Get authenticated user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { votes } = body; // Array of { optionId: number, answer: 'yes' | 'no' | 'maybe' }

    if (!votes || !Array.isArray(votes)) {
      return NextResponse.json(
        { error: 'Missing required field: votes' },
        { status: 400 }
      );
    }

    // Create Nextcloud client for this user
    const client = createNextcloudClient({
      baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
      username: session.user.nextcloud_user_id,
      password: session.user.nextcloud_app_password,
    });

    // Submit all votes to Nextcloud
    const results = await Promise.all(
      votes.map(
        (vote: { optionId: number; answer: 'yes' | 'no' | 'maybe' }) =>
          setVote(client, pollId, vote.optionId, vote.answer)
      )
    );

    return NextResponse.json({ votes: results });
  } catch (error) {
    console.error('Failed to submit votes:', error);
    return NextResponse.json(
      { error: 'Failed to submit votes' },
      { status: 500 }
    );
  }
}
