import { createHash } from "node:crypto";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

// ============================================================================
// Shipping settings for this site, in site_config (org katie-the-potter):
//
//   shipping:mode      { mode }                                    default off
//   shipping:origin    ShipFrom (+ checkedAt/checkedHash once a quote from
//                      exactly this address has worked)          default none
//   shipping:packing   Packing                                    default below
//   shipping:insurance Insurance                                  default below
//
// QUOTE-ONLY (2026-11-07, the model in use): the platform buys no labels.
// Easyship gives quotes; the buyer picks one and pays it in a second Stripe
// Checkout; Katie buys the label herself and types in the tracking.
//
// off         everything as before: "Katie will be in touch about shipping".
// quote_test  "Test": sandbox quotes; only editors see "Choose shipping"; no Stripe.
// quote       "On": production quotes (read-only, no money with Easyship);
//             buyers see "Choose shipping" on paid orders and pay Katie.
//
// Parked, developer-only (env SHIPPING_LABEL_BUYING=on; NOT enabled):
// test / live  the first design, where the collective bought labels on its
//             own Easyship account. Kept, not deleted. Without the flag a
//             stored test/live reads as off.
// Server only.
// ============================================================================

export type ShippingMode = "off" | "quote_test" | "quote" | "test" | "live";

/** The developer-only flag for the parked label-buying modes. */
export function labelBuyingEnabled(): boolean {
  return process.env.SHIPPING_LABEL_BUYING === "on";
}

/** Quote-only (the buyer pays Katie; she buys the label) vs the parked label flow. */
export function flowOf(mode: ShippingMode): "quote" | "label" | null {
  if (mode === "quote" || mode === "quote_test") return "quote";
  if (mode === "test" || mode === "live") return "label";
  return null;
}

/** Which Easyship account a mode talks to: sandbox for the test modes, production otherwise. */
export function accountOf(mode: ShippingMode): "test" | "live" {
  return mode === "quote" || mode === "live" ? "live" : "test";
}

/**
 * Insurance is Katie's purchase (she buys the label), so it is her setting:
 * `insure` on (default) folds Easyship's insurance fee into the quoted price;
 * `buyerChooses` (default off) shows the buyer a checkbox instead.
 */
export interface Insurance {
  insure: boolean;
  buyerChooses: boolean;
}
export const DEFAULT_INSURANCE: Insurance = { insure: true, buyerChooses: false };

export interface ShipFrom {
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  /** When a quote from exactly this address last worked (Try it / a buyer's rates). */
  checkedAt?: string | null;
  /** Which address that was (hash of the fields above). */
  checkedHash?: string | null;
}

export interface Packing {
  /** Padding on each side, cm (box = piece + 2 × this, each way). */
  paddingCm: number;
  /** Box, padding and tape, kg. */
  boxKg: number;
  /** Extra weight as a % of the piece (double-boxing grows with the piece). */
  extraPct: number;
}

export const DEFAULT_PACKING: Packing = { paddingCm: 4, boxKg: 0.6, extraPct: 15 };

const K_MODE = "shipping:mode";
const K_ORIGIN = "shipping:origin";
const K_PACKING = "shipping:packing";
const K_INSURANCE = "shipping:insurance";

async function read<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db<Array<{ value: T }>>`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${key} LIMIT 1
    `;
    return row?.value ?? null;
  } catch (err) {
    console.error(`[katie-the-potter] shipping settings ${key}:`, err);
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  await db`
    INSERT INTO site_config (org_id, key, value) VALUES (${siteConfig.orgId}, ${key}, ${db.json(value as never)})
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

async function remove(key: string): Promise<void> {
  await db`DELETE FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${key}`;
}

export async function getShippingMode(): Promise<ShippingMode> {
  const v = await read<{ mode?: unknown }>(K_MODE);
  if (v?.mode === "quote" || v?.mode === "quote_test") return v.mode;
  // The parked label modes only count with the developer flag on.
  if ((v?.mode === "test" || v?.mode === "live") && labelBuyingEnabled()) return v.mode;
  return "off";
}

export async function getInsurance(): Promise<Insurance> {
  const v = await read<Partial<Insurance>>(K_INSURANCE);
  return {
    insure: typeof v?.insure === "boolean" ? v.insure : DEFAULT_INSURANCE.insure,
    buyerChooses: typeof v?.buyerChooses === "boolean" ? v.buyerChooses : DEFAULT_INSURANCE.buyerChooses,
  };
}

export async function saveInsurance(v: Insurance | null): Promise<void> {
  if (!v) return remove(K_INSURANCE);
  await write(K_INSURANCE, { insure: Boolean(v.insure), buyerChooses: Boolean(v.insure && v.buyerChooses) });
}

/** What the buyer sees about insurance: always folded in, a checkbox, or nothing. */
export function insuranceView(i: Insurance): "included" | "choice" | "none" {
  if (!i.insure) return "none";
  return i.buyerChooses ? "choice" : "included";
}

export async function setShippingMode(mode: ShippingMode): Promise<void> {
  await write(K_MODE, { mode, at: new Date().toISOString() });
}

export async function getShipFrom(): Promise<ShipFrom | null> {
  const v = await read<ShipFrom>(K_ORIGIN);
  return v && typeof v.line1 === "string" && v.line1 ? v : null;
}

export async function saveShipFrom(v: ShipFrom | null): Promise<void> {
  if (!v) return remove(K_ORIGIN);
  await write(K_ORIGIN, v);
}

/** Stamp the address as checked (a quote from it worked), if it is still the saved one. */
export async function markShipFromChecked(hash: string): Promise<void> {
  const cur = await getShipFrom();
  if (!cur || shipFromHash(cur) !== hash) return;
  if (cur.checkedHash === hash) return;
  await write(K_ORIGIN, { ...cur, checkedAt: new Date().toISOString(), checkedHash: hash });
}

export async function getPacking(): Promise<Packing> {
  const v = await read<Partial<Packing>>(K_PACKING);
  return cleanPacking(v ?? {});
}

export async function savePacking(p: Packing): Promise<void> {
  await write(K_PACKING, cleanPacking(p));
}

export function cleanPacking(v: Partial<Packing>): Packing {
  const n = (x: unknown, min: number, max: number, d: number) =>
    typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : d;
  return {
    paddingCm: n(v.paddingCm, 0, 20, DEFAULT_PACKING.paddingCm),
    boxKg: n(v.boxKg, 0, 10, DEFAULT_PACKING.boxKg),
    extraPct: n(v.extraPct, 0, 100, DEFAULT_PACKING.extraPct),
  };
}

/** Which address this is (for "a quote from THIS address worked"). */
export function shipFromHash(v: ShipFrom): string {
  const key = [v.name, v.company, v.line1, v.line2, v.city, v.region, v.postalCode, v.country, v.phone, v.email]
    .map((s) => (s ?? "").trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/** What still stands between this ship-from and Live (empty = ready). */
export function liveBlockers(v: ShipFrom | null): string[] {
  if (!v) return ["Save your ship-from address."];
  const out: string[] = [];
  if (!v.checkedAt || v.checkedHash !== shipFromHash(v)) {
    out.push("Press Try it once: a quote from this exact address has to work first.");
  }
  return out;
}

/** Validate a ship-from as typed. Returns the cleaned value or a message. */
export function cleanShipFrom(raw: Record<string, unknown>): ShipFrom | string {
  const t = (k: string, max: number) => (typeof raw[k] === "string" ? (raw[k] as string).trim().slice(0, max) : "");
  const v: ShipFrom = {
    name: t("name", 120),
    company: t("company", 120) || null,
    line1: t("line1", 200),
    line2: t("line2", 200) || null,
    city: t("city", 100),
    region: t("region", 60).toUpperCase(),
    postalCode: t("postalCode", 20).toUpperCase(),
    country: t("country", 2).toUpperCase() || "CA",
    phone: t("phone", 40),
    email: t("email", 200),
  };
  if (!v.name) return "Add the name the label should show (yours or the studio's).";
  // Carriers print a short contact name (Easyship refused 23+ characters, 2026-11-07).
  if (v.name.length > 22) return "The name on the label can be at most 22 characters. Put the studio's full name in Studio name.";
  if (!v.line1 || !v.city || !v.postalCode) return "Add the street, city and postal code.";
  if (!v.region) return "Add the province (for example ON).";
  if (v.country !== "CA") return "For now the studio ships from Canada.";
  if (!/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(v.postalCode)) return "That postal code doesn't look Canadian (for example M5V 2T6).";
  if (v.postalCode.length === 6) v.postalCode = `${v.postalCode.slice(0, 3)} ${v.postalCode.slice(3)}`;
  if ((v.phone.match(/\d/g) ?? []).length < 10) return "Add a phone number with the area code. Carriers call it if they can't find the studio.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return "Add an email for the carrier's notices.";
  return v;
}
