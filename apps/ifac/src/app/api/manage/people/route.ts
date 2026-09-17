import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getIfacManager } from "@/lib/manage-auth";
import {
  listManageContacts,
  listManageMembers,
  removeMember,
  setMemberListed,
  setMemberRole,
  type ManageResult,
} from "@/lib/manage";

/**
 * People: access roles, public listing, and membership.
 *
 * Replaces /api/admin/users, which could only change a role — and did it with a
 * bare upsert, so posting `{ userId, role }` for a stranger would ADD them to
 * IFAC rather than fail. The three writes here all go through lib/manage.ts,
 * which refuses to touch an owner or the caller themselves.
 *
 * Every response carries the whole refreshed screen. The lists are short (an
 * org's membership, sixty contacts) and a console whose table can disagree with
 * the database after a click is worse than one extra query per action.
 */
async function snapshot() {
  const [members, contacts] = await Promise.all([listManageMembers(), listManageContacts()]);
  return { members, contacts };
}

function fail(result: ManageResult) {
  return NextResponse.json({ error: result.error ?? "That didn't work." }, { status: 400 });
}

/** Unlisting changes the public site, so the front page and their own page go stale. */
function revalidateListing(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/manage/people");
  revalidatePath("/manage/directory");
  if (slug) {
    revalidatePath(`/artists/${slug}`);
    revalidatePath(`/dealers/${slug}`);
  }
}

export async function GET() {
  const viewer = await getIfacManager();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await snapshot());
}

export async function PATCH(request: NextRequest) {
  const viewer = await getIfacManager();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();

  // Two different writes on one verb, told apart by which field is present:
  // `listed` is about the public site, `role` is about access inside IFAC.
  if (typeof body.listed === "boolean") {
    const result = await setMemberListed(userId, viewer.userId, body.listed);
    if (!result.ok) return fail(result);
    revalidateListing(typeof body.slug === "string" ? body.slug : null);
    return NextResponse.json({ ok: true, ...(await snapshot()) });
  }

  const result = await setMemberRole(userId, viewer.userId, String(body.role ?? "").trim());
  if (!result.ok) return fail(result);
  revalidatePath("/manage/people");
  return NextResponse.json({ ok: true, ...(await snapshot()) });
}

/** Remove them from IFAC. Not an account deletion — see lib/manage.ts. */
export async function DELETE(request: NextRequest) {
  const viewer = await getIfacManager();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  const result = await removeMember(userId, viewer.userId);
  if (!result.ok) return fail(result);

  revalidateListing(searchParams.get("slug"));
  return NextResponse.json({ ok: true, ...(await snapshot()) });
}
