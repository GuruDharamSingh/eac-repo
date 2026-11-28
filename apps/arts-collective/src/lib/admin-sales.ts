import { db } from "@elkdonis/db";

/**
 * Read model for /hub/admin/sales: every commerce order on the network, across
 * apps and seller orgs (2026-11-27, agent G; docs: team board section 7).
 *
 * Read-only. Tables read: commerce_order, commerce_order_line, store, threads,
 * users (seller and buyer names), bookings (order link). Nothing here writes.
 *
 * One row per order. An order's lines are folded into the row (what, line org,
 * payee orgs, seller users); every order today has one line.
 *
 * Definitions (derived, not stored):
 * - seller org: metadata.sellerOrgId (network-sold offers: 'oad'), else the
 *   store's org, else the first line's org_id.
 * - thread org: metadata.threadOrgId, else the offer thread's own org.
 * - source: metadata.source ('buy_now'), else metadata.kind ('auction', 'tour',
 *   'service'...), else the offer thread's kind, else 'artwork' for an artwork
 *   line, else 'other'. Orders do not record the app that took them; the
 *   source is the nearest stored fact.
 * - counted (in gross): paid, payment_received, fulfilled, completed, refunded.
 * - refunded: status 'refunded'. The platform refunds in full only
 *   (refundOrder), so the refunded amount is the order total. A refund made
 *   in the Stripe dashboard is not visible here.
 * - Stripe reference: payment_reference as stored (a payment intent id for
 *   card orders, the order number for e-transfer), plus
 *   payment_metadata.stripe.sessionId.
 */

export const SALES_STATUSES = [
  "draft",
  "pending_payment",
  "awaiting_etransfer",
  "payment_received",
  "paid",
  "fulfilled",
  "completed",
  "cancelled",
  "refunded",
] as const;
export const SALES_METHODS = ["stripe", "etransfer", "manual"] as const;

/** Statuses whose money was received (the gross). */
export const COUNTED_STATUSES = ["payment_received", "paid", "fulfilled", "completed", "refunded"] as const;
/** Statuses an admin may refund (refundOrder's own guard). */
export const REFUNDABLE_STATUSES = ["paid", "fulfilled", "completed"] as const;

export const SALES_PAGE_SIZE = 50;
export const SALES_EXPORT_MAX = 5000;

export type SalesFilters = {
  source?: string;
  org?: string;
  seller?: string;
  status?: string;
  method?: string;
  from?: string;
  to?: string;
  refunded?: "yes" | "no";
};

export type SalesRow = {
  id: string;
  number: string;
  createdAt: string;
  paidAt: string | null;
  buyerName: string | null;
  buyerEmail: string;
  what: string;
  lineCount: number;
  source: string;
  sellerOrg: string | null;
  lineOrg: string | null;
  threadOrg: string | null;
  threadId: string | null;
  networkSale: boolean;
  payee: string | null;
  payeeOrgs: string[];
  sellerUser: string | null;
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  status: string;
  refundedMinor: number;
  paymentReference: string | null;
  stripeSessionId: string | null;
  stripeRefundReference: string | null;
  bookingId: string | null;
  /** Keyset cursor for the page after this row. */
  cursor: string;
  refundable: boolean;
};

export type SalesTotal = {
  currency: string;
  paymentMethod: string;
  orders: number;
  grossMinor: number;
  refundedMinor: number;
  netMinor: number;
};

const SLUG = /^[a-z0-9_-]{1,50}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Filters from URL search params; anything malformed is dropped, never passed to SQL. */
export function parseSalesFilters(sp: Record<string, string | string[] | undefined>): SalesFilters {
  const f: SalesFilters = {};
  const source = one(sp.source)?.trim();
  if (source && /^[\w-]{1,40}$/.test(source)) f.source = source;
  const org = one(sp.org)?.trim();
  if (org && SLUG.test(org)) f.org = org;
  const seller = one(sp.seller)?.trim();
  if (seller && UUID.test(seller)) f.seller = seller.toLowerCase();
  const status = one(sp.status)?.trim();
  if (status && (SALES_STATUSES as readonly string[]).includes(status)) f.status = status;
  const method = one(sp.method)?.trim();
  if (method && (SALES_METHODS as readonly string[]).includes(method)) f.method = method;
  const from = one(sp.from)?.trim();
  if (from && DAY.test(from) && !Number.isNaN(Date.parse(from))) f.from = from;
  const to = one(sp.to)?.trim();
  if (to && DAY.test(to) && !Number.isNaN(Date.parse(to))) f.to = to;
  const refunded = one(sp.refunded)?.trim();
  if (refunded === "yes" || refunded === "no") f.refunded = refunded;
  return f;
}

/** Filters back to a query string (for paging and the CSV link). */
export function salesQuery(f: SalesFilters, extra: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

type Cursor = { at: string; id: string } | null;

function parseCursor(raw: string | undefined): Cursor {
  if (!raw) return null;
  const i = raw.lastIndexOf("|");
  if (i < 1) return null;
  const at = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if (!UUID.test(id) || !/^\d{4}-\d{2}-\d{2}[ T][\d:.]+(\+\d{2}(:\d{2})?|Z)?$/.test(at)) return null;
  return { at, id: id.toLowerCase() };
}

/**
 * The folded order rows, one per order. A CTE so the filters can use the
 * derived columns (seller org, source) by name.
 */
const BASE = db`
  SELECT
    o.id, o.number, o.created_at, o.paid_at, o.customer_name, o.customer_email,
    o.status, o.payment_method, o.payment_reference, o.total_minor, o.currency, o.metadata,
    o.payment_metadata->'stripe'->>'sessionId' AS stripe_session_id,
    o.payment_metadata->'refund'->>'reference' AS stripe_refund_reference,
    o.payment_metadata->>'payeeName' AS payee_name,
    COALESCE(o.metadata->>'sellerOrgId', st.org_id, ln.line_org) AS seller_org,
    ln.line_org,
    COALESCE(o.metadata->>'threadOrgId', t.org_id) AS thread_org,
    ln.thread_id,
    ln.what, ln.n AS line_count, ln.payee_orgs, ln.artists,
    COALESCE(o.metadata->>'source', o.metadata->>'kind', t.kind, CASE WHEN ln.has_artwork THEN 'artwork' END, 'other') AS source,
    su.display_name AS seller_user_name,
    bk.id AS booking_id
  FROM commerce_order o
  LEFT JOIN store st ON st.id = o.store_id
  LEFT JOIN LATERAL (
    SELECT
      string_agg(l.description, ' · ' ORDER BY l.created_at, l.id) AS what,
      (array_agg(l.org_id ORDER BY l.created_at, l.id))[1] AS line_org,
      (array_agg(l.thread_id ORDER BY l.created_at, l.id) FILTER (WHERE l.thread_id IS NOT NULL))[1] AS thread_id,
      COALESCE(array_agg(DISTINCT l.payee_org_id::text) FILTER (WHERE l.payee_org_id IS NOT NULL), '{}'::text[]) AS payee_orgs,
      COALESCE(array_agg(DISTINCT l.artist_user_id::text) FILTER (WHERE l.artist_user_id IS NOT NULL), '{}'::text[]) AS artists,
      bool_or(l.artwork_id IS NOT NULL) AS has_artwork,
      count(*)::int AS n
    FROM commerce_order_line l WHERE l.order_id = o.id
  ) ln ON true
  LEFT JOIN threads t ON t.id = ln.thread_id
  LEFT JOIN users su ON su.id = (ln.artists)[1]::uuid
  LEFT JOIN LATERAL (SELECT b.id FROM bookings b WHERE b.order_id = o.id LIMIT 1) bk ON true
`;

function whereOf(f: SalesFilters) {
  const parts = [db`TRUE`];
  if (f.source) parts.push(db`source = ${f.source}`);
  if (f.org) {
    parts.push(db`(seller_org = ${f.org} OR line_org = ${f.org} OR thread_org = ${f.org} OR ${f.org} = ANY(payee_orgs))`);
  }
  if (f.seller) parts.push(db`${f.seller} = ANY(artists)`);
  if (f.status) parts.push(db`status = ${f.status}`);
  if (f.method) parts.push(db`payment_method = ${f.method}`);
  if (f.from) parts.push(db`created_at >= ${f.from}::date`);
  if (f.to) parts.push(db`created_at < (${f.to}::date + 1)`);
  if (f.refunded === "yes") parts.push(db`status = 'refunded'`);
  if (f.refunded === "no") parts.push(db`status <> 'refunded'`);
  return parts.reduce((acc, p, i) => (i === 0 ? p : db`${acc} AND ${p}`));
}

type DbRow = {
  id: string;
  number: string;
  created_at: Date;
  created_at_raw: string;
  paid_at: Date | null;
  customer_name: string | null;
  customer_email: string;
  status: string;
  payment_method: string;
  payment_reference: string | null;
  total_minor: string | number;
  currency: string;
  metadata: Record<string, unknown> | null;
  stripe_session_id: string | null;
  stripe_refund_reference: string | null;
  payee_name: string | null;
  seller_org: string | null;
  line_org: string | null;
  thread_org: string | null;
  thread_id: string | null;
  what: string | null;
  line_count: number;
  payee_orgs: string[];
  source: string;
  seller_user_name: string | null;
  booking_id: string | null;
};

function toRow(r: DbRow): SalesRow {
  const total = Number(r.total_minor);
  return {
    id: r.id,
    number: r.number,
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at ? r.paid_at.toISOString() : null,
    buyerName: r.customer_name,
    buyerEmail: r.customer_email,
    what: r.what ?? "",
    lineCount: r.line_count,
    source: r.source,
    sellerOrg: r.seller_org,
    lineOrg: r.line_org,
    threadOrg: r.thread_org,
    threadId: r.thread_id,
    networkSale: r.metadata?.networkSale === true,
    payee: r.payee_name,
    payeeOrgs: r.payee_orgs ?? [],
    sellerUser: r.seller_user_name,
    amountMinor: total,
    currency: r.currency.trim(),
    paymentMethod: r.payment_method,
    status: r.status,
    refundedMinor: r.status === "refunded" ? total : 0,
    paymentReference: r.payment_reference,
    stripeSessionId: r.stripe_session_id,
    stripeRefundReference: r.stripe_refund_reference,
    bookingId: r.booking_id,
    cursor: `${r.created_at_raw}|${r.id}`,
    refundable: (REFUNDABLE_STATUSES as readonly string[]).includes(r.status),
  };
}

/**
 * One page of orders, newest first, keyset-paged on (created_at, id).
 * Returns `next`: the cursor for the following page, or null on the last one.
 */
export async function listSales(
  f: SalesFilters,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ rows: SalesRow[]; next: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? SALES_PAGE_SIZE, 1), 500);
  const cur = parseCursor(opts.cursor);
  const after = cur ? db`AND (created_at, id) < (${cur.at}::timestamptz, ${cur.id}::uuid)` : db``;
  const rows = await db<DbRow[]>`
    WITH base AS (${BASE})
    SELECT base.*, base.created_at::text AS created_at_raw
    FROM base
    WHERE ${whereOf(f)} ${after}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit + 1}
  `;
  const page = rows.slice(0, limit).map(toRow);
  return { rows: page, next: rows.length > limit ? page[page.length - 1].cursor : null };
}

/** Totals for the whole filtered set (not just the page), per currency and payment method. */
export async function salesTotals(f: SalesFilters): Promise<SalesTotal[]> {
  const rows = await db<
    Array<{ currency: string; payment_method: string; orders: number; gross: string | null; refunded: string | null }>
  >`
    WITH base AS (${BASE})
    SELECT currency, payment_method, count(*)::int AS orders,
      COALESCE(sum(total_minor) FILTER (WHERE status = ANY(${[...COUNTED_STATUSES]}::text[])), 0) AS gross,
      COALESCE(sum(total_minor) FILTER (WHERE status = 'refunded'), 0) AS refunded
    FROM base
    WHERE ${whereOf(f)}
    GROUP BY currency, payment_method
    ORDER BY currency, payment_method
  `;
  return rows.map((r) => {
    const gross = Number(r.gross ?? 0);
    const refunded = Number(r.refunded ?? 0);
    return {
      currency: r.currency.trim(),
      paymentMethod: r.payment_method,
      orders: r.orders,
      grossMinor: gross,
      refundedMinor: refunded,
      netMinor: gross - refunded,
    };
  });
}

/** Distinct values for the filter dropdowns. */
export async function salesFilterOptions(): Promise<{ sources: string[]; orgs: string[] }> {
  const rows = await db<Array<{ kind: string; v: string }>>`
    WITH base AS (${BASE})
    SELECT 'source' AS kind, source AS v FROM base
    UNION SELECT 'org', seller_org FROM base WHERE seller_org IS NOT NULL
    UNION SELECT 'org', line_org FROM base WHERE line_org IS NOT NULL
    UNION SELECT 'org', thread_org FROM base WHERE thread_org IS NOT NULL
    ORDER BY 1, 2
  `;
  return {
    sources: rows.filter((r) => r.kind === "source").map((r) => r.v),
    orgs: rows.filter((r) => r.kind === "org").map((r) => r.v),
  };
}

/** The filtered set for the CSV, in pages, up to SALES_EXPORT_MAX rows. */
export async function exportSales(f: SalesFilters): Promise<{ rows: SalesRow[]; truncated: boolean }> {
  const out: SalesRow[] = [];
  let cursor: string | undefined;
  while (out.length < SALES_EXPORT_MAX) {
    const { rows, next } = await listSales(f, { cursor, limit: Math.min(500, SALES_EXPORT_MAX - out.length) });
    out.push(...rows);
    if (!next) return { rows: out, truncated: false };
    cursor = next;
  }
  return { rows: out, truncated: true };
}

/** Where the order's own page is, when one exists (the market's order page). */
export function orderHref(r: Pick<SalesRow, "id" | "source" | "sellerOrg" | "lineOrg">): string | null {
  const market = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "").replace(/\/$/, "");
  if (!market) return null;
  const marketOrder = r.lineOrg === "market" || r.sellerOrg === "market" || r.source === "buy_now" || r.source === "auction" || r.source === "artwork";
  return marketOrder ? `${market}/orders/${r.id}` : null;
}

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas in text taken from buyers and sellers.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const CSV_HEADER = [
  "date",
  "order",
  "buyer_name",
  "buyer_email",
  "what",
  "source",
  "seller_org",
  "line_org",
  "thread_org",
  "network_sale",
  "payee",
  "payee_orgs",
  "seller_user",
  "amount",
  "currency",
  "payment_method",
  "status",
  "refunded",
  "payment_reference",
  "stripe_session_id",
  "stripe_refund_reference",
  "order_page",
] as const;

export function salesCsv(rows: SalesRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt,
        r.number,
        r.buyerName,
        r.buyerEmail,
        r.what,
        r.source,
        r.sellerOrg,
        r.lineOrg,
        r.threadOrg,
        r.networkSale ? "yes" : "",
        r.payee,
        r.payeeOrgs.join(" "),
        r.sellerUser,
        (r.amountMinor / 100).toFixed(2),
        r.currency,
        r.paymentMethod,
        r.status,
        (r.refundedMinor / 100).toFixed(2),
        r.paymentReference,
        r.stripeSessionId,
        r.stripeRefundReference,
        orderHref(r),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
