import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";
import { canManageIfac, getUpcomingEvents } from "@/lib/data";

function slugify(title: string, id: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${id.slice(0, 6)}`;
}

export async function GET() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ events: await getUpcomingEvents(20) });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const id = nanoid();
  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
  const attendeeLimit = body.attendee_limit ? Number(body.attendee_limit) : null;

  await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug, body, location,
      scheduled_at, duration_minutes, status, visibility, is_rsvp_enabled,
      attendee_limit, published_at
    ) VALUES (
      ${id},
      ${siteConfig.orgId},
      ${session.user?.db_user_id ?? session.user?.id},
      'event',
      ${title},
      ${slugify(title, id)},
      ${String(body.body || "").trim() || null},
      ${String(body.location || "").trim() || null},
      ${scheduledAt},
      75,
      'published',
      'PUBLIC',
      true,
      ${Number.isFinite(attendeeLimit) ? attendeeLimit : null},
      NOW()
    )
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  return NextResponse.json({ ok: true, events: await getUpcomingEvents(20) });
}
