/**
 * Polls API Routes
 * GET /api/polls - List all polls for user
 * POST /api/polls - Create a new availability poll
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, createAvailabilityPoll, getPolls } from '@elkdonis/nextcloud';
import { getServerSession } from '@elkdonis/auth-server';

export async function GET(request: NextRequest) {
  try {
    // Auth check - require logged in user
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin Nextcloud client (user-specific would require nextcloud credentials)
    const client = getAdminClient();

    // Fetch polls from Nextcloud
    const polls = await getPolls(client);

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
    // Auth check - require logged in user
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      timeSlots, // Array of ISO date strings
      allowMaybe = true,
      deadline,
      slotDuration = 30,
    } = body;

    // Validate input
    if (!title || !timeSlots || !Array.isArray(timeSlots)) {
      return NextResponse.json(
        { error: 'Missing required fields: title and timeSlots' },
        { status: 400 }
      );
    }

    // Use admin Nextcloud client
    const client = getAdminClient();

    // Convert time slot strings to Date objects
    const slots = timeSlots.map((slot: string) => new Date(slot));

    // Create the poll in Nextcloud
    const result = await createAvailabilityPoll(client, {
      title,
      description,
      timeSlots: slots,
      allowMaybe,
      deadline: deadline ? new Date(deadline) : undefined,
      slotDuration,
    });

    return NextResponse.json({
      poll: result.poll,
      options: result.options,
    });
  } catch (error) {
    console.error('Failed to create poll:', error);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
