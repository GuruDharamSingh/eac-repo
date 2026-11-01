import { NextResponse } from "next/server";
import { followOrg, unfollowOrg } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Follow / unfollow this org from /center.
 *
 * A follow is a `viewer` row in user_organizations (brief, decision 7);
 * unfollowing only ever removes a viewer row, so a member cannot demote
 * themselves by accident here.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (viewer.role !== null) return NextResponse.json({ ok: true, role: viewer.role });
  await followOrg(viewer.userId, siteConfig.orgId);
  return NextResponse.json({ ok: true, role: "viewer" });
}

export async function DELETE() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (viewer.role !== null && viewer.role !== "viewer") {
    return NextResponse.json({ error: "Members leave from the hub, not here" }, { status: 409 });
  }
  await unfollowOrg(viewer.userId, siteConfig.orgId);
  return NextResponse.json({ ok: true, role: null });
}
