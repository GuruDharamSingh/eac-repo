import { NextResponse, type NextRequest } from "next/server";
import { listMyListablePosts, setThreadListings } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * "Show on" — which org sites list each of the signed-in person's public
 * posts (thread_orgs). Person pages, 2026-09-26;
 * docs/open/PERSON_PAGES_BRIEF_2026-09-26.md.
 *
 * Self only: the viewer's id is the acting user, and setThreadListings
 * applies the author/membership gates per org (thread-listing.ts).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await listMyListablePosts(viewer.userId));
}

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { threadId?: unknown; orgIds?: unknown } | null;
  if (
    !body ||
    typeof body.threadId !== "string" ||
    body.threadId.length > 80 ||
    !Array.isArray(body.orgIds) ||
    body.orgIds.length > 100 ||
    !body.orgIds.every((o) => typeof o === "string" && o.length > 0 && o.length <= 80)
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await setThreadListings(viewer.userId, body.threadId, body.orgIds as string[]);
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not save that." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[center] listings POST:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
