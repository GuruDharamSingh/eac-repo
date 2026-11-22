/**
 * Polls API Routes
 * GET /api/polls - List all polls for organization
 * POST /api/polls - Create a new availability poll
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import {
  createAvailabilityPoll,
  getPollsByOrg,
} from '@elkdonis/services';

const ORG_ID = 'elkdonis'; // inner-gathering org

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const polls = await getPollsByOrg(ORG_ID, { status: 'open' });

    return NextResponse.json({ polls });
  } catch (error) {
    console.error('Failed to fetch polls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch polls' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      startDate,
      endDate,
      earliestTime = '09:00',
      latestTime = '21:00',
      timeSlotDuration = 30,
      allowMaybe = true,
      deadline,
    } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startDate, endDate' },
        { status: 400 }
      );
    }

    const poll = await createAvailabilityPoll({
      org_id: ORG_ID,
      creator_id: session.user.id,
      title,
      description,
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      earliest_time: earliestTime,
      latest_time: latestTime,
      time_slot_duration: timeSlotDuration,
      allow_maybe: allowMaybe,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    return NextResponse.json({ poll });
  } catch (error) {
    console.error('Failed to create poll:', error);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
