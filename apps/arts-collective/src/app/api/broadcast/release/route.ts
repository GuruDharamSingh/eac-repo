import { NextRequest, NextResponse } from "next/server";
import { obsRelease } from "@elkdonis/services/obs";
import { getCurrentUser } from "@/lib/session";
import { goLiveRole } from "@/lib/go-live-access";

/**
 * Frees the broadcast studio when its tab closes (navigator.sendBeacon from
 * BroadcastConsole). Best effort: if it never arrives, the agent's lease
 * lapses 20 s after the last renewal. Only the caller's own tab id is ever
 * released: the holder is rebuilt from the session.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  // Admins (console) and org owners (the Studio's Go live card, 2026-11-14); only the caller's own tab is released.
  if (!user || !(await goLiveRole(user.id))) return new NextResponse(null, { status: 204 });
  const tabId = (await request.text()).trim();
  if (/^[A-Za-z0-9_-]{8,40}$/.test(tabId)) await obsRelease(`${user.id}:${tabId}`).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
