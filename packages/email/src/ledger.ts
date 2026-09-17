import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

// ============================================================================
// What actually happened to a letter.
//
// Mail Send answers 202 Accepted, which means "queued" and nothing else.
// Delivered, bounced, blocked, marked-as-spam and unsubscribed are knowable
// only through the Event Webhook, and until migration 135 there was no table
// to put them in and no endpoint to receive them. The visible consequence: the
// newsletter has been showing editors an attempt count labelled as a delivery
// count, and a hard-bounced address has been retried on every send since it
// first bounced.
//
// Two tables, two owners: a SEND is ours and written at call time; an EVENT is
// SendGrid's and arrives late, out of order, more than once, and sometimes for
// a send we hold no row for. See migration 135.
// ============================================================================

function jsonb(value: unknown): ReturnType<typeof db.json> {
  return db.json(value as never);
}

export type SendStatus =
  | 'queued'
  | 'sandboxed'
  | 'failed'
  | 'delivered'
  | 'bounced'
  | 'blocked'
  | 'spam'
  | 'unsubscribed'
  | 'opened';

export interface SendRecord {
  id: string;
  orgId: string;
  kind: string;
  threadId: string | null;
  toEmail: string;
  subject: string | null;
  status: SendStatus;
  error: string | null;
  sentAt: string;
}

/**
 * Write one send.
 *
 * Called by `sendEmail` for every recipient, including the ones that failed —
 * a failed send is usually the exact fact somebody is hunting for, and a
 * ledger that only records successes answers the wrong question.
 *
 * Never throws. A ledger that can break a send is worse than no ledger: the
 * letter going out matters more than the record of it, so a write failure is
 * logged and swallowed.
 */
export async function recordSend(input: {
  orgId: string;
  kind: string;
  threadId?: string | null;
  toEmail: string;
  subject?: string | null;
  sgMessageId?: string | null;
  status: SendStatus;
  error?: string | null;
}): Promise<string | null> {
  try {
    const id = nanoid();
    await db`
      INSERT INTO email_sends (
        id, org_id, kind, thread_id, to_email, subject, sg_message_id, status, error
      ) VALUES (
        ${id}, ${input.orgId}, ${input.kind}, ${input.threadId ?? null},
        ${input.toEmail}, ${input.subject ?? null}, ${input.sgMessageId ?? null},
        ${input.status}, ${input.error ?? null}
      )
    `;
    return id;
  } catch (err) {
    console.error('[email] recordSend failed (send itself unaffected):', err);
    return null;
  }
}

/**
 * How a SendGrid event name folds into our one-word status.
 *
 * `processed` and `deferred` deliberately map to nothing: they are transit
 * noise and overwriting a `delivered` with them would move a row backwards.
 */
const EVENT_TO_STATUS: Record<string, SendStatus | undefined> = {
  delivered: 'delivered',
  bounce: 'bounced',
  dropped: 'failed',
  blocked: 'blocked',
  deferred: undefined,
  processed: undefined,
  spamreport: 'spam',
  unsubscribe: 'unsubscribed',
  group_unsubscribe: 'unsubscribed',
  group_resubscribe: undefined,
  open: 'opened',
  click: undefined,
};

/**
 * Statuses that are terminal enough that a later event must not undo them.
 *
 * An `open` can arrive after a `bounce` for a different recipient of the same
 * batch, and out-of-order delivery is documented rather than theoretical, so
 * the fold is guarded instead of last-write-wins.
 */
const TERMINAL: SendStatus[] = ['bounced', 'blocked', 'spam', 'unsubscribed', 'failed'];

export interface SendGridEvent {
  sg_event_id?: string;
  sg_message_id?: string;
  email?: string;
  event?: string;
  reason?: string;
  timestamp?: number;
  orgId?: string;
  kind?: string;
  threadId?: string;
  [key: string]: unknown;
}

export interface IngestResult {
  received: number;
  stored: number;
  suppressed: number;
}

/**
 * Take one webhook POST.
 *
 * SendGrid batches: the body is an ARRAY of events, not one event, and a
 * handler written for a single object silently drops all but the first.
 *
 * Every event is deduped on SendGrid's own `sg_event_id`, which is stable
 * across the 24 hours of retries a non-2xx response earns — so redelivery is
 * free and the endpoint can always answer 2xx.
 *
 * `reason` is text from a third party's mail server. It is stored and later
 * displayed; nothing parses it to make a decision.
 */
export async function ingestEvents(events: SendGridEvent[]): Promise<IngestResult> {
  let stored = 0;
  let suppressed = 0;

  for (const ev of events) {
    const eventId = ev.sg_event_id;
    if (!eventId) continue;

    const occurredAt = ev.timestamp
      ? new Date(ev.timestamp * 1000)  // SendGrid sends Unix SECONDS.
      : new Date();

    // customArgs come back on the event, which is why sendEmail sets them.
    // Falling back to the send row covers events for mail sent before this
    // existed.
    let orgId = typeof ev.orgId === 'string' ? ev.orgId : null;
    if (!orgId && ev.sg_message_id) {
      const [send] = await db`
        SELECT org_id FROM email_sends WHERE sg_message_id = ${ev.sg_message_id} LIMIT 1
      `;
      orgId = send?.org_id ?? null;
    }

    const inserted = await db`
      INSERT INTO email_events (
        sg_event_id, sg_message_id, org_id, email, event, reason, occurred_at, payload
      ) VALUES (
        ${eventId}, ${ev.sg_message_id ?? null}, ${orgId}, ${ev.email ?? null},
        ${ev.event ?? 'unknown'}, ${ev.reason ?? null}, ${occurredAt}, ${jsonb(ev)}
      )
      ON CONFLICT (sg_event_id) DO NOTHING
      RETURNING sg_event_id
    `;
    // Already seen — a retry. Nothing below should run twice.
    if (inserted.length === 0) continue;
    stored++;

    const status = EVENT_TO_STATUS[ev.event ?? ''];
    if (status && ev.sg_message_id) {
      await db`
        UPDATE email_sends
        SET status = ${status},
            error = ${ev.reason ?? null},
            updated_at = NOW()
        WHERE sg_message_id = ${ev.sg_message_id}
          AND lower(to_email) = ${(ev.email ?? '').toLowerCase()}
          AND status <> ALL(${TERMINAL})
      `;
    }

    // THE POINT OF ALL THIS. A hard bounce, a block or a complaint stops the
    // address being mailed again — which is the loop that has been open since
    // the network sent its first letter.
    if (orgId && ev.email && ['bounce', 'dropped', 'spamreport', 'unsubscribe', 'group_unsubscribe'].includes(ev.event ?? '')) {
      // A soft bounce is a full mailbox or a greylist, not a dead address, and
      // suppressing on one would lose a real recipient permanently.
      const soft = ev.event === 'bounce' && String((ev as Record<string, unknown>).type ?? '') === 'blocked';
      if (!soft) {
        await db`
          INSERT INTO contacts (id, org_id, email, status, source)
          VALUES (${nanoid()}, ${orgId}, ${ev.email}, 'unsubscribed', ${`sg:${ev.event}`})
          ON CONFLICT (org_id, lower(email))
          DO UPDATE SET status = 'unsubscribed', updated_at = NOW()
        `;
        suppressed++;
      }
    }
  }

  return { received: events.length, stored, suppressed };
}

export interface ActivityRow {
  id: string;
  direction: 'sent' | 'received';
  kind: string;
  who: string;
  subject: string | null;
  status: string;
  at: string;
}

/**
 * Recent email activity, both directions, for the card and the suite's top.
 *
 * A UNION rather than two lists because "what has this org's email been doing"
 * is one question. Sends collapse to one row per (kind, subject, minute) so a
 * newsletter to two hundred people is one line and not two hundred — an
 * activity feed that a single send can flood tells you nothing.
 */
export async function recentActivity(orgId: string, limit = 12): Promise<ActivityRow[]> {
  const n = Math.min(Math.max(limit, 1), 100);

  const sent = await db`
    SELECT min(id) AS id,
           kind,
           count(*)::int AS n,
           max(subject) AS subject,
           max(sent_at) AS at,
           min(to_email) AS who,
           count(*) FILTER (WHERE status IN ('bounced','blocked','failed','spam'))::int AS bad
    FROM email_sends
    WHERE org_id = ${orgId}
    GROUP BY kind, subject, date_trunc('minute', sent_at)
    ORDER BY max(sent_at) DESC
    LIMIT ${n}
  `;

  const received = await db`
    SELECT id, from_email, from_name, subject, classification, state, received_at
    FROM email_inbox
    WHERE org_id = ${orgId} AND classification <> 'spam'
    ORDER BY received_at DESC
    LIMIT ${n}
  `;

  const rows: ActivityRow[] = [
    ...sent.map((r) => ({
      id: r.id as string,
      direction: 'sent' as const,
      kind: r.kind as string,
      who: (r.n as number) > 1 ? `${r.n} recipients` : (r.who as string),
      subject: (r.subject as string) ?? null,
      status: (r.bad as number) > 0 ? `${r.bad} failed` : 'sent',
      at: (r.at as Date).toISOString(),
    })),
    ...received.map((r) => ({
      id: r.id as string,
      direction: 'received' as const,
      kind: r.classification as string,
      who: (r.from_name as string) || (r.from_email as string),
      subject: (r.subject as string) ?? null,
      status: r.state as string,
      at: (r.received_at as Date).toISOString(),
    })),
  ];

  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}

export interface DeliveryStats {
  sent: number;
  delivered: number;
  bounced: number;
  unsubscribed: number;
  /** Sends still only queued — no event has arrived. Honest, not zero. */
  pending: number;
}

/**
 * Real numbers for one send kind, from the events rather than the attempts.
 *
 * This is what replaces `newsletter.sentCount`: an editor reading "sent to
 * 240" deserves to know that 31 of them bounced.
 */
export async function deliveryStats(orgId: string, kind?: string): Promise<DeliveryStats> {
  const rows = kind
    ? await db`SELECT status, count(*)::int AS n FROM email_sends
               WHERE org_id = ${orgId} AND kind = ${kind} GROUP BY status`
    : await db`SELECT status, count(*)::int AS n FROM email_sends
               WHERE org_id = ${orgId} GROUP BY status`;

  const by = new Map(rows.map((r) => [r.status as string, r.n as number]));
  const get = (s: string) => by.get(s) ?? 0;

  return {
    sent: [...by.values()].reduce((a, b) => a + b, 0),
    delivered: get('delivered') + get('opened'),
    bounced: get('bounced') + get('blocked') + get('failed'),
    unsubscribed: get('unsubscribed') + get('spam'),
    pending: get('queued'),
  };
}
