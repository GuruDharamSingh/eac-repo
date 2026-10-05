import { NextResponse, type NextRequest } from "next/server";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { refreshStripeAccountStatus } from "@elkdonis/checkout/stripe";
import { getViewer } from "@/lib/auth";

/**
 * Where Stripe sends a person after Express onboarding (`?payouts=done|refresh`).
 *
 * `done` means they left the form, not that Stripe has verified them, so this
 * asks Stripe whether payouts are enabled and stamps the account if so
 * (`refreshStripeAccountStatus`) — the webhook does the same, but a seller
 * should not have to wait for it. Every onboarding return page must do this
 * (docs/reference/commerce.md, Webhooks). Then on to /manage, where the status
 * is shown; a person who cannot manage the site goes to their center.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL);
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return NextResponse.redirect(new URL("/login?next=/manage", base));

  const state = request.nextUrl.searchParams.get("payouts") === "refresh" ? "refresh" : "done";
  if (state === "done") await refreshStripeAccountStatus(viewer.userId);

  const target = viewer.canEdit ? "/manage" : "/center";
  return NextResponse.redirect(new URL(`${target}?payouts=${state}#payouts`, base));
}
