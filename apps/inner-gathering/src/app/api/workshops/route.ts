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
    bannerImageUrl,
    bannerFocalY,
    heroMediaUrl,
    heroMediaType,
    heroText,
    backgroundColor,
    nextcloudTalkToken,
    sessions = [],
    status = 'draft',
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const id = `th_${nanoid(18)}`;
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
      status, visibility, nextcloud_talk_token,
      created_at, updated_at
    ) VALUES (
      ${id}, 'inner_group', ${session.user.id}, 'workshop',
      ${title.trim()}, ${slug}, ${description},
      ${status}, 'PUBLIC', ${nextcloudTalkToken || null},
      NOW(), NOW()
    )
  `;

  // workshop_pages — shared sidecar table with /api/content and the detail page
  await db`
    INSERT INTO workshop_pages (
      thread_id, cover_image_url, price_member,
      banner_image_url, banner_focal_y, hero_media_url, hero_media_type, hero_text, background_color
    ) VALUES (
      ${id},
      ${coverImageUrl || null},
      ${price != null ? String(price) : null},
      ${bannerImageUrl || null},
      ${bannerFocalY ?? 50},
      ${heroMediaUrl || null},
      ${heroMediaUrl ? (heroMediaType || 'image') : null},
      ${heroText || null},
      ${backgroundColor || null}
    )
    ON CONFLICT (thread_id) DO UPDATE
      SET cover_image_url  = EXCLUDED.cover_image_url,
          price_member     = EXCLUDED.price_member,
          banner_image_url = EXCLUDED.banner_image_url,
          banner_focal_y   = EXCLUDED.banner_focal_y,
          hero_media_url   = EXCLUDED.hero_media_url,
          hero_media_type  = EXCLUDED.hero_media_type,
          hero_text        = EXCLUDED.hero_text,
          background_color = EXCLUDED.background_color,
          updated_at       = NOW()
  `;

  // Sessions — same table /api/content writes, so both editors see each other's sessions
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    await db`
      INSERT INTO workshop_sessions ${db({
        id: `ws_${nanoid(16)}`,
        thread_id: id,
        session_number: i + 1,
        topic: s.title,
        scheduled_at: s.scheduledAt ? new Date(s.scheduledAt) : null,
        duration_minutes: s.durationMinutes ?? null,
        // Plain object — postgres.js serializes JS objects for jsonb columns
        // itself; pre-stringifying double-encodes it (see api/content/route.ts).
        notes: {
          description: s.description ?? '',
          isOnline: s.isOnline ?? true,
          location: s.location ?? '',
          videoConferenceUrl: s.videoConferenceUrl ?? '',
          mediaUrl: s.mediaUrl ?? null,
          videoUrl: s.videoUrl ?? null,
          resources: s.resources ?? [],
          backgroundColor: s.backgroundColor ?? null,
        },
      })}
    `;
  }

  // Materials folder — same as /api/content's workshop path, on every save
  try {
    const { getAdminClient, ensureWorkshopMaterialsFolder, grantMaterialsAccess } =
      await import('@elkdonis/nextcloud');
    const serviceClient = getAdminClient();
    await ensureWorkshopMaterialsFolder(serviceClient, 'inner_group', id);
    if (session.user.nextcloud_user_id) {
      await grantMaterialsAccess(serviceClient, 'inner_group', id, session.user.nextcloud_user_id, 'author');
    }
  } catch (materialsErr) {
    console.error('Workshop materials folder provisioning failed:', materialsErr);
  }

  return NextResponse.json({ workshop: { id, slug } }, { status: 201 });
}
