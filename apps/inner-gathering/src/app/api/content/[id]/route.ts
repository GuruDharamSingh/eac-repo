import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

const ORG_ID = "inner_group";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await isAdmin(session.user.id);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [post] = await db`
      SELECT id
      FROM threads
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
        AND kind = 'post'
      LIMIT 1
    `;

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db`
      UPDATE threads
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
        AND kind = 'post'
    `;

    revalidatePath("/feed");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}

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

    const admin = await isAdmin(session.user.id);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (typeof body.feedPinned !== "boolean") {
      return NextResponse.json({ error: "feedPinned boolean required" }, { status: 400 });
    }

    const [thread] = await db`
      UPDATE threads
      SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{feedPinned}',
            ${JSON.stringify(body.feedPinned)}::jsonb,
            true
          ),
          updated_at = NOW()
      WHERE id = ${id}
        AND org_id = ${ORG_ID}
        AND kind IN ('meeting', 'post', 'workshop', 'event')
      RETURNING id, metadata
    `;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    revalidatePath("/feed");

    return NextResponse.json({ success: true, id: thread.id, metadata: thread.metadata });
  } catch (error) {
    console.error("Failed to update thread:", error);
    return NextResponse.json(
      { error: "Failed to update thread" },
      { status: 500 }
    );
  }
}