import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { createNextcloudClient, ensureCalendarExists, createCalendarEvent } from '@elkdonis/nextcloud';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to test calendar sync
 * GET /api/debug/calendar - Test calendar creation and event sync
 * Restricted to development mode and admin users only.
 */
export async function GET(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  console.log('[Calendar Debug] Starting calendar sync test');

  try {
    // 1. Get the current user session
    const session = await getServerSession();

    if (!session.user) {
      return NextResponse.json(
        { error: 'Not authenticated', details: 'No user session found' },
        { status: 401 }
      );
    }

    // Require admin role
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[Calendar Debug] User: ${session.user.email}`);
    console.log(`[Calendar Debug] Nextcloud User ID: ${session.user.nextcloud_user_id}`);

    // Check if user has Nextcloud credentials
    if (!session.user.nextcloud_user_id || !session.user.nextcloud_app_password) {
      return NextResponse.json(
        {
          error: 'No Nextcloud credentials',
          details: 'User has not been provisioned in Nextcloud. Use the sync feature first.',
          user: {
            id: session.user.id,
            email: session.user.email,
            hasNextcloudUserId: !!session.user.nextcloud_user_id,
            hasNextcloudPassword: !!session.user.nextcloud_app_password,
          }
        },
        { status: 400 }
      );
    }

    // 2. Create Nextcloud client with user credentials
    const nextcloudUrl = process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80';
    console.log(`[Calendar Debug] Nextcloud URL: ${nextcloudUrl}`);

    const client = createNextcloudClient({
      baseUrl: nextcloudUrl,
      username: session.user.nextcloud_user_id,
      password: session.user.nextcloud_app_password,
    });

    // 3. Test: Ensure calendar exists
    console.log('[Calendar Debug] Testing ensureCalendarExists...');
    await ensureCalendarExists(client);
    console.log('[Calendar Debug] Calendar ensured');

    // 4. Test: Create a test event
    console.log('[Calendar Debug] Testing createCalendarEvent...');
    const testEvent = await createCalendarEvent(client, {
      summary: 'EAC Calendar Test Event',
      description: 'This is a test event created by the calendar debug endpoint. It can be safely deleted.',
      start: new Date(),
      end: new Date(Date.now() + 3600000), // 1 hour from now
      location: 'Debug Test Location',
    });

    console.log(`[Calendar Debug] Event created: ${testEvent.id}`);
    console.log(`[Calendar Debug] Event URL: ${testEvent.url}`);

    return NextResponse.json({
      success: true,
      message: 'Calendar sync test completed successfully',
      details: {
        calendarCreated: true,
        testEventCreated: true,
        eventId: testEvent.id,
      },
      instructions: [
        'Open Nextcloud and log in',
        'Go to the Calendar app',
        'Look for the "EAC Meetings" calendar',
        'You should see the test event: "EAC Calendar Test Event"',
      ],
    });

  } catch (error: any) {
    console.error('[Calendar Debug] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        response: error.response?.data,
        status: error.response?.status,
      },
      { status: 500 }
    );
  }
}
