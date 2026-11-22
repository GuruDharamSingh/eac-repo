import { NextResponse, type NextRequest } from "next/server";
import { audienceAction } from "@/lib/forum-data";

/** POST { threadId, audience } -> the author (or a moderator) changes who can read a topic. */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => null)) as { threadId?: string; audience?: "everyone" | "followers" | "author" } | null;
  if (!b?.threadId || !b.audience) return NextResponse.json({ ok: false, error: "Not found." }, { status: 400 });
  const r = await audienceAction(b.threadId, b.audience);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
