import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only org members can create workshops
  const [membership] = await db`
    SELECT role FROM user_organizations
    WHERE user_id = ${session.user.id}
      AND org_id = 'inner_group'
    LIMIT 1
  `;
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description = '',
    price,
    coverImageUrl,
    nextcloudTalkToken,
    sessions = [],
    status = 'draft',
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const id = nanoid();
  const baseSlug = slugify(title);

  // Ensure unique slug within inner_group
  const existing = await db`
    SELECT id FROM threads
    WHERE org_id = 'inner_group' AND slug LIKE ${baseSlug + '%'}
    ORDER BY created_at DESC
  `;
  const slug = existing.length > 0 ? `${baseSlug}-${nanoid(5)}` : baseSlug;

  await db`
    INSERT INTO threads (
      id, org_id, author_id, kind,
      title, slug, body,
      status, visibility,
      created_at, updated_at
    ) VALUES (
      ${id}, 'inner_group', ${session.user.id}, 'workshop',
      ${title.trim()}, ${slug}, ${description},
      ${status}, 'ORGANIZATION',
      NOW(), NOW()
    )
  `;

  // Insert workshop_pages sidecar if columns exist
  try {
    await db`
      INSERT INTO workshop_pages (
        thread_id, cover_image_url, price_member
      ) VALUES (
        ${id},
        ${coverImageUrl || null},
        ${price != null ? String(price) : null}
      )
      ON CONFLICT (thread_id) DO UPDATE
        SET cover_image_url = EXCLUDED.cover_image_url,
            price_member    = EXCLUDED.price_member,
            updated_at      = NOW()
    `;
  } catch {
    // workshop_pages table may not exist yet; skip gracefully
  }

  // Store sessions as child threads (or in metadata for now)
  // MVP: persist sessions in thread metadata JSONB field if available,
  // otherwise skip – sessions are defined in workshop_pages optional_sections
  if (sessions.length > 0) {
    try {
      await db`
        UPDATE threads
        SET metadata = ${JSON.stringify({ sessions, nextcloudTalkToken })}::jsonb
        WHERE id = ${id}
      `;
    } catch {
      // metadata column may not exist yet
    }
  }

  return NextResponse.json({ workshop: { id, slug } }, { status: 201 });
}
