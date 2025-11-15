/**
 * Calendar Webhook Endpoint
 *
 * Receives notifications from Nextcloud when calendar events are created/updated/deleted
 * Enables bidirectional sync between Nextcloud Calendar and EAC meetings
 *
 * Setup in Nextcloud:
 * 1. Install "Workflow" app
 * 2. Create workflow: "When calendar event changes" → "Make HTTP request" → this endpoint
 * 3. URL: http://inner-gathering:3004/api/webhooks/nextcloud/calendar
 * 4. Method: POST
 * 5. Headers: X-Nextcloud-Webhook-Secret: <secret from env>
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createNextcloudClient } from '@elkdonis/nextcloud';
import { handleCalendarWebhook } from '@elkdonis/services';

export async function POST(request: Request) {
  try {
    // Verify webhook secret for security
    const headersList = headers();
    const webhookSecret = headersList.get('x-nextcloud-webhook-secret');
    const expectedSecret = process.env.NEXTCLOUD_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('NEXTCLOUD_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    if (webhookSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const payload = await request.json();
    console.log('Calendar webhook received:', payload);

    const { event_type, event_id, calendar_id, user_id } = payload;

    if (!event_type || !event_id) {
      return NextResponse.json(
        { error: 'Missing required fields: event_type, event_id' },
        { status: 400 }
      );
    }

    // Create Nextcloud client for the user who owns the calendar
    // If user_id is not provided, use admin client
    let nextcloudClient;

    if (user_id) {
      // Fetch user's Nextcloud credentials from database
      const { db } = await import('@elkdonis/db');
      const [user] = await db`
        SELECT nextcloud_user_id, nextcloud_app_password
        FROM users
        WHERE nextcloud_user_id = ${user_id}
      `;

      if (!user || !user.nextcloud_app_password) {
        console.error(`User not found or no app password: ${user_id}`);
        return NextResponse.json(
          { error: 'User not found or not synced' },
          { status: 404 }
        );
      }

      nextcloudClient = createNextcloudClient({
        baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
        username: user.nextcloud_user_id,
        password: user.nextcloud_app_password,
      });
    } else {
      // Use admin client
      const { getAdminClient } = await import('@elkdonis/nextcloud');
      nextcloudClient = getAdminClient();
    }

    // Process the webhook event
    await handleCalendarWebhook(
      {
        event_type,
        event_id,
        calendar_id,
        user_id,
      },
      nextcloudClient
    );

    return NextResponse.json({
      success: true,
      message: 'Calendar event processed',
      event_id,
    });
  } catch (error) {
    console.error('Calendar webhook error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to verify webhook is configured correctly
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/nextcloud/calendar',
    message: 'Calendar webhook endpoint ready',
    requiredHeaders: ['x-nextcloud-webhook-secret'],
    expectedPayload: {
      event_type: 'calendar.event.created | calendar.event.updated | calendar.event.deleted',
      event_id: 'string (calendar event UID)',
      calendar_id: 'string (optional)',
      user_id: 'string (optional, Nextcloud username)',
    },
  });
}
