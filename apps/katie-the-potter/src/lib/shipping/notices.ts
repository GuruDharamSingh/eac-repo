import { db } from "@elkdonis/db";
import { getOrderById } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Currency } from "@elkdonis/commerce/types";
import { sendCommerceNotice } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";
import { getSiteArtistUserId } from "@/lib/auth";
import type { ShipmentRow } from "./shipments";

// ============================================================================
// Shipping emails. Quote-only: Katie gets "Ship this order" when the buyer
// has paid (what to buy, where to, the parcel), the buyer gets the tracking
// once Katie types it in. Parked label flow: the buyer gets the tracking
// link, Katie gets "label ready" (or "please arrange it"). Test mode sends
// nothing: the row's event log says what WOULD have gone, to whom.
// ============================================================================

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f1ea;font-family:Georgia,serif;color:#2b2420">
<div style="max-width:560px;margin:0 auto;padding:28px 22px">
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f5a;margin:0 0 6px">${esc(siteConfig.orgName)}</p>
<h1 style="font-weight:400;font-size:24px;margin:0 0 16px">${esc(title)}</h1>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55">${body}</div>
</div></body></html>`;
}

const btn = (href: string, label: string) =>
  `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:#7a4a2e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${esc(label)}</a></p>`;

async function katieEmail(): Promise<string | null> {
  const id = await getSiteArtistUserId();
  if (!id) return null;
  const [u] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${id} LIMIT 1`;
  return u?.email?.trim() || null;
}

async function logWouldSend(row: ShipmentRow, to: string | null, subject: string): Promise<void> {
  await db`
    UPDATE order_shipment SET events = events || ${db.json([{ at: new Date().toISOString(), kind: "email_skipped_test", to, subject }] as never)}
    WHERE id = ${row.id}
  `;
}

async function send(row: ShipmentRow, to: string | null, subject: string, html: string, replyTo?: string | null): Promise<void> {
  if (row.mode === "test" || !to) {
    await logWouldSend(row, to, subject);
    return;
  }
  await sendCommerceNotice({ to, subject, html, orgId: siteConfig.orgId, ...(replyTo ? { replyTo } : {}) });
}

// ── quote-only ──────────────────────────────────────────────────────────────

export interface ComposedEmail {
  to: string | null;
  subject: string;
  html: string;
  replyTo: string | null;
}

const fmtM = (minor: number, currency: string) => formatMoney(minor, currency as Currency);
const daysWords = (c: { minDays: number | null; maxDays: number | null }) =>
  c.minDays == null && c.maxDays == null
    ? null
    : c.minDays != null && c.maxDays != null && c.minDays !== c.maxDays
      ? `${c.minDays}–${c.maxDays} business days`
      : `${c.maxDays ?? c.minDays} business ${(c.maxDays ?? c.minDays) === 1 ? "day" : "days"}`;

/** "Ship this order" for Katie: everything she needs to buy the label herself. Pure apart from reading the order. */
export async function composeShipThis(row: ShipmentRow): Promise<ComposedEmail | null> {
  const order = await getOrderById(row.orderId);
  const c = row.chosenRate;
  if (!order || !c) return null;
  const base = siteConfig.url.replace(/\/$/, "");
  const paid = fmtM(row.paidMinor ?? row.amountMinor ?? c.amountMinor, row.currency ?? c.currency);
  const a = row.shipTo;
  const addr = [a?.recipientName || order.customerName, a?.line1, a?.line2, [a?.city, a?.region, a?.postalCode].filter(Boolean).join(" "), a?.country === "US" ? "United States" : a?.country === "CA" ? "Canada" : a?.country]
    .filter(Boolean)
    .map((x) => esc(String(x)))
    .join("<br>");
  const us = (a?.country ?? "").toUpperCase() === "US";
  const parcels = row.parcels
    .map(
      (p) =>
        `<li>${esc(p.title)}: box <b>${p.lengthCm} × ${p.widthCm} × ${p.heightCm} cm</b>, <b>${p.weightKg} kg</b> packed${us ? ` · customs: HS <b>${esc(p.hsCode)}</b>, declared value <b>${esc(fmtM(Math.round(p.declared * 100), p.currency))}</b>, made in Canada, “Handmade ceramic: ${esc(p.title)}”` : ""}</li>`
    )
    .join("");
  const d = daysWords(c);
  const body = `<p>The buyer of order <b>${esc(order.number)}</b> chose <b>${esc(c.service)}</b>${d ? ` (about ${esc(d)})` : ""} and paid <b>${esc(paid)}</b> for shipping${row.insured ? ", insured" : ""}. That money is yours.</p>
<p style="margin:14px 0 4px"><b>Ship to</b></p>
<p style="margin:0">${addr}${a?.phone ? `<br>${esc(a.phone)}` : ""}${order.customerEmail ? `<br>${esc(order.customerEmail)}` : ""}</p>
<p style="margin:14px 0 4px"><b>Parcel</b></p>
<ul style="margin:0;padding-left:20px">${parcels}</ul>
${row.insured ? `<p>Insure it for the piece's price when you buy the label.</p>` : ""}
<p><b>Buy the label yourself</b> with ${esc(c.courier)}: in your own Easyship account (<a href="https://app.easyship.com">app.easyship.com</a>, choose the same courier and service), on the carrier's website, or at the counter.</p>
<p style="color:#6b5b4e;font-size:13px">The label may cost a little more or less than the buyer's quote. Small differences are yours; the buyer is not charged again.</p>
<p>Then open the order, type the carrier and the tracking number and press <b>Mark shipped</b>. The buyer gets the tracking by email.</p>
${btn(`${base}/manage/orders?status=paid`, "Open Orders")}`;
  return {
    to: await katieEmail(),
    subject: `Ship this order: ${c.service}, paid ${paid} (${order.number})`,
    html: shell("Ship this order", body),
    replyTo: order.customerEmail ?? null,
  };
}

export async function notifyShipThis(row: ShipmentRow): Promise<void> {
  const m = await composeShipThis(row);
  if (m) await send(row, m.to, m.subject, m.html, m.replyTo);
}

/** The buyer's tracking email, once Katie has typed it in. */
export async function composeTracking(row: ShipmentRow): Promise<ComposedEmail | null> {
  const order = await getOrderById(row.orderId);
  if (!order || !order.customerEmail?.trim()) return null;
  const base = siteConfig.url.replace(/\/$/, "");
  const carrier = row.courierName ?? row.chosenRate?.courier ?? "the carrier";
  const body = `<p>Katie has sent your order <b>${esc(order.number)}</b> with <b>${esc(carrier)}</b>${row.trackingNumber ? `, tracking number <b>${esc(row.trackingNumber)}</b>` : ""}.</p>
${row.trackingUrl ? btn(row.trackingUrl, "Track your parcel") : `<p>Look the number up on ${esc(carrier)}'s website.</p>`}
<p style="color:#6b5b4e;font-size:13px">Order ${esc(order.number)} · <a href="${esc(`${base}/orders/${order.id}`)}">your order page</a></p>`;
  return { to: order.customerEmail.trim(), subject: `Your order ${order.number} is on its way`, html: shell("Your parcel is on its way", body), replyTo: null };
}

export async function notifyTracking(row: ShipmentRow): Promise<void> {
  const m = await composeTracking(row);
  if (m) await send(row, m.to, m.subject, m.html, m.replyTo);
}

// ── parked label flow ───────────────────────────────────────────────────────

export async function notifyLabelReady(row: ShipmentRow): Promise<void> {
  const order = await getOrderById(row.orderId);
  if (!order) return;
  const base = siteConfig.url.replace(/\/$/, "");
  const carrier = row.courierName ?? row.chosenRate?.service ?? "the carrier";
  const track = row.trackingUrl ?? null;

  // The buyer: the tracking link.
  if (order.customerEmail?.trim()) {
    const body = `<p>Your shipping label is bought: <b>${esc(carrier)}</b>${row.trackingNumber ? `, tracking <b>${esc(row.trackingNumber)}</b>` : ""}.</p>
<p>Katie packs your piece and drops it off with the carrier. The tracking page shows each step once the carrier scans it.</p>
${track ? btn(track, "Track your parcel") : ""}
<p style="color:#6b5b4e;font-size:13px">Order ${esc(order.number)} · <a href="${esc(`${base}/orders/${order.id}`)}">your order page</a></p>`;
    await send(row, order.customerEmail.trim(), `Your order ${order.number} has a shipping label`, shell("Your parcel is on its way soon", body), null);
  }

  // Katie: the label to print.
  const to = await katieEmail();
  const paid = row.paidMinor && row.currency ? formatMoney(row.paidMinor, row.currency as Currency) : null;
  const body = `<p>The buyer of order <b>${esc(order.number)}</b> chose <b>${esc(carrier)}</b>${paid ? ` and paid ${esc(paid)} for the label` : ""}.</p>
<p>Print the label (4×6 or a sheet of paper folded in half), tape it on the box, and drop it off. Then press <b>Mark shipped</b> on the order: the tracking number is filled in for you.</p>
${btn(`${base}/manage/orders`, "Open Orders and download the label")}
${row.trackingNumber ? `<p style="color:#6b5b4e;font-size:13px">Tracking ${esc(row.trackingNumber)}</p>` : ""}`;
  await send(row, to, `Label ready: order ${order.number}`, shell("A shipping label is ready", body), order.customerEmail);
}

export async function notifyLabelFailed(row: ShipmentRow, refunded: boolean): Promise<void> {
  const order = await getOrderById(row.orderId);
  if (!order) return;
  const base = siteConfig.url.replace(/\/$/, "");
  const amount = row.paidMinor && row.currency ? formatMoney(row.paidMinor, row.currency as Currency) : null;
  if (order.customerEmail?.trim()) {
    const body = `<p>We couldn't buy the shipping label you chose for order <b>${esc(order.number)}</b>.${refunded && amount ? ` Your shipping payment of ${esc(amount)} has been refunded in full.` : ""}</p>
<p>Katie will write to you to arrange shipping another way.</p>`;
    await send(row, order.customerEmail.trim(), `Shipping for order ${order.number}`, shell("Katie will arrange shipping", body), null);
  }
  const to = await katieEmail();
  const body = `<p>The shipping label for order <b>${esc(order.number)}</b> could not be bought (${esc(row.error ?? "the carrier refused it")}).${refunded && amount ? ` The buyer's ${esc(amount)} label payment was refunded in full.` : ""}</p>
<p>Please write to the buyer${order.customerEmail ? ` (${esc(order.customerEmail)})` : ""} and arrange shipping as before.</p>
${btn(`${base}/manage/orders`, "Open Orders")}`;
  await send(row, to, `Please arrange shipping: order ${order.number}`, shell("Shipping needs you", body), order.customerEmail);
}
