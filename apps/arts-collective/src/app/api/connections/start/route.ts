import { NextResponse, type NextRequest } from "next/server";
import { beginConnectionAuth } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { networkOrigin, safeReturn, withOutcome } from "@/lib/connections";

/**
 * GET /api/connections/start?id=<connection>&return=<absolute url>
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
  const r = await beginConnectionAuth(user.id, id, returnTo);
  if (r.ok === false) return NextResponse.redirect(withOutcome(returnTo ?? `${origin}/hub`, id, r.error));
  return NextResponse.redirect(r.url);
}
