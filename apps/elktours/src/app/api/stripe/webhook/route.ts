import { handleStripeWebhook } from "@elkdonis/checkout/stripe";

// Stripe → us. Signature-verified inside handleStripeWebhook; the raw body is
// read there, so nothing here may parse the request first.
//
// Point the Stripe dashboard (or `stripe listen --forward-to
// localhost:3021/api/stripe/webhook`) at this route and put the signing
// secret in STRIPE_WEBHOOK_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleStripeWebhook(request);
}

// elktours (2026-11-15): a second endpoint beside art-auction's platform webhook.
// Dormant until a Stripe endpoint points at https://elkdonisexperiences.com/api/stripe/webhook
// and its secret is in ELKTOURS_STRIPE_WEBHOOK_SECRET (.env). Confirming is idempotent,
// so both endpoints receiving the same event is safe.
