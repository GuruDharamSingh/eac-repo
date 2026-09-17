import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@elkdonis/db";
import { sendEmail } from "@elkdonis/email";
import {
  isValidNewsletterSlug,
  newsletterKey,
  type Newsletter,
  type NewsletterSummary,
  type SendResult,
} from "./index";

// ============================================================================
// Storage, recipients and sending.
//
// Storage is `site_config` (org_id, key, value jsonb) — the same key/value
// table per organisation that Puck pages use. A newsletter is one row keyed
// "newsletter:<slug>", so this needed no migration and no new table, and one
// org's newsletter can never be read as another's because org_id is half the
// primary key.
//
// NOTHING here is an authorisation boundary. Every function takes the orgId
// it was given; the caller must already have established that the viewer may
// edit that org.
// ============================================================================

/** Refuse anything that would not survive being read back. */
const MAX_BYTES = 512 * 1024;

interface StoredNewsletter {
  title?: string;
  project?: unknown;
  html?: string;
  sentAt?: string | null;
  sentCount?: number;
}

export async function loadNewsletter(
  orgId: string,
  slug: string
): Promise<Newsletter | null> {
  if (!isValidNewsletterSlug(slug)) return null;
  try {
    const [row] = await db<Array<{ value: StoredNewsletter; updated_at: string }>>`
      SELECT value, updated_at FROM site_config
      WHERE org_id = ${orgId} AND key = ${newsletterKey(slug)}
      LIMIT 1
    `;
    if (!row) return null;
    const v = row.value ?? {};
    return {
      slug,
      title: typeof v.title === "string" ? v.title : slug,
      project: v.project ?? null,
      html: typeof v.html === "string" ? v.html : "",
      updatedAt: row.updated_at,
      sentAt: v.sentAt ?? null,
      sentCount: typeof v.sentCount === "number" ? v.sentCount : 0,
    };
  } catch (err) {
    console.error(`[newsletter] loadNewsletter(${orgId}/${slug}):`, err);
    return null;
  }
}

export async function listNewsletters(orgId: string): Promise<NewsletterSummary[]> {
  try {
    const rows = await db<Array<{ key: string; value: StoredNewsletter; updated_at: string }>>`
      SELECT key, value, updated_at FROM site_config
      WHERE org_id = ${orgId} AND key LIKE 'newsletter:%'
      ORDER BY updated_at DESC
    `;
    return rows.map((row) => {
      const v = row.value ?? {};
      const slug = row.key.slice("newsletter:".length);
      return {
        slug,
        title: typeof v.title === "string" ? v.title : slug,
        updatedAt: row.updated_at,
        sentAt: v.sentAt ?? null,
        sentCount: typeof v.sentCount === "number" ? v.sentCount : 0,
      };
    });
  } catch (err) {
    console.error(`[newsletter] listNewsletters(${orgId}):`, err);
    return [];
  }
}

export async function saveNewsletter(
  orgId: string,
  slug: string,
  input: { title: string; project: unknown; html: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidNewsletterSlug(slug)) return { ok: false, error: "Invalid name" };
  const title = (input.title ?? "").trim().slice(0, 200) || slug;

  // Merge rather than replace: sentAt/sentCount are written by the send path
  // and must survive an edit made afterwards.
  const existing = await loadNewsletter(orgId, slug);
  const payload = {
    title,
    project: input.project ?? null,
    html: typeof input.html === "string" ? input.html : "",
    sentAt: existing?.sentAt ?? null,
    sentCount: existing?.sentCount ?? 0,
  };

  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes > MAX_BYTES) {
    return { ok: false, error: `Too large to store (${Math.round(bytes / 1024)}KB)` };
  }

  try {
    await db`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${orgId}, ${newsletterKey(slug)}, ${db.json(payload as never)})
      ON CONFLICT (org_id, key) DO UPDATE
        SET value = ${db.json(payload as never)}, updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[newsletter] saveNewsletter(${orgId}/${slug}):`, err);
    return { ok: false, error: "Could not save" };
  }
}

export async function deleteNewsletter(orgId: string, slug: string): Promise<boolean> {
  if (!isValidNewsletterSlug(slug)) return false;
  try {
    await db`
      DELETE FROM site_config WHERE org_id = ${orgId} AND key = ${newsletterKey(slug)}
    `;
    return true;
  } catch (err) {
    console.error(`[newsletter] deleteNewsletter(${orgId}/${slug}):`, err);
    return false;
  }
}

// ── Recipients ──────────────────────────────────────────────────────────────

export interface Recipient {
  email: string;
  name: string | null;
}

/**
 * Who a send goes to: the org's contacts, minus anyone who unsubscribed.
 *
 * 'unsubscribed' is filtered HERE, in the one function every send path calls,
 * rather than at each call site — an unsubscribe that depends on remembering
 * to filter is not an unsubscribe.
 */
export async function listRecipients(orgId: string): Promise<Recipient[]> {
  try {
    return await db<Recipient[]>`
      SELECT DISTINCT ON (lower(email)) email, name
      FROM contacts
      WHERE org_id = ${orgId}
        AND status <> 'unsubscribed'
        AND email IS NOT NULL AND email <> ''
      ORDER BY lower(email), created_at DESC
    `;
  } catch (err) {
    console.error(`[newsletter] listRecipients(${orgId}):`, err);
    return [];
  }
}

// ── Unsubscribe ─────────────────────────────────────────────────────────────

function secret(): string {
  return (
    process.env.NEWSLETTER_SECRET ||
    process.env.INTER_APP_JWT_SECRET ||
    process.env.SILEX_SESSION_SECRET ||
    ""
  );
}

/**
 * An unguessable per-recipient token.
 *
 * An HMAC of (org, email) rather than a stored column: it needs no backfill
 * for the contacts already in the table, and it cannot be enumerated from the
 * table if the database is read.
 */
export function unsubscribeToken(orgId: string, email: string): string {
  return createHmac("sha256", secret())
    .update(`${orgId}:${email.trim().toLowerCase()}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(
  orgId: string,
  email: string,
  token: string
): boolean {
  if (!secret() || !token) return false;
  const expected = Buffer.from(unsubscribeToken(orgId, email));
  const given = Buffer.from(String(token));
  // Length check first: timingSafeEqual throws on a mismatch.
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function unsubscribeContact(
  orgId: string,
  email: string
): Promise<boolean> {
  try {
    await db`
      UPDATE contacts SET status = 'unsubscribed'
      WHERE org_id = ${orgId} AND lower(email) = ${email.trim().toLowerCase()}
    `;
    return true;
  } catch (err) {
    console.error(`[newsletter] unsubscribeContact(${orgId}):`, err);
    return false;
  }
}

// ── Sending ─────────────────────────────────────────────────────────────────

/**
 * The legally required footer, appended per recipient.
 *
 * Built here rather than left to the person composing, because an unsubscribe
 * link that depends on someone remembering to add it is exactly the one that
 * goes missing. The token is per recipient, so the link identifies who is
 * asking without them having to type anything.
 */
function withUnsubscribe(
  html: string,
  opts: { orgId: string; orgName: string; email: string; baseUrl: string }
): string {
  const url =
    `${opts.baseUrl.replace(/\/+$/, "")}/unsubscribe` +
    `?e=${encodeURIComponent(opts.email)}&t=${unsubscribeToken(opts.orgId, opts.email)}`;
  const footer =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">` +
    `<tr><td align="center" style="padding:16px;font:12px/1.5 Arial,sans-serif;color:#6b7280">` +
    `You are receiving this because you signed up with ${escapeHtml(opts.orgName)}.<br>` +
    `<a href="${url}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a>` +
    `</td></tr></table>`;

  // Before </body> when there is one, appended otherwise — the editor's export
  // is a full document, but a hand-pasted fragment should still get a footer.
  return html.includes("</body>")
    ? html.replace("</body>", `${footer}</body>`)
    : html + footer;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/**
 * Send one newsletter.
 *
 * Sequential, not `Promise.all`: this goes through one SendGrid account shared
 * by every org on the network, and a burst of parallel sends is how that
 * account gets rate-limited or flagged. A failure on one address is counted
 * and skipped rather than aborting the run — the alternative is a half-sent
 * newsletter with no record of where it stopped.
 */
export async function sendNewsletter(opts: {
  orgId: string;
  orgName: string;
  slug: string;
  baseUrl: string;
  /** Given, this is a test send to exactly these addresses and records nothing. */
  testTo?: string[];
  /**
   * Send despite broken links or leftover placeholders.
   *
   * Never the default. The author is shown what is wrong and chooses — a
   * newsletter is the one email here that cannot be corrected after the fact,
   * and "the workshop you linked was taken down" is a minute's work before and
   * impossible after.
   */
  force?: boolean;
}): Promise<SendResult> {
  // sendEmail warns and RETURNS when SENDGRID_API_KEY is absent, so without
  // this every address would be counted as sent and the editor would be told
  // a newsletter went out that never left the building.
  if (!process.env.SENDGRID_API_KEY) {
    return { ok: false, sent: 0, failed: 0, error: "Email is not configured on this server" };
  }

  // No secret means every unsubscribe link in this send would be rejected by
  // verifyUnsubscribeToken — a letter nobody can opt out of. Refuse here
  // rather than at unsubscribe time: this failure is silent and lands on the
  // recipient, where the only person who can fix it is the one sending.
  if (!secret()) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error:
        "No NEWSLETTER_SECRET (or INTER_APP_JWT_SECRET) is set, so unsubscribe " +
        "links would not work. Refusing to send.",
    };
  }

  const letter = await loadNewsletter(opts.orgId, opts.slug);
  if (!letter) return { ok: false, sent: 0, failed: 0, error: "Not found" };
  if (!letter.html.trim()) {
    return { ok: false, sent: 0, failed: 0, error: "Nothing to send — the letter is empty" };
  }

  // Cards stay pointed at their thread and are filled HERE, so a letter
  // composed on Monday and sent on Friday carries Friday's time.
  const ids = referencedThreadIds(letter.html);
  const cards = await loadCardsFor(opts.orgId, ids, opts.baseUrl);
  const resolved = resolveThreadCards(letter.html, cards);

  const isTest = Array.isArray(opts.testTo) && opts.testTo.length > 0;

  // A test send goes out regardless — seeing the broken card in your own inbox
  // is the point of a test. A real send stops and says what is wrong.
  if (!isTest && !opts.force) {
    const placeholders = unresolvedPlaceholders(resolved.html);
    if (resolved.missing.length > 0 || placeholders.length > 0) {
      const lines = [
        ...resolved.missing.map(
          (m) => `a card points at a thread that is no longer published${m.label ? ` — ${m.label}` : ""}`
        ),
        ...placeholders,
      ];
      return {
        ok: false,
        sent: 0,
        failed: 0,
        error: `Not sent — ${lines.join("; ")}.`,
        problems: { brokenLinks: resolved.missing, placeholders },
      };
    }
  }
  const recipients: Recipient[] = isTest
    ? opts.testTo!.map((email) => ({ email, name: null }))
    : await listRecipients(opts.orgId);

  if (recipients.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: "No recipients" };
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: letter.title,
        html: withUnsubscribe(resolved.html, {
          orgId: opts.orgId,
          orgName: opts.orgName,
          email: recipient.email,
          baseUrl: opts.baseUrl,
        }),
        // The org's own identity: From name, reply-to, and — once one exists —
        // its ASM group, which is what makes SendGrid emit the one-click
        // List-Unsubscribe header alongside the footer link below.
        orgId: opts.orgId,
        kind: 'newsletter',
        customArgs: { newsletter: opts.slug },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[newsletter] send to ${recipient.email} failed:`, err);
    }
  }

  // A test send must not mark the letter as sent — that record is what tells
  // an editor whether the real thing has gone out.
  if (!isTest && sent > 0) {
    try {
      await db`
        UPDATE site_config
        SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
              'sentAt', to_jsonb(NOW()::text),
              'sentCount', to_jsonb(${sent}::int)
            )
        WHERE org_id = ${opts.orgId} AND key = ${newsletterKey(opts.slug)}
      `;
    } catch (err) {
      console.error("[newsletter] could not record the send:", err);
    }
  }

  return { ok: sent > 0, sent, failed };
}

// ─── linked thread cards ─────────────────────────────────────────────────────

import {
  resolveThreadCards,
  referencedThreadIds,
  unresolvedPlaceholders,
  type ThreadCardData,
} from "./thread-cards";

const CARD_TZ = "America/Toronto";

/** The one date shape a card states. Same as the letters: a time at a door. */
function cardWhen(value: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: CARD_TZ,
      timeZoneName: "short",
    });
  } catch {
    return null;
  }
}

interface ThreadRow {
  id: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  location: string | null;
  scheduled_at: Date | null;
  published_at: Date | null;
  cover_image_url: string | null;
  org_name: string | null;
}

function toCard(row: ThreadRow, baseUrl: string): ThreadCardData {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    when: cardWhen(row.scheduled_at),
    where: row.location,
    summary: row.excerpt,
    url: `${baseUrl.replace(/\/+$/, "")}/${row.section ?? "posts"}/${row.slug}`,
    orgName: row.org_name,
    coverUrl: row.cover_image_url,
    published: row.published_at
      ? row.published_at.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: CARD_TZ,
        })
      : null,
  };
}

/**
 * This org's linkable threads, newest and soonest first.
 *
 * Published and PUBLIC only, and scoped to the org — `threads` is one shared
 * namespace across the whole network, so a query that forgets `org_id` offers
 * an author somebody else's workshop to put in their letter.
 */
export async function listThreadsForCards(
  orgId: string,
  baseUrl: string,
  limit = 40
): Promise<ThreadCardData[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT t.id, t.title, t.slug, t.kind, t.section, t.excerpt, t.location,
             t.scheduled_at, t.published_at,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             o.name AS org_name
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.org_id = ${orgId}
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY
        (t.scheduled_at IS NOT NULL AND t.scheduled_at >= NOW()) DESC,
        t.scheduled_at ASC NULLS LAST,
        COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => toCard(row, baseUrl));
  } catch (err) {
    console.error(`[newsletter] listThreadsForCards(${orgId}):`, err);
    return [];
  }
}

/** The live rows behind the cards in one letter. */
async function loadCardsFor(
  orgId: string,
  ids: string[],
  baseUrl: string
): Promise<Map<string, ThreadCardData>> {
  if (ids.length === 0) return new Map();
  try {
    const rows = await db<ThreadRow[]>`
      SELECT t.id, t.title, t.slug, t.kind, t.section, t.excerpt, t.location,
             t.scheduled_at, t.published_at,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             o.name AS org_name
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.id = ANY(${ids})
        AND t.org_id = ${orgId}
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
    `;
    return new Map(rows.map((row) => [row.id, toCard(row, baseUrl)]));
  } catch (err) {
    console.error(`[newsletter] loadCardsFor(${orgId}):`, err);
    return new Map();
  }
}

export interface LetterProblems {
  /** Cards pointing at a thread that is gone, unpublished, or another org's. */
  brokenLinks: { id: string; label: string | null }[];
  /** Block placeholder copy the author never replaced. */
  placeholders: string[];
}

/**
 * What is wrong with a letter, before it goes anywhere.
 *
 * Both halves are the same class of mistake — something on the canvas that was
 * never made real — and both are invisible once the letter is in inboxes.
 */
export async function checkLetter(
  orgId: string,
  slug: string,
  baseUrl: string
): Promise<LetterProblems> {
  const letter = await loadNewsletter(orgId, slug);
  const html = letter?.html ?? "";
  const ids = referencedThreadIds(html);
  const threads = await loadCardsFor(orgId, ids, baseUrl);
  const { missing } = resolveThreadCards(html, threads);
  return { brokenLinks: missing, placeholders: unresolvedPlaceholders(html) };
}
