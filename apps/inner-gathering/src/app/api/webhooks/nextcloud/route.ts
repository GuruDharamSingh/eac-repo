/**
 * Nextcloud Webhook Handler
 *
 * Receives webhook events from Nextcloud and stores them for processing
 *
 * Configure in Nextcloud:
 * - Install Workflow app
 * - Create webhook for events (poll votes, calendar changes, etc.)
 * - Point to: https://your-domain.com/api/webhooks/nextcloud
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeNextcloudEvent, processNextcloudEvent, type NextcloudEvent } from '@elkdonis/services';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity (optional but recommended)
    const webhookSecret = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.NEXTCLOUD_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.warn('Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const payload = await request.json();

    // Extract event data
    const event: NextcloudEvent = {
      type: payload.event || payload.type,
      nextcloudId: payload.id || payload.objectId,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      data: payload.data || payload,
    };

    // Store event for processing
    const eventId = await storeNextcloudEvent(event);

    // Process immediately (for critical events) or queue for background processing
    const shouldProcessImmediately = [
      'poll.voted',
      'calendar.created',
      'calendar.updated',
      'talk.recording_ready',
    ].includes(event.type);

    if (shouldProcessImmediately) {
      try {
        await processNextcloudEvent(eventId);
      } catch (error) {
        console.error('Failed to process event immediately:', error);
        // Event is stored, will be processed by background worker
      }
    }

    return NextResponse.json({
      success: true,
      eventId,
      processed: shouldProcessImmediately,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check webhook status
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Nextcloud webhook endpoint is active',
    configuration: {
      hasSecret: !!process.env.NEXTCLOUD_WEBHOOK_SECRET,
      nextcloudUrl: process.env.NEXT_PUBLIC_NEXTCLOUD_URL,
    },
  });
}
