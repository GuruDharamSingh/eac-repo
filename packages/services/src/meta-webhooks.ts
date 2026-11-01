import { db } from '@elkdonis/db';

/**
 * Keep a Meta webhook delivery (migration 220, 2026-10-31). Best effort:
 * before the table exists, or on any write error, the delivery is logged
 * and the route still answers 200, since Meta retries non-200s and would
 * otherwise hammer the host.
 */
export async function recordMetaWebhookEvent(source: 'meta' | 'instagram' | 'threads', event: { object: string; entry: unknown[] }): Promise<void> {
  try {
    await db`
      INSERT INTO meta_webhook_events (source, object, payload)
      VALUES (${source}, ${event.object ?? 'unknown'}, ${db.json(event as Parameters<typeof db.json>[0])})
    `;
  } catch (err) {
    console.warn(`[meta webhook] ${source} ${event.object}: not stored (${err instanceof Error ? err.message : String(err)})`);
  }
}
