import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

const ORG_ID = "inner_group";

// GET — current co-guides + a roster of org members to pick from. Only the
// author or an admin may manage guides.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [meeting] = await db`
      SELECT id, author_id, metadata FROM threads
      WHERE id = ${id} AND org_id = ${ORG_ID} AND kind IN ('meeting', 'workshop')
      LIMIT 1
    `;
    if (!meeting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = await isAdmin(session.user.id);
    if (!admin && meeting.author_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const coGuideIds: string[] = Array.isArray(meeting.metadata?.coGuideIds)
      ? meeting.metadata.coGuideIds
      : [];

    // Roster: org members minus the author (always a guide). Capped for the picker.
    const members = await db`
      SELECT DISTINCT u.id, COALESCE(u.display_name, u.email) AS name, u.avatar_url
      FROM users u
      JOIN user_organizations uo ON uo.user_id = u.id
      WHERE uo.org_id = ${ORG_ID} AND u.id <> ${meeting.author_id}
      ORDER BY name
      LIMIT 200
    `;

    return NextResponse.json({
      authorId: meeting.author_id,
      coGuideIds,
      members: members.map((m: any) => ({ id: m.id, name: m.name, avatarUrl: m.avatar_url })),
    });
  } catch (error) {
    console.error("Error loading guides:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH — replace the co-guide list. Body { coGuideIds: string[] }.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [meeting] = await db`
      SELECT id, author_id FROM threads
      WHERE id = ${id} AND org_id = ${ORG_ID} AND kind IN ('meeting', 'workshop')
      LIMIT 1
    `;
    if (!meeting) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = await isAdmin(session.user.id);
    if (!admin && meeting.author_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const incoming: string[] = Array.isArray(body.coGuideIds) ? body.coGuideIds : [];
    // The author is implicitly a guide — never store them as a co-guide.
    const coGuideIds = Array.from(new Set(incoming.filter((g) => g && g !== meeting.author_id)));

    await db`
      UPDATE threads
      SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{coGuideIds}',
            ${JSON.stringify(coGuideIds)}::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE id = ${id} AND org_id = ${ORG_ID}
    `;

    revalidatePath("/feed");
    return NextResponse.json({ success: true, coGuideIds });
  } catch (error) {
    console.error("Error updating guides:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
