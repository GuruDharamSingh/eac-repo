// CONTRACT: service commissions (server only). Payment is a STUB: payment_status is always stub, no money moves. Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { CommissionProposal, CommissionStatus, CommissionUnit, ServiceCommission } from "@/lib/catalogue-types";

/**
 * service_commissions (migration 236): an org books an artist's public
 * service listing at the listed price. Same terms for any org. NO MONEY
 * PATH: payment_status is pinned to 'stub' by a CHECK until Justin picks the
 * payment model (spec Q1); payment_ref is reserved for it. Callers check
 * roles: the buyer org's editors propose/cancel/complete, the seller answers.
 */

type Row = Record<string, unknown>;
const UNITS: CommissionUnit[] = ["per_run", "per_guest", "flat"];
const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

function mapCommission(r: Row): ServiceCommission {
  return {
    id: r.id as string,
    serviceThreadId: r.service_thread_id as string,
    serviceTitle: (r.service_title as string) ?? "",
    sellerUserId: r.seller_user_id as string,
    sellerName: (r.seller_name as string | null) ?? null,
    buyerOrgId: r.buyer_org_id as string,
    requestedBy: (r.requested_by as string | null) ?? null,
    experienceThreadId: (r.experience_thread_id as string | null) ?? null,
    tourThreadId: (r.tour_thread_id as string | null) ?? null,
    departureId: (r.departure_id as string | null) ?? null,
    unit: r.unit as CommissionUnit,
    quantity: Number(r.quantity ?? 1),
    priceCents: r.price_cents == null ? null : Number(r.price_cents),
    currency: (r.currency as string | null) ?? null,
    termsSnapshot: (r.terms_snapshot as string | null) ?? null,
    status: r.status as CommissionStatus,
    paymentStatus: "stub",
    paymentRef: (r.payment_ref as string | null) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    respondedAt: iso(r.responded_at),
  };
}

const SELECT = db`
  SELECT c.*, s.title AS service_title, u.display_name AS seller_name
  FROM service_commissions c
  JOIN threads s ON s.id = c.service_thread_id
  LEFT JOIN users u ON u.id = c.seller_user_id
`;

async function getCommission(id: string): Promise<ServiceCommission | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = (await db`${SELECT} WHERE c.id = ${id}`) as unknown as Row[];
  return r ? mapCommission(r) : null;
}

/** Snapshot the listing's price and terms; the seller is the service thread's author. */
export async function proposeCommission(input: CommissionProposal, requestedBy: string, buyerOrgId: string = siteConfig.orgId): Promise<ServiceCommission> {
  if (!UNITS.includes(input.unit)) throw new Error("Unknown unit.");
  const [svc] = (await db`
    SELECT id, author_id, price, currency, metadata FROM threads
    WHERE id = ${input.serviceThreadId} AND kind = 'service' AND status = 'published' AND visibility = 'PUBLIC'
  `) as unknown as Row[];
  if (!svc || !svc.author_id) throw new Error("That service listing is not public.");
  for (const [col, val, kind] of [
    ["experience", input.experienceThreadId, "experience"],
    ["tour", input.tourThreadId, "tour"],
  ] as const) {
    if (!val) continue;
    const [t] = (await db`SELECT id FROM threads WHERE id = ${val} AND org_id = ${buyerOrgId} AND kind = ${kind}`) as unknown as Row[];
    if (!t) throw new Error(`That ${col} is not on this site.`);
  }
  if (input.departureId) {
    const [d] = (await db`SELECT id FROM tour_departures WHERE id = ${input.departureId} AND org_id = ${buyerOrgId}`) as unknown as Row[];
    if (!d) throw new Error("That departure is not on this site.");
  }
  const price = svc.price == null ? null : Math.round(Number(svc.price) * 100);
  const meta = (svc.metadata ?? {}) as Record<string, unknown>;
  const listedTerms = typeof meta.terms === "string" ? meta.terms : null;
  const terms = [listedTerms, input.terms?.trim()].filter(Boolean).join("\n\n").slice(0, 4000) || null;
  const [r] = (await db`
    INSERT INTO service_commissions (
      service_thread_id, seller_user_id, buyer_org_id, requested_by, experience_thread_id, tour_thread_id, departure_id,
      unit, quantity, price_cents, currency, terms_snapshot
    ) VALUES (
      ${input.serviceThreadId}, ${svc.author_id as string}, ${buyerOrgId}, ${requestedBy}, ${input.experienceThreadId ?? null},
      ${input.tourThreadId ?? null}, ${input.departureId ?? null}, ${input.unit}, ${Math.max(1, Math.floor(input.quantity ?? 1))},
      ${price != null && Number.isFinite(price) ? price : null}, ${(svc.currency as string | null) ?? null}, ${terms}
    ) RETURNING id
  `) as unknown as Row[];
  return (await getCommission(r!.id as string))!;
}

/** The seller (artist) answers a proposed commission. */
export async function respondCommission(id: string, sellerUserId: string, answer: "accepted" | "declined"): Promise<ServiceCommission> {
  if (answer !== "accepted" && answer !== "declined") throw new Error("Unknown answer.");
  const rows = (await db`
    UPDATE service_commissions SET status = ${answer}, responded_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND seller_user_id = ${sellerUserId} AND status = 'proposed'
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("This commission cannot be answered.");
  return (await getCommission(id))!;
}

/** Buyer side: cancel (before completion) or mark completed (after acceptance). */
export async function setCommissionStatus(id: string, status: Extract<CommissionStatus, "cancelled" | "completed">, _byUserId: string): Promise<ServiceCommission> {
  const from = status === "completed" ? ["accepted"] : ["proposed", "accepted"];
  const rows = (await db`
    UPDATE service_commissions SET status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND status = ANY(${from})
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error(`This commission cannot be ${status}.`);
  return (await getCommission(id))!;
}

export async function listCommissions(opts: { buyerOrgId?: string; sellerUserId?: string; experienceThreadId?: string } = {}): Promise<ServiceCommission[]> {
  try {
    const rows = (await db`
      ${SELECT}
      WHERE TRUE
        ${opts.buyerOrgId ? db`AND c.buyer_org_id = ${opts.buyerOrgId}` : db``}
        ${opts.sellerUserId ? db`AND c.seller_user_id = ${opts.sellerUserId}` : db``}
        ${opts.experienceThreadId ? db`AND c.experience_thread_id = ${opts.experienceThreadId}` : db``}
      ORDER BY c.created_at DESC
      LIMIT 200
    `) as unknown as Row[];
    return rows.map(mapCommission);
  } catch (err) {
    console.error("[elktours] listCommissions:", err);
    return [];
  }
}
