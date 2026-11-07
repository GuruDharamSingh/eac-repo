import { createWebhookHandlers } from "@elkdonis/meta/webhook";
import { processMetaWebhookEvent, recordMetaWebhookEvent } from "@elkdonis/services";

/**
 * Meta webhook for the collective's instagram app (2026-10-31): the dashboard's
 * verify handshake (GET) and signed deliveries (POST), each kept in
 * meta_webhook_events. Verify token: META_WEBHOOK_VERIFY_TOKEN, the same for
 * all three apps; signature: INSTAGRAM_APP_SECRET.
 */
export const dynamic = "force-dynamic";

const handlers = createWebhookHandlers({
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  onEvent: async (event) => {
    await recordMetaWebhookEvent("instagram", event);
    // Comments on posts the network sent out become rows under their thread (migration 225).
    const r = await processMetaWebhookEvent(event).catch((err) => {
      console.error("[meta webhook] process:", err);
      return null;
    });
    if (r && (r.stored || r.removed || r.unmatched)) console.log(`[meta webhook] instagram: ${r.stored} stored, ${r.removed} removed, ${r.unmatched} unmatched`);
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
