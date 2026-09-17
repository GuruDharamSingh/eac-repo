import { db } from '@elkdonis/db';

// ============================================================================
// Quotes — the line that turns over on a person's center.
//
// The smallest content on the network: a body, who said it, where it is
// from. Deliberately NOT a `threads` kind (migration 127's header says why):
// a line that shows for twelve seconds wants no permalink, no feed position
// and no place in forum search.
//
// Two scopes. A row with `org_id` belongs to that organisation and shows only
// on its center; a row with none belongs to the collective and shows on every
// center. The org's own lead, so an organisation speaks first on its own site.
//
// Submission is open to anyone signed in and lands `pending`. Publishing is
// the caller's authorisation to make — an owner or guide of the org, or a
// platform admin for the network's own — the way every other write in this
// package leaves the role check to its route.
// ============================================================================

export type QuoteStatus = 'pending' | 'published' | 'hidden';

export interface Quote {
  id: string;
  /** Null for the collective's own. */
  orgId: string | null;
  body: string;
  attribution: string | null;
  source: string | null;
  submittedBy: string | null;
  /** Who submitted it, for the moderation queue. */
  submittedByName: string | null;
  status: QuoteStatus;
  weight: number;
  createdAt: string;
}

interface QuoteRow {
  id: string;
  org_id: string | null;
  body: string;
  attribution: string | null;
  source: string | null;
  submitted_by: string | null;
  submitted_by_name: string | null;
  status: QuoteStatus;
  weight: number;
  created_at: Date;
}

const map = (r: QuoteRow): Quote => ({
  id: r.id,
  orgId: r.org_id,
  body: r.body,
  attribution: r.attribution,
  source: r.source,
  submittedBy: r.submitted_by,
  submittedByName: r.submitted_by_name ?? null,
  status: r.status,
  weight: r.weight,
  createdAt: r.created_at.toISOString(),
});

/** What a person may write in one. Long enough for a paragraph, short of an essay. */
export const QUOTE_MAX_BODY = 600;
const MAX_NAME = 120;

const clean = (v: string | null | undefined, max: number): string | null => {
  const s = (v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * The band's read: this org's published lines first, then the collective's.
 *
 * Ordered, not shuffled — the rotation happens in the browser, where it can
 * be paused, and a server that reordered on every request would make the
 * band's position meaningless across a refresh. Weight is the only thumb on
 * the scale; a line the collective wants leading says so with a number.
 */
export async function listCenterQuotes(
  orgId: string,
  opts: { limit?: number } = {}
): Promise<Quote[]> {
  const limit = Math.min(40, Math.max(1, opts.limit ?? 12));
  try {
    const rows = await db<QuoteRow[]>`
      SELECT q.id, q.org_id, q.body, q.attribution, q.source, q.submitted_by,
             u.display_name AS submitted_by_name, q.status, q.weight, q.created_at
      FROM quotes q
      LEFT JOIN users u ON u.id = q.submitted_by
      WHERE q.status = 'published'
        AND (q.org_id = ${orgId} OR q.org_id IS NULL)
      ORDER BY (q.org_id IS NOT NULL) DESC, q.weight DESC, q.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(map);
  } catch (error) {
    console.error(`[quotes] listCenterQuotes(${orgId}):`, error);
    return [];
  }
}

/**
 * The moderation queue. `orgId` null reads the collective's own rows; pass an
 * org to read that organisation's. Callers authorise.
 */
export async function listQuotes(
  orgId: string | null,
  opts: { status?: QuoteStatus | 'all'; limit?: number } = {}
): Promise<Quote[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const status = opts.status ?? 'all';
  try {
    const rows = await db<QuoteRow[]>`
      SELECT q.id, q.org_id, q.body, q.attribution, q.source, q.submitted_by,
             u.display_name AS submitted_by_name, q.status, q.weight, q.created_at
      FROM quotes q
      LEFT JOIN users u ON u.id = q.submitted_by
      WHERE ${orgId === null ? db`q.org_id IS NULL` : db`q.org_id = ${orgId}`}
        AND ${status === 'all' ? db`TRUE` : db`q.status = ${status}`}
      ORDER BY (q.status = 'pending') DESC, q.weight DESC, q.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(map);
  } catch (error) {
    console.error(`[quotes] listQuotes(${orgId ?? 'network'}):`, error);
    return [];
  }
}

export interface SubmitQuoteInput {
  /** Null files it under the collective. */
  orgId: string | null;
  body: string;
  attribution?: string | null;
  source?: string | null;
  submittedBy: string;
  /** Only a caller that has checked the role passes this. */
  status?: QuoteStatus;
}

/**
 * Add a line. Returns null when the body is too short to be a quote, and the
 * existing row when the same line is already filed in the same scope — a
 * duplicate submission is not an error to show a person, it is a shrug.
 */
export async function submitQuote(input: SubmitQuoteInput): Promise<Quote | null> {
  const body = clean(input.body, QUOTE_MAX_BODY);
  if (!body || body.length < 8) return null;

  try {
    const rows = await db<QuoteRow[]>`
      INSERT INTO quotes (org_id, body, attribution, source, submitted_by, status)
      VALUES (
        ${input.orgId},
        ${body},
        ${clean(input.attribution, MAX_NAME)},
        ${clean(input.source, MAX_NAME)},
        ${input.submittedBy},
        ${input.status ?? 'pending'}
      )
      ON CONFLICT DO NOTHING
      RETURNING id, org_id, body, attribution, source, submitted_by,
                NULL::text AS submitted_by_name, status, weight, created_at
    `;
    if (rows[0]) return map(rows[0]);

    const existing = await db<QuoteRow[]>`
      SELECT q.id, q.org_id, q.body, q.attribution, q.source, q.submitted_by,
             u.display_name AS submitted_by_name, q.status, q.weight, q.created_at
      FROM quotes q
      LEFT JOIN users u ON u.id = q.submitted_by
      WHERE COALESCE(q.org_id, '~network') = COALESCE(${input.orgId}::varchar, '~network')
        AND lower(btrim(q.body)) = lower(btrim(${body}))
      LIMIT 1
    `;
    return existing[0] ? map(existing[0]) : null;
  } catch (error) {
    console.error('[quotes] submitQuote:', error);
    return null;
  }
}

/** Publish, hide or re-queue one. Callers authorise; a missing row is null. */
export async function setQuoteStatus(
  id: string,
  status: QuoteStatus,
  opts: { weight?: number } = {}
): Promise<Quote | null> {
  const weight =
    typeof opts.weight === 'number' && Number.isFinite(opts.weight)
      ? Math.max(-100, Math.min(100, Math.round(opts.weight)))
      : null;
  try {
    const rows = await db<QuoteRow[]>`
      UPDATE quotes
         SET status = ${status},
             weight = COALESCE(${weight}::int, weight),
             updated_at = NOW()
       WHERE id = ${id}
      RETURNING id, org_id, body, attribution, source, submitted_by,
                NULL::text AS submitted_by_name, status, weight, created_at
    `;
    return rows[0] ? map(rows[0]) : null;
  } catch (error) {
    console.error(`[quotes] setQuoteStatus(${id}):`, error);
    return null;
  }
}

/** Remove one outright. Callers authorise. */
export async function deleteQuote(id: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ id: string }>>`
      DELETE FROM quotes WHERE id = ${id} RETURNING id
    `;
    return rows.length > 0;
  } catch (error) {
    console.error(`[quotes] deleteQuote(${id}):`, error);
    return false;
  }
}
