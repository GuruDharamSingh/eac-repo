import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

export const dynamic = 'force-dynamic';

interface Meeting {
  id: string;
  title: string;
  scheduled_at: Date;
  duration_minutes: number;
  nextcloud_talk_token: string | null;
  location: string | null;
  description: string | null;
}

export async function GET() {
  try {
    const now = new Date();

    // Check for active meetings
    // A meeting is active if: scheduled_at <= now AND (scheduled_at + duration_minutes) >= now
    const [activeMeeting] = await db<Meeting[]>`
      SELECT
        id, title, scheduled_at, duration_minutes, nextcloud_talk_token,
        location, description
      FROM meetings
      WHERE org_id = 'inner_group'
        AND nextcloud_talk_token IS NOT NULL
        AND scheduled_at IS NOT NULL
        AND duration_minutes IS NOT NULL
        AND scheduled_at <= ${now}
        AND scheduled_at + (duration_minutes || ' minutes')::INTERVAL >= ${now}
        AND status = 'published'
        AND show_in_live_feed = true
      ORDER BY scheduled_at DESC
      LIMIT 1
    `;

    if (activeMeeting) {
      const endTime = new Date(activeMeeting.scheduled_at);
      endTime.setMinutes(endTime.getMinutes() + activeMeeting.duration_minutes);

      return NextResponse.json({
        status: 'active',
        meeting: {
          id: activeMeeting.id,
          title: activeMeeting.title,
          startTime: activeMeeting.scheduled_at.toISOString(),
          endTime: endTime.toISOString(),
          talkToken: activeMeeting.nextcloud_talk_token,
          location: activeMeeting.location,
          description: activeMeeting.description,
        },
      });
    }

    // Check for upcoming meetings
    const [upcomingMeeting] = await db<Meeting[]>`
      SELECT
        id, title, scheduled_at, duration_minutes, nextcloud_talk_token,
        location, description
      FROM meetings
      WHERE org_id = 'inner_group'
        AND nextcloud_talk_token IS NOT NULL
        AND scheduled_at IS NOT NULL
        AND scheduled_at > ${now}
        AND status = 'published'
        AND show_in_live_feed = true
      ORDER BY scheduled_at ASC
      LIMIT 1
    `;

    if (upcomingMeeting) {
      const endTime = new Date(upcomingMeeting.scheduled_at);
      endTime.setMinutes(endTime.getMinutes() + (upcomingMeeting.duration_minutes || 60));

      return NextResponse.json({
        status: 'upcoming',
        meeting: {
          id: upcomingMeeting.id,
          title: upcomingMeeting.title,
          startTime: upcomingMeeting.scheduled_at.toISOString(),
          endTime: endTime.toISOString(),
          talkToken: upcomingMeeting.nextcloud_talk_token,
          location: upcomingMeeting.location,
          description: upcomingMeeting.description,
        },
      });
    }

    // No meetings found
    return NextResponse.json({
      status: 'none',
      meeting: null,
    });
  } catch (error) {
    console.error('Error fetching live feed data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live feed data' },
      { status: 500 }
    );
  }
}
