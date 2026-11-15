import { NextResponse, type NextRequest } from "next/server";
import { completeBidderRegistration } from "@elkdonis/checkout/stripe";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

/**
 * Return hop from the Stripe setup session that registers a bidder (card on
 * file, ORG_STORE_BRIEF R6). Records the registration and sends them back to
 * the lot. Redirects are built on the configured public URL: `request.url`
 * carries the container's 0.0.0.0:<port> origin here.
 */
function to(path: string): URL {
  return new URL(path, siteConfig.url.replace(/\/$/, "") + "/");
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const lot = request.nextUrl.searchParams.get("lot");
  const back = lot ? `/lots/${lot}` : "/lots";
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.redirect(to(`/login?next=${encodeURIComponent(back)}`));
  if (!sessionId) return NextResponse.redirect(to(`${back}?registration=missing`));
  const r = await completeBidderRegistration({ sessionId, userId }).catch((err) => {
    console.error("[bidders/return]", err);
    return { ok: false, error: "failed" };
  });
  return NextResponse.redirect(to(`${back}?registration=${r.ok ? "done" : "failed"}`));
}
