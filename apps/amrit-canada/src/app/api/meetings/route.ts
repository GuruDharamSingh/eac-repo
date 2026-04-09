import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getServerSession } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

const ORG_ID = siteConfig.orgId;

export async function GET() {
  try {
    const meetings = await db`
      SELECT id, title, slug, description, location, scheduled_at, duration_minutes, is_online, meeting_url, status
      FROM meetings
      WHERE org_id = ${ORG_ID}
        AND status = 'published'
        AND (scheduled_at IS NULL OR scheduled_at >= NOW() - INTERVAL '6 hours')
      ORDER BY scheduled_at ASC NULLS LAST
      LIMIT 20
    `;
    return NextResponse.json(meetings);
  } catch (err) {
    console.error('[amrit-canada] GET /api/meetings error:', err);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session.user || !siteConfig.ownerEmails.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, location, description, scheduled_at } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const id = nanoid();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + id.slice(0, 6);

    const [meeting] = await db`
      INSERT INTO meetings (
        id, org_id, guide_id, title, slug, description, location,
        scheduled_at, duration_minutes, status, is_rsvp_enabled
      )
      VALUES (
        ${id},
        ${ORG_ID},
        ${session.user.db_user_id ?? session.user.id},
        ${title},
        ${slug},
        ${description ?? null},
        ${location ?? null},
        ${scheduled_at ?? null},
        150,
        'published',
        true
      )
      RETURNING id, title, slug, description, location, scheduled_at, duration_minutes, status
    `;

    return NextResponse.json(meeting, { status: 201 });
  } catch (err) {
    console.error('[amrit-canada] POST /api/meetings error:', err);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
