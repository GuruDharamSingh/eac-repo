import { NextResponse, type NextRequest } from "next/server";
import { beginConnectionAuth } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { networkOrigin, safeReturn, withOutcome } from "@/lib/connections";

/**
 * GET /api/connections/start?id=<connection>&return=<absolute url>[&with=comments]
 *
 * The one place on the network that sends a person to Google's consent screen
 * for a connection (services/connections.ts, migration 192). Other sites link
 * here through their handoff route so the sign-in travels. `return` must be a
 * network origin; anything else comes back to /hub.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = networkOrigin();
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const returnTo = safeReturn(request.nextUrl.searchParams.get("return"));
  const user = await getCurrentUser();
  if (!user) {
    const here = `/api/connections/start?${request.nextUrl.searchParams.toString()}`;
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(here)}`);
  }
  // `with=comments` (2026-11-24): also ask for the comment permissions (Channel → Comments).
  const r = await beginConnectionAuth(user.id, id, returnTo, { comments: request.nextUrl.searchParams.get("with") === "comments" });
  if (r.ok === false) return NextResponse.redirect(withOutcome(returnTo ?? `${origin}/hub`, id, r.error));
  return NextResponse.redirect(r.url);
}
