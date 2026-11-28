import { NextResponse } from "next/server";
import { getHubForumViewer, hubAcrossOrgs } from "@/lib/hub-forum";

/** GET -> the latest threads across every organisation the signed-in viewer holds a role in ("Across your organisations"). 401 signed out. */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getHubForumViewer();
  if (!viewer.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const items = await hubAcrossOrgs(viewer);
  return NextResponse.json({ items, orgCount: Object.keys(viewer.roles).length });
}
