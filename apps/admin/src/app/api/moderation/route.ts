import { NextRequest, NextResponse } from 'next/server';
import { Events } from '@elkdonis/db/events';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * Admin Moderation API
 *
 * Handles all admin moderation actions:
 * - Hide/unhide content from forum
 * - Pin/unpin content
 * - Lock/unlock threads
 * - Override visibility settings
 */

export async function POST(request: NextRequest) {
  try {
    // Auth check - derive userId from session, not request body
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUserId = session.user.id;
    const dbUserId = session.user.db_user_id ?? authUserId;

    // Check if user is admin
    if (!(await isAdmin(authUserId))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, resourceType, resourceId, reason, newVisibility } = body;

    // Validate resource type
    if (resourceType !== 'post' && resourceType !== 'meeting') {
      return NextResponse.json(
        { error: 'Invalid resource type' },
        { status: 400 }
      );
    }

    // Execute the action
    switch (action) {
      case 'hide':
        await Events.hideContent(resourceType, resourceId, dbUserId, reason);
        break;

      case 'unhide':
        await Events.unhideContent(resourceType, resourceId, dbUserId);
        break;

      case 'pin':
        await Events.pinContent(resourceType, resourceId, dbUserId);
        break;

      case 'unpin':
        await Events.unpinContent(resourceType, resourceId, dbUserId);
        break;

      case 'lock':
        await Events.lockContent(resourceType, resourceId, dbUserId, reason);
        break;

      case 'unlock':
        await Events.unlockContent(resourceType, resourceId, dbUserId);
        break;

      case 'override_visibility':
        if (!newVisibility) {
          return NextResponse.json(
            { error: 'newVisibility required for override_visibility action' },
            { status: 400 }
          );
        }
        await Events.overrideVisibility(
          resourceType,
          resourceId,
          newVisibility,
          dbUserId,
          reason
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      resourceType,
      resourceId
    });

  } catch (error: any) {
    console.error('Moderation action failed:', error);
    return NextResponse.json(
      { error: error.message || 'Moderation action failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/moderation - Get recent moderation actions
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check - derive userId from session, not query params
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get moderation events
    const events = await Events.getAllEvents({
      limit,
      action: 'content_hidden' as any // Filter for moderation actions
    });

    return NextResponse.json({ events });

  } catch (error: any) {
    console.error('Failed to fetch moderation events:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
