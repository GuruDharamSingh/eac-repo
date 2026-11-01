import { NextResponse, type NextRequest } from "next/server";
import { completeBidderRegistration } from "@elkdonis/checkout/stripe";
import { getCurrentUserId } from "@/lib/marketplace-auth";

/**
 * Return hop from the Stripe setup session that registers a bidder (card on
 * file, ORG_STORE_BRIEF R6). Records the registration and sends them back to
 * the lot. Relative redirects: `request.nextUrl.origin` is 0.0.0.0 here.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const lot = request.nextUrl.searchParams.get("lot");
  const back = lot ? `/lots/${lot}` : "/lots";
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, request.url));
  if (!sessionId) return NextResponse.redirect(new URL(`${back}?registration=missing`, request.url));
  const r = await completeBidderRegistration({ sessionId, userId }).catch((err) => {
    console.error("[bidders/return]", err);
    return { ok: false, error: "failed" };
  });
  return NextResponse.redirect(new URL(`${back}?registration=${r.ok ? "done" : "failed"}`, request.url));
}
