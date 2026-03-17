import { db } from '@elkdonis/db';
import type { Meeting } from '@/components/types';

const ORG_ID = 'amrit_canada';

export async function getUpcomingMeetings(limit = 10): Promise<Meeting[]> {
  try {
    const rows = await db<Meeting[]>`
      SELECT
        id, title, slug, description, location,
        scheduled_at, duration_minutes, is_online, meeting_url, status, section
      FROM meetings
      WHERE org_id = ${ORG_ID}
        AND status = 'published'
        AND (scheduled_at IS NULL OR scheduled_at >= NOW() - INTERVAL '6 hours')
      ORDER BY scheduled_at ASC NULLS LAST
      LIMIT ${limit}
    `;
    return rows;
  } catch (err) {
    console.error('[amrit-canada] getUpcomingMeetings error:', err);
    return [];
  }
}

export async function getNextMeeting(): Promise<Meeting | null> {
  try {
    const [row] = await db<Meeting[]>`
      SELECT
        id, title, slug, description, location,
        scheduled_at, duration_minutes, is_online, meeting_url, status, section
      FROM meetings
      WHERE org_id = ${ORG_ID}
        AND status = 'published'
        AND (scheduled_at IS NULL OR scheduled_at >= NOW() - INTERVAL '6 hours')
      ORDER BY scheduled_at ASC NULLS LAST
      LIMIT 1
    `;
    return row ?? null;
  } catch (err) {
    console.error('[amrit-canada] getNextMeeting error:', err);
    return null;
  }
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const [row] = await db<Meeting[]>`
      SELECT
        id, title, slug, description, location,
        scheduled_at, duration_minutes, is_online, meeting_url, status, section
      FROM meetings
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
      LIMIT 1
    `;
    return row ?? null;
  } catch (err) {
    console.error('[amrit-canada] getMeeting error:', err);
    return null;
  }
}

export async function getMeetingsBySection(section: string, limit = 20): Promise<Meeting[]> {
  try {
    const rows = await db<Meeting[]>`
      SELECT
        id, title, slug, description, location,
        scheduled_at, duration_minutes, is_online, meeting_url, status, section
      FROM meetings
      WHERE org_id = ${ORG_ID}
        AND section = ${section}
        AND status = 'published'
        AND (scheduled_at IS NULL OR scheduled_at >= NOW() - INTERVAL '6 hours')
      ORDER BY scheduled_at ASC NULLS LAST
      LIMIT ${limit}
    `;
    return rows;
  } catch (err) {
    console.error(`[amrit-canada] getMeetingsBySection(${section}) error:`, err);
    return [];
  }
}

export async function getRsvpCount(meetingId: string): Promise<number> {
  try {
    const [row] = await db<{ count: string }[]>`
      SELECT COUNT(*) as count FROM rsvp_responses WHERE meeting_id = ${meetingId}
    `;
    return parseInt(row?.count ?? '0', 10);
  } catch {
    return 0;
  }
}
