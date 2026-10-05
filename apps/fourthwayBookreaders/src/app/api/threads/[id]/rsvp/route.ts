import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { checkRsvpEligibility, deleteRsvp, setRsvpStatus } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * RSVP to one of this circle's threads.
 *
 * Built on the kind-agnostic primitives in @elkdonis/services/thread-rsvp, so
 * eligibility, capacity and the upsert stay free of per-kind branching (new
 * thread kinds are coming; this must not care which one it is given).
 *
 * The one thing this route adds is the ORG SCOPE. The primitives look a
 * thread up by id alone — correct for a shared library, wrong for a route:
 * without the check below, a signed-in visitor here could RSVP to any thread
 * in the database by guessing its id.
 */
async function threadIsOurs(threadId: string): Promise<boolean> {
  const rows = await db<{ id: string }[]>`
    SELECT id FROM threads
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId} AND status = 'published'
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to RSVP" }, { status: 401 });
  if (!(await threadIsOurs(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eligible = await checkRsvpEligibility(id);
  if (!eligible.ok) return NextResponse.json({ error: eligible.error }, { status: 409 });

  await setRsvpStatus(id, viewer.userId, "yes");

  // Joining a reading group opens its space, which needs a role in this org:
  // give a signed-in person with none the `viewer` role (named explicitly —
  // the column defaults to member). An existing role is never changed.
  const [kind] = await db<{ kind: string }[]>`SELECT kind FROM threads WHERE id = ${id} AND org_id = ${siteConfig.orgId}`;
  if (kind?.kind === "reading_group" && viewer.role === null) {
    await db`
      INSERT INTO user_organizations (user_id, org_id, role)
      VALUES (${viewer.userId}, ${siteConfig.orgId}, 'viewer')
      ON CONFLICT DO NOTHING
    `.catch((err) => console.error("[fourthway] join-as-viewer:", err));
  }
  return NextResponse.json({ ok: true, status: "yes" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!(await threadIsOurs(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteRsvp(id, viewer.userId);
  return NextResponse.json({ ok: true, status: null });
}
