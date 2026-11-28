import { after, NextResponse, type NextRequest } from "next/server";
import { completeCalendarAuth, syncCalendarLink } from "@elkdonis/services/google-calendar";
import { getApiEditor } from "@/lib/auth";
import { calendarSite, googleCalendarRedirectUri } from "@/lib/google-calendar";

/**
 * GET /api/google-calendar/callback — Google's redirect after consent
 * (2026-11-26). This URL is registered on the Google OAuth client. The nonce in
 * `state` was stored for the same signed-in editor by connectGoogleCalendar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // The configured address, not the request's: behind the proxy that reads 0.0.0.0.
  const hub = new URL("/hub", googleCalendarRedirectUri());
  const done = (error: string | null) => {
    if (error) hub.searchParams.set("calendar_error", error);
    else hub.searchParams.set("calendar", "connected");
    hub.hash = "hub-schedule-title";
    return NextResponse.redirect(hub);
  };
  const viewer = await getApiEditor();
  if (!viewer) return done("Signed out during the Google step. Sign in and connect again.");
  const q = request.nextUrl.searchParams;
  const r = await completeCalendarAuth({
    userId: viewer.userId,
    orgId: calendarSite.orgId,
    redirectUri: googleCalendarRedirectUri(),
    state: q.get("state"),
    code: q.get("code"),
    error: q.get("error"),
  });
  if (r.ok === false) return done(r.error);
  // The first sync can take a while on a full schedule: after the redirect.
  after(async () => {
    await syncCalendarLink(r.linkId, calendarSite, { force: true }).catch((err) => console.error("[elktours] first calendar sync:", err));
  });
  return done(null);
}
