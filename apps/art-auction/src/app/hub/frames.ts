"use server";

/**
 * The /hub popups' server side (MARKET_CENTER_AND_DOCK_2026-11-24, slice 5): reads for the orders and stores
 * popups. Writes go through /admin's own actions (admin/actions.ts), which re-check the role themselves:
 * orders are admin-only (requireAdmin), stores are for keepers (requireKeeper).
 */

import {
  adminListUsers,
  getOrderById,
  getOrderLines,
  listOrders,
  listPendingStoreApplications,
  listSeries,
  listStores,
} from "@elkdonis/commerce/queries";
import { canCreateSeries } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";
import { listOrgArrivals } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireAdmin, requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { loadAdminMoney } from "@/app/admin/money/data";

const ORDER_WORD: Record<string, string> = {
  draft: "Draft", pending_payment: "Card, not paid yet", awaiting_etransfer: "Awaiting eTransfer",
  payment_received: "Payment received", paid: "Paid, to ship", fulfilled: "Shipped", completed: "Completed",
  cancelled: "Cancelled", refunded: "Refunded",
};

export async function loadOrdersFrame() {
  await requireAdmin();
  const orders = await listOrders({ limit: 60 }).catch(() => []);
  return {
    ok: true as const,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      who: o.customerName?.trim() || o.customerEmail,
      when: o.createdAt,
      status: o.status,
      statusWord: ORDER_WORD[o.status] ?? o.status,
      total: formatMoney(o.totalMinor, o.currency),
      method: o.paymentMethod,
    })),
  };
}

export async function loadOrderFrame(orderId: string) {
  await requireAdmin();
  const order = await getOrderById(String(orderId));
  if (!order) return { ok: false as const, error: "Order not found." };
  const lines = await getOrderLines(order.id).catch(() => []);
  return {
    ok: true as const,
    id: order.id,
    number: order.number,
    status: order.status,
    statusWord: ORDER_WORD[order.status] ?? order.status,
    method: order.paymentMethod,
    who: order.customerName?.trim() || order.customerEmail,
    email: order.customerEmail,
    when: order.createdAt,
    subtotal: formatMoney(order.subtotalMinor, order.currency),
    shipping: formatMoney(order.shippingMinor, order.currency),
    total: formatMoney(order.totalMinor, order.currency),
    lines: lines.map((l) => ({ id: l.id, what: l.description, qty: l.quantity, price: formatMoney(l.unitPriceMinor, order.currency) })),
  };
}

export async function loadStoresFrame() {
  await requireKeeper();
  const stores = await listStores({ limit: 120, status: ["active", "pending", "paused", "rejected"] }).catch(() => []);
  return {
    ok: true as const,
    stores: stores.map((s) => ({
      id: s.id,
      name: s.displayName ?? "Store",
      kind: s.ownerKind,
      status: s.status,
      slug: s.slug ?? null,
      city: s.city ?? null,
      joined: s.joinedAt,
    })),
  };
}

// ── Applications (admins) ───────────────────────────────────────────────────

export async function loadApplicationsFrame() {
  await requireAdmin();
  const apps = await listPendingStoreApplications().catch(() => []);
  return {
    ok: true as const,
    applications: apps.map((a) => ({
      id: a.id,
      name: a.displayName ?? "Unnamed artist",
      headline: a.headline ?? null,
      city: a.city ?? null,
      email: a.payoutEmail ?? null,
      photoUrl: a.photoUrl ?? null,
      bioHtml: a.bioHtml ? sanitizeRichText(a.bioHtml) : null,
    })),
  };
}

// ── Series (admins) ─────────────────────────────────────────────────────────

export async function loadSeriesFrame() {
  const userId = await requireAdmin();
  const [series, mayCreate] = await Promise.all([
    listSeries({ orgId: siteConfig.marketplaceOrgId }).catch(() => []),
    canCreateSeries(userId).catch(() => false),
  ]);
  return {
    ok: true as const,
    mayCreate,
    series: series.map((s) => ({
      id: s.id, slug: s.slug, title: s.title, phase: s.phase, draft: s.status === "draft",
      silentOpensAt: s.silentOpensAt, liveAt: s.liveAt, lots: s.lotCount,
    })),
  };
}

// ── Money (admins) ──────────────────────────────────────────────────────────

export async function loadMoneyHubFrame() {
  await requireAdmin();
  const m = await loadAdminMoney();
  return {
    ok: true as const,
    owed: m.owed,
    held: m.held.map((e) => ({
      id: e.id,
      party: e.partyName ?? e.party.orgId ?? e.party.userId ?? e.party.payeeId ?? "platform",
      partyKind: e.party.kind,
      reason: e.holdReason?.replace(/_/g, " ") ?? null,
      waitsOnBeneficiary: e.holdReason === "pending_beneficiary",
      since: e.createdAt,
      amount: formatMoney(e.amountMinor, e.currency as "CAD"),
    })),
    suggested: m.suggested.map((p) => ({ id: p.id, name: p.name, website: p.website, managedBy: p.managed_by_org_id })),
    settings: {
      defaultCommissionRate: m.settings.defaultCommissionRate,
      softCloseMinutes: m.settings.softCloseMinutes,
      paymentWindowHours: m.settings.paymentWindowHours,
    },
  };
}

// ── Members (admins) ────────────────────────────────────────────────────────

export async function loadMembersFrame() {
  await requireAdmin();
  const [users, arrivals] = await Promise.all([
    adminListUsers({ limit: 60 }).catch(() => []),
    listOrgArrivals(siteConfig.marketplaceOrgId).catch(() => []),
  ]);
  return {
    ok: true as const,
    users: users.map((u) => ({
      id: u.id, name: u.displayName ?? null, email: u.email ?? null, joined: u.createdAt,
      store: u.artistStatus ?? null, collective: Boolean(u.inCollective),
    })),
    arrivals,
  };
}
