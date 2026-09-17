import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

// ============================================================================
// Mail that comes back.
//
// The network has been write-only since it started sending. This is the other
// half: one Inbound Parse host for the whole network, tenancy carried in the
// address rather than in the routing, because SendGrid cannot route two
// addresses on one host to two different endpoints.
//
//     inbound.elkdonis-arts.org.  MX 10 mx.sendgrid.net.
//
//     ifac@inbound.elkdonis-arts.org         → org `ifac`, a fresh enquiry
//     ifac.k3n9x2@inbound.elkdonis-arts.org  → org `ifac`, a reply on a thread
//
// See migration 134 for why a subdomain and not the orgs' own domains (they
// all carry live Bluehost MX records that receiving would destroy).
//
// EVERYTHING HERE IS UNTRUSTED. `from` on an SMTP message is written by the
// sender and verified by nobody; matching it to a contact is a convenience for
// whoever reads the inbox, never authentication. Bodies are stored raw and
// sanitised at render, because sanitising on the way in destroys the evidence
// of what was actually sent.
// ============================================================================

/**
 * postgres.js wants a tagged jsonb value, and `${JSON.stringify(x)}::jsonb`
 * stores a jsonb *string* instead — the bug migration 129 had to undo across
 * every stored email config. One helper so it cannot be got wrong again.
 */
function jsonb(value: unknown): ReturnType<typeof db.json> {
  return db.json(value as never);
}

/** The one host every org's inbound address sits on. */
export function inboundHost(): string {
  return process.env.EMAIL_INBOUND_DOMAIN ?? 'inbound.elkdonis-arts.org';
}

/** Whether inbound is configured at all. Drives whether the UI offers it. */
export function inboundEnabled(): boolean {
  return Boolean(process.env.EMAIL_INBOUND_DOMAIN);
}

/**
 * An org id is `hidden-enneagram` or `amrit_canada` — underscores are legal in
 * a local part but they read as a typo and some older relays mangle them, so
 * the address form uses hyphens and the reverse map is done against the real
 * org ids rather than by transforming the string back.
 */
function localPartFor(orgId: string): string {
  return orgId.toLowerCase().replace(/_/g, '-');
}

/** Where this org's replies land, if it has switched inbound on. */
export function inboundAddressFor(orgId: string): string {
  return `${localPartFor(orgId)}@${inboundHost()}`;
}

/**
 * A reply address that remembers what it is answering.
 *
 * The token is the thread id, which is already a nanoid and already opaque, so
 * nothing new has to be minted or stored. It is NOT a secret and nothing is
 * authorised by holding it: knowing it lets you file a message against a
 * thread, which is exactly what replying to that thread's letter does anyway.
 */
export function inboundAddressForThread(orgId: string, threadId: string): string {
  return `${localPartFor(orgId)}.${threadId}@${inboundHost()}`;
}

export interface ParsedInboundRecipient {
  orgId: string | null;
  threadId: string | null;
}

/**
 * Work out who a message was for.
 *
 * Takes the list of real org ids rather than transforming the local part,
 * because `hidden-enneagram` and `amrit_canada` do not round-trip through one
 * substitution and guessing would silently file one org's mail under another.
 *
 * ── The thread token's CASE is preserved, and this is load-bearing ─────────
 *
 * A thread id is a nanoid over a 64-character alphabet, so `abc123XYZ` and
 * `abc123xyz` are different threads. Lowercasing the whole local part — which
 * is the obvious thing to do to an email address, and what this function did
 * until a test caught it — turned every reply token into an id that matches no
 * row, which would have filed every single reply as an orphan.
 *
 * So the ORG part is matched case-insensitively (it is our own slug, and mail
 * clients do lowercase addresses) while the token is returned exactly as it
 * arrived. A caller that finds no thread for it should retry case-insensitively
 * and accept the result only when it is unambiguous — see the inbound route.
 */
export function parseInboundRecipient(
  toAddress: string,
  orgIds: string[]
): ParsedInboundRecipient {
  const local = (toAddress.split('@')[0] ?? '').trim();
  if (!local) return { orgId: null, threadId: null };

  // `org` or `org.threadid`. Split on the FIRST dot only: a thread id is a
  // nanoid and its alphabet has no dot, so anything after the first one is
  // part of the token.
  const dot = local.indexOf('.');
  const orgPart = (dot === -1 ? local : local.slice(0, dot)).toLowerCase();
  const threadId = dot === -1 ? null : local.slice(dot + 1) || null;

  const orgId = orgIds.find((id) => localPartFor(id) === orgPart) ?? null;
  return { orgId, threadId };
}

export type InboundClassification = 'reply' | 'enquiry' | 'auto' | 'bounce' | 'spam';
export type InboxState = 'unread' | 'read' | 'archived';

export interface InboxMessage {
  id: string;
  orgId: string;
  threadId: string | null;
  contactId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  classification: InboundClassification;
  state: InboxState;
  attachments: Array<{ name: string; type?: string; size?: number; url?: string }>;
  spamScore: number | null;
  receivedAt: string;
}

/**
 * What kind of arrival this is.
 *
 * Deliberately conservative, and in this order: a thing that is BOTH an
 * auto-reply and a reply to a thread is an auto-reply, because the point of
 * the distinction is whether a human is waiting for an answer. Headers are the
 * evidence where we have them; subject matching is a fallback and is only ever
 * allowed to downgrade a message out of the unread count, never to promote one
 * into it.
 */
export function classifyInbound(input: {
  subject?: string | null;
  headers?: Record<string, string>;
  fromEmail: string;
  spamScore?: number | null;
  hasThread: boolean;
}): InboundClassification {
  const h = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])
  );

  // RFC 3834 and the de-facto headers every vacation responder sets.
  if (
    h['auto-submitted'] && h['auto-submitted'].toLowerCase() !== 'no'
  ) return 'auto';
  if (h['x-autoreply'] || h['x-autorespond'] || h['precedence']?.toLowerCase() === 'auto_reply') {
    return 'auto';
  }

  const from = input.fromEmail.toLowerCase();
  const subject = (input.subject ?? '').toLowerCase();

  // A bounce arrives from the null sender or a postmaster-ish address. Note
  // that most bounces for OUR sends never reach here at all — they go to
  // SendGrid's return path and arrive as webhook events instead (see
  // migration 135). This catches the ones sent to the From address by hand.
  if (
    from === '' ||
    from.startsWith('mailer-daemon@') ||
    from.startsWith('postmaster@') ||
    /^(undeliverable|delivery status notification|mail delivery)/.test(subject)
  ) {
    return 'bounce';
  }

  // SpamAssassin's own conventional threshold. Only applied when Parse is
  // configured to supply a score at all.
  if (typeof input.spamScore === 'number' && input.spamScore >= 5) return 'spam';

  if (/^(out of office|automatic reply|autoreply)/.test(subject)) return 'auto';

  return input.hasThread ? 'reply' : 'enquiry';
}

/** Strip `Name <addr>` down to the address. Returns '' for the null sender. */
export function addressOf(raw: string | null | undefined): string {
  if (!raw) return '';
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/** The display name from `Name <addr>`, when there is one. */
export function displayNameOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*</);
  const name = m?.[1]?.trim();
  return name ? name : null;
}

export interface RecordInboundInput {
  orgId: string;
  threadId?: string | null;
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  classification: InboundClassification;
  attachments?: InboxMessage['attachments'];
  spamScore?: number | null;
  envelope?: unknown;
  messageId?: string | null;
}

/**
 * File one arrival.
 *
 * Returns the row id, or null when this exact message has already been filed —
 * Parse has no delivery guarantee and retries the same POST, so a duplicate is
 * expected traffic rather than an error worth raising.
 */
export async function recordInbound(input: RecordInboundInput): Promise<string | null> {
  const id = nanoid();

  // The contact match is a lookup, not a claim — see the header. A row that
  // matches nobody is still filed; the inbox simply shows the raw address.
  const [contact] = await db`
    SELECT id FROM contacts
    WHERE org_id = ${input.orgId} AND lower(email) = ${input.fromEmail.toLowerCase()}
    LIMIT 1
  `;

  const rows = await db`
    INSERT INTO email_inbox (
      id, org_id, thread_id, contact_id, from_email, from_name, to_email,
      subject, body_text, body_html, classification, attachments, spam_score,
      envelope, message_id
    ) VALUES (
      ${id}, ${input.orgId}, ${input.threadId ?? null}, ${contact?.id ?? null},
      ${input.fromEmail}, ${input.fromName ?? null}, ${input.toEmail},
      ${input.subject ?? null}, ${input.bodyText ?? null}, ${input.bodyHtml ?? null},
      ${input.classification},
      ${jsonb(input.attachments ?? [])},
      ${input.spamScore ?? null},
      ${input.envelope === undefined ? null : jsonb(input.envelope)},
      ${input.messageId ?? null}
    )
    ON CONFLICT (org_id, message_id) WHERE message_id IS NOT NULL DO NOTHING
    RETURNING id
  `;

  return rows[0]?.id ?? null;
}

function mapMessage(r: Record<string, unknown>): InboxMessage {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    threadId: (r.thread_id as string) ?? null,
    contactId: (r.contact_id as string) ?? null,
    fromEmail: r.from_email as string,
    fromName: (r.from_name as string) ?? null,
    toEmail: r.to_email as string,
    subject: (r.subject as string) ?? null,
    bodyText: (r.body_text as string) ?? null,
    bodyHtml: (r.body_html as string) ?? null,
    classification: r.classification as InboundClassification,
    state: r.state as InboxState,
    attachments: (r.attachments as InboxMessage['attachments']) ?? [],
    spamScore: (r.spam_score as number) ?? null,
    receivedAt: (r.received_at as Date).toISOString(),
  };
}

export interface ListInboxOptions {
  /** Default 25. */
  limit?: number;
  /** Omit for everything but spam; 'all' includes it. */
  filter?: 'needs-reply' | 'all';
  /** Only this thread's correspondence. */
  threadId?: string;
}

/**
 * An org's inbox, newest first.
 *
 * Spam is excluded by default and included only on request: an org owner
 * opening their hub should not be shown what a filter already decided about,
 * but they must be able to go and check that the filter was right.
 */
export async function listInbox(
  orgId: string,
  options: ListInboxOptions = {}
): Promise<InboxMessage[]> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);

  const rows = options.threadId
    ? await db`
        SELECT * FROM email_inbox
        WHERE org_id = ${orgId} AND thread_id = ${options.threadId}
        ORDER BY received_at DESC LIMIT ${limit}
      `
    : options.filter === 'all'
      ? await db`
          SELECT * FROM email_inbox WHERE org_id = ${orgId}
          ORDER BY received_at DESC LIMIT ${limit}
        `
      : options.filter === 'needs-reply'
        ? await db`
            SELECT * FROM email_inbox
            WHERE org_id = ${orgId}
              AND state = 'unread'
              AND classification IN ('reply','enquiry')
            ORDER BY received_at DESC LIMIT ${limit}
          `
        : await db`
            SELECT * FROM email_inbox
            WHERE org_id = ${orgId} AND classification <> 'spam'
            ORDER BY received_at DESC LIMIT ${limit}
          `;

  return rows.map(mapMessage);
}

/** The badge. Counts only what a person is actually waiting on an answer for. */
export async function unreadCount(orgId: string): Promise<number> {
  const [row] = await db`
    SELECT count(*)::int AS n FROM email_inbox
    WHERE org_id = ${orgId}
      AND state = 'unread'
      AND classification IN ('reply','enquiry')
  `;
  return row?.n ?? 0;
}

/** Org-scoped on purpose: the id alone must never be enough to read a letter. */
export async function getInboxMessage(
  orgId: string,
  id: string
): Promise<InboxMessage | null> {
  const [row] = await db`
    SELECT * FROM email_inbox WHERE org_id = ${orgId} AND id = ${id}
  `;
  return row ? mapMessage(row) : null;
}

export async function setInboxState(
  orgId: string,
  id: string,
  state: InboxState
): Promise<boolean> {
  const rows = await db`
    UPDATE email_inbox SET state = ${state}
    WHERE org_id = ${orgId} AND id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Move a message out of spam, or into it.
 *
 * Separate from `setInboxState` because it is a different judgement: state is
 * "have I dealt with this", classification is "what is it". A guide rescuing
 * something the filter caught is correcting the second, and marking it unread
 * at the same time is the only useful outcome — otherwise it reappears in a
 * list already ticked off.
 */
export async function reclassifyInbox(
  orgId: string,
  id: string,
  classification: InboundClassification
): Promise<boolean> {
  const rows = await db`
    UPDATE email_inbox
    SET classification = ${classification},
        state = CASE WHEN ${classification} = 'spam' THEN 'archived' ELSE 'unread' END
    WHERE org_id = ${orgId} AND id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}
