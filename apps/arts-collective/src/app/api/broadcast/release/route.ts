import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@elkdonis/auth-server";
import { obsRelease } from "@elkdonis/services/obs";
import { getCurrentUser } from "@/lib/session";

/**
 * Frees the broadcast studio when its tab closes (navigator.sendBeacon from
 * BroadcastConsole). Best effort: if it never arrives, the agent's lease
 * lapses 20 s after the last renewal. Only the caller's own tab id is ever
 * released: the holder is rebuilt from the session.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return new NextResponse(null, { status: 204 });
  const tabId = (await request.text()).trim();
  if (/^[A-Za-z0-9_-]{8,40}$/.test(tabId)) await obsRelease(`${user.id}:${tabId}`).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
