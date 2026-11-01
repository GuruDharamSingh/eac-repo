import { createWebhookHandlers } from "@elkdonis/meta/webhook";
import { recordMetaWebhookEvent } from "@elkdonis/services";

/**
 * Meta webhook for the collective's meta app (2026-10-31): the dashboard's
 * verify handshake (GET) and signed deliveries (POST), each kept in
 * meta_webhook_events. Verify token: META_WEBHOOK_VERIFY_TOKEN, the same for
 * all three apps; signature: META_APP_SECRET.
 */
export const dynamic = "force-dynamic";

const handlers = createWebhookHandlers({
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  appSecret: process.env.META_APP_SECRET,
  onEvent: (event) => recordMetaWebhookEvent("meta", event),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
