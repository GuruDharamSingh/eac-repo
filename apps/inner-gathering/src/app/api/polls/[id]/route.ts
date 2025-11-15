/**
 * Individual Poll API Routes
 * GET /api/polls/[id] - Get poll details with options
 * DELETE /api/polls/[id] - Delete a poll
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNextcloudClient, getPoll, getPollOptions, deletePoll } from '@elkdonis/nextcloud';
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

    // Fetch poll and options from Nextcloud
    const [poll, options] = await Promise.all([
      getPoll(client, pollId),
      getPollOptions(client, pollId),
    ]);

    return NextResponse.json({ poll, options });
  } catch (error) {
    console.error('Failed to fetch poll:', error);
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

    // Delete the poll in Nextcloud
    await deletePoll(client, pollId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete poll:', error);
    return NextResponse.json(
      { error: 'Failed to delete poll' },
      { status: 500 }
    );
  }
}
