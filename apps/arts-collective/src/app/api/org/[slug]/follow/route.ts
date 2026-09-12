import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { followOrg, getOrgFollowerCount, unfollowOrg } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Follow / unfollow an org from its subdomain profile page.
 *
 * A follow is a `viewer` row in user_organizations (CENTER_PAGE_BRIEF
 * 2026-09-09, decision 7): the lightest relation there is, shown as
 * "follower", with no hub access. `followOrg` never touches an existing
 * member row and `unfollowOrg` only ever removes a viewer row, so this route
 * cannot promote or demote anyone. The old org_followers table (072) is no
 * longer written.
 */

async function orgIdFor(slug: string): Promise<string | null> {
  const [row] = await db<Array<{ id: string }>>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  return row?.id ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });

  const orgId = await orgIdFor(slug);
  if (!orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await followOrg(user.id, orgId);
  return NextResponse.json({ ok: true, following: true, count: await getOrgFollowerCount(orgId) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });

  const orgId = await orgIdFor(slug);
  if (!orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await unfollowOrg(user.id, orgId);
  return NextResponse.json({ ok: true, following: false, count: await getOrgFollowerCount(orgId) });
}
