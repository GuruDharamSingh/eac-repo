import { handleEasyshipWebhook } from "@/lib/shipping/webhook";

/**
 * Easyship's webhook (tracking status, label created/failed, cancelled).
 * Signature: X-EASYSHIP-SIGNATURE, a JWT signed HS256 with the webhook's
 * secret (EASYSHIP_WEBHOOK_SECRET / EASYSHIP_SANDBOX_WEBHOOK_SECRET). See
 * src/lib/shipping/webhook.ts. Point the webhook at
 * https://pottery.arts-collective.com/api/shipping/webhook in the Easyship
 * dashboard (Connect, Webhooks).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const r = await handleEasyshipWebhook(raw, request.headers.get("x-easyship-signature"));
    return new Response(r.body, { status: r.status });
  } catch (err) {
    console.error("[katie-the-potter] Easyship webhook:", err);
    return new Response("Handler error", { status: 500 });
  }
}
