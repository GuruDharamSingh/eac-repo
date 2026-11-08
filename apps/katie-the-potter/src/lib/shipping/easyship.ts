// ============================================================================
// Easyship client for this site. Server only. The only katie file that talks
// to Easyship.
//
// API version 2024-09 ("v2024-09 (latest version)" on developers.easyship.com,
// read 2026-11-07). Endpoints used:
//   POST   /2024-09/rates                         quotes only
//   POST   /2024-09/shipments                     create (no label: buy_label false)
//   POST   /2024-09/shipments/{id}/label          buy the label (synchronous)
//   GET    /2024-09/shipments/{id}                label, trackings, states
//   POST   /2024-09/shipments/{id}/cancel         after a label was requested, pre-transit
//   DELETE /2024-09/shipments/{id}                before a label was requested
// Hosts: public-api-sandbox.easyship.com (token sand_…) and
// public-api.easyship.com (token prod_…). Auth: `Authorization: Bearer`.
// Webhooks: see ./webhook.ts.
//
// MODE, per call, never from a global: "test" uses EASYSHIP_SANDBOX_TOKEN on
// the sandbox host, "live" uses EASYSHIP_PRODUCTION_TOKEN on the production
// host. A "test" call can never reach production. In production, creating a
// shipment is free but buying its label spends the collective's money.
//
// Verified 2026-11-07 (sandbox; and one read-only production quote, see
// docs/SHIPPING_PLAN.md): requests need `Accept: application/json` and a
// non-default User-Agent (Cloudflare refuses library defaults); the sandbox
// rate-limits (429) and has no CA->US couriers at all, production quotes
// CA->US fine with HS 691200; rates carry insurance_fee and cost /
// delivery_time / value_for_money ranks (1 = best); a shipment needs
// origin_address.company_name.
// Shared art-auction client (different flow, migration 250):
// packages/commerce/src/shipping/easyship.ts.
// ============================================================================

const API_VERSION = "2024-09";
const USER_AGENT = "elkdonis-katie-the-potter/1.0";

export type EasyshipMode = "test" | "live";

function config(mode: EasyshipMode): { base: string; token: string } | null {
  const token = (mode === "live" ? process.env.EASYSHIP_PRODUCTION_TOKEN : process.env.EASYSHIP_SANDBOX_TOKEN)?.trim();
  if (!token) return null;
  // Belt and braces: a token of the wrong kind is refused, never sent.
  if (mode === "live" ? !token.startsWith("prod_") : !token.startsWith("sand_")) return null;
  const host = mode === "live" ? "public-api.easyship.com" : "public-api-sandbox.easyship.com";
  return { base: `https://${host}/${API_VERSION}`, token };
}

export function isEasyshipConfigured(mode: EasyshipMode): boolean {
  return config(mode) !== null;
}

export class EasyshipError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    public readonly details: string[],
    message: string
  ) {
    super(message);
    this.name = "EasyshipError";
  }
}

async function call<T>(mode: EasyshipMode, method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const cfg = config(mode);
  if (!cfg) throw new EasyshipError(0, "not_configured", [], "Shipping is not connected yet.");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${cfg.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
      const details = Array.isArray(err?.details) ? err!.details.map(String) : [];
      throw new EasyshipError(res.status, err?.code ?? null, details, details[0] ?? err?.message ?? `Easyship ${res.status}`);
    }
    return json as T;
  }
}

// ── shapes (only what this site sends or reads) ─────────────────────────────

export interface EsAddress {
  contact_name: string;
  company_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  line_1: string;
  line_2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country_alpha2: string;
}

export interface EsItem {
  quantity: number;
  description: string;
  hs_code: string;
  origin_country_alpha2: string;
  declared_currency: string;
  declared_customs_value: number;
  actual_weight: number;
  sku?: string;
}

export interface EsParcel {
  box: { length: number; width: number; height: number };
  total_actual_weight: number;
  items: EsItem[];
}

export interface EsRate {
  courier_service: { id: string; name: string; umbrella_name?: string | null; courier_id?: string | null };
  total_charge: number;
  insurance_fee?: number | null;
  currency: string;
  min_delivery_time: number | null;
  max_delivery_time: number | null;
  cost_rank?: number | null;
  delivery_time_rank?: number | null;
  value_for_money_rank?: number | null;
  estimated_import_duty?: number | null;
  estimated_import_tax?: number | null;
  incoterms?: string | null;
  tracking_rating?: number | null;
  available_handover_options?: string[] | null;
  description?: string | null;
}

export interface EsShipment {
  easyship_shipment_id: string;
  label_state?: string | null;
  shipment_state?: string | null;
  delivery_state?: string | null;
  tracking_page_url?: string | null;
  trackings?: Array<{ tracking_number?: string | null; leg_number?: number | null }> | null;
  shipping_documents?: Array<{ category?: string | null; format?: string | null; url?: string | null }> | null;
  courier_service?: { id?: string; name?: string; umbrella_name?: string } | null;
  rates?: EsRate[] | null;
  currency?: string | null;
}

export interface ShipmentSpec {
  origin: EsAddress;
  destination: EsAddress;
  parcels: EsParcel[];
  /** Insure for this much (major units) in `currency`; null = no insurance. */
  insuredAmount: number | null;
  currency: string;
}

function body(spec: ShipmentSpec) {
  return {
    origin_address: { ...spec.origin, company_name: spec.origin.company_name?.trim() || spec.origin.contact_name },
    destination_address: spec.destination,
    // The buyer pays any import duty and tax at the door (shown to them).
    incoterms: "DDU",
    insurance:
      spec.insuredAmount && spec.insuredAmount > 0
        ? { is_insured: true, insured_amount: spec.insuredAmount, insured_currency: spec.currency }
        : { is_insured: false },
    parcels: spec.parcels,
  };
}

/** Quotes only: nothing is created or bought. */
export async function requestRates(mode: EasyshipMode, spec: ShipmentSpec): Promise<EsRate[]> {
  const out = await call<{ rates?: EsRate[] }>(mode, "POST", "/rates", {
    ...body(spec),
    courier_settings: { show_courier_logo_url: false, apply_shipping_rules: true },
    shipping_settings: { units: { weight: "kg", dimensions: "cm" }, output_currency: spec.currency },
  });
  return out.rates ?? [];
}

/** Create the shipment for one courier service, WITHOUT a label. Free. */
export async function createShipment(
  mode: EasyshipMode,
  spec: ShipmentSpec & { courierServiceId: string; reference: string }
): Promise<EsShipment> {
  const out = await call<{ shipment: EsShipment }>(mode, "POST", "/shipments", {
    ...body(spec),
    metadata: { reference: spec.reference },
    courier_settings: { courier_service_id: spec.courierServiceId, allow_fallback: false },
    shipping_settings: { units: { weight: "kg", dimensions: "cm" }, output_currency: spec.currency, buy_label: false },
  });
  return out.shipment;
}

/** Buy the label of an existing shipment. Spends money in live mode. */
export async function buyLabel(mode: EasyshipMode, shipmentId: string, courierServiceId?: string | null): Promise<EsShipment> {
  const out = await call<{ shipment: EsShipment; shipping_documents?: EsShipment["shipping_documents"] }>(
    mode,
    "POST",
    `/shipments/${encodeURIComponent(shipmentId)}/label`,
    {
      ...(courierServiceId ? { courier_service_id: courierServiceId } : {}),
      printing_options: { format: "url", label: "4x6", commercial_invoice: "A4", packing_slip: "none" },
    }
  );
  const s = out.shipment;
  return { ...s, shipping_documents: s.shipping_documents ?? out.shipping_documents ?? null };
}

export async function getShipment(mode: EasyshipMode, shipmentId: string): Promise<EsShipment> {
  const out = await call<{ shipment: EsShipment }>(mode, "GET", `/shipments/${encodeURIComponent(shipmentId)}`);
  return out.shipment;
}

/**
 * Undo a shipment: DELETE before a label was requested, cancel after (only
 * pre-transit; Easyship refunds an unused label per its terms).
 */
export async function cancelShipment(mode: EasyshipMode, shipmentId: string, labelRequested: boolean): Promise<void> {
  if (labelRequested) await call(mode, "POST", `/shipments/${encodeURIComponent(shipmentId)}/cancel`, {});
  else await call(mode, "DELETE", `/shipments/${encodeURIComponent(shipmentId)}`);
}

/** The label PDF's URL, the tracking number and page, from a shipment. */
export function labelFacts(s: EsShipment): { labelUrl: string | null; trackingNumber: string | null; trackingUrl: string | null } {
  const label = (s.shipping_documents ?? []).find((d) => d.category === "label" && d.url) ?? (s.shipping_documents ?? []).find((d) => d.url);
  const t = (s.trackings ?? []).find((x) => x.tracking_number)?.tracking_number ?? null;
  return { labelUrl: label?.url ?? null, trackingNumber: t, trackingUrl: s.tracking_page_url ?? null };
}
