import { db } from '@elkdonis/db';

/**
 * The connections audit log (migration 224, 2026-11-01). Best effort: a
 * missing table or a failed insert never stops the action being logged.
 */
export type ConnectionEventName =
  | 'created'
  | 'connected'
  | 'connect_failed'
  | 'token_used'
  | 'tested'
  | 'page_attached'
  | 'channel_set'
  | 'channel_cleared'
  | 'removed'
  | 'revoke_attempted'
  | 'refreshed'
  | 'refresh_failed'
  | 'expiry_warned';

export async function logConnectionEvent(input: {
  userId: string;
  connectionId: string;
  provider: string;
  event: ConnectionEventName;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db`
      INSERT INTO connection_events (user_id, connection_id, provider, event, detail)
      VALUES (${input.userId}, ${input.connectionId}, ${input.provider}, ${input.event}, ${db.json((input.detail ?? {}) as Parameters<typeof db.json>[0])})
    `;
  } catch (err) {
    console.warn('[connections] event not logged:', err instanceof Error ? err.message : String(err));
  }
}

export interface ConnectionEventView {
  id: number;
  connectionId: string;
  provider: string;
  event: ConnectionEventName;
  detail: Record<string, unknown>;
  at: string;
}

export async function listConnectionEvents(userId: string, limit = 30): Promise<ConnectionEventView[]> {
  try {
    const rows = await db<Array<{ id: number; connection_id: string; provider: string; event: ConnectionEventName; detail: Record<string, unknown>; at: Date }>>`
      SELECT id, connection_id, provider, event, detail, at FROM connection_events
      WHERE user_id = ${userId} ORDER BY at DESC LIMIT ${limit}
    `;
    return rows.map((r) => ({ id: r.id, connectionId: r.connection_id, provider: r.provider, event: r.event, detail: r.detail ?? {}, at: r.at.toISOString() }));
  } catch {
    return [];
  }
}
