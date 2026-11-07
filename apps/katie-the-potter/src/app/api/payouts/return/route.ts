import { NextResponse, type NextRequest } from "next/server";
import { refreshStripeAccountStatus } from "@elkdonis/checkout/stripe";
import { getViewer } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";

/**
 * Where Stripe sends a person after Express onboarding (`?payouts=done|refresh`),
 * copied from sunjay with this site's origin. `done` means they left the form,
 * not that Stripe has verified them, so this asks Stripe whether payouts are
 * enabled and stamps the account if so (refreshStripeAccountStatus; the webhook
 * does the same, but a seller should not have to wait for it). Then on to
 * /manage/payouts, where the status is shown.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = await siteOrigin();
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return NextResponse.redirect(new URL("/login?next=/manage/payouts", base));

  const state = request.nextUrl.searchParams.get("payouts") === "refresh" ? "refresh" : "done";
  if (state === "done") await refreshStripeAccountStatus(viewer.userId).catch((err) => console.error("[katie-the-potter] payouts return:", err));

  const target = viewer.canEdit ? "/manage/payouts" : "/account";
  return NextResponse.redirect(new URL(`${target}?payouts=${state}`, base));
}
