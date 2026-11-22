/**
 * Poll Voting API Routes
 * POST /api/polls/[id]/vote - Submit availability response
 * GET /api/polls/[id]/vote - Get aggregated results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import {
  getPollById,
  getPollSummary,
  submitAvailabilityResponse,
} from '@elkdonis/services';
import type { AvailabilityStatus } from '@elkdonis/types';

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

    const poll = await getPollById(id);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    const summary = await getPollSummary(id);

    return NextResponse.json({ poll, summary });
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

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const poll = await getPollById(id);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    if (poll.status !== 'open') {
      return NextResponse.json(
        { error: 'Poll is closed for voting' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { slots, timezone } = body;

    if (!slots || !Array.isArray(slots) || !timezone) {
      return NextResponse.json(
        { error: 'Missing required fields: slots, timezone' },
        { status: 400 }
      );
    }

    const response = await submitAvailabilityResponse({
      poll_id: id,
      user_id: session.user.id,
      user_name: session.user.email,
      user_email: session.user.email,
      user_timezone: timezone,
      slots: slots.map((slot: { time_slot: string; availability: AvailabilityStatus }) => ({
        time_slot: new Date(slot.time_slot),
        availability: slot.availability,
      })),
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Failed to submit vote:', error);
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
