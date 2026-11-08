// ============================================================================
// Easyship client (API version 2024-09). The only file that talks to Easyship.
//
// Environment:
//   EASYSHIP_ENV               sandbox | production   (default sandbox)
//   EASYSHIP_SANDBOX_TOKEN     sand_…  → https://public-api-sandbox.easyship.com
//   EASYSHIP_PRODUCTION_TOKEN  prod_…  → https://public-api.easyship.com
//
// Verified 2026-11-07 (claude): requests need `Accept: application/json` (406
// otherwise) and a non-default User-Agent (Cloudflare 403 "1010" for library
// defaults); the sandbox allows a few requests per second and per minute
// (429). Rates come back in the account's currency (CAD). A production rate
// request is a quote only; `buy_label: true` on a shipment spends money.
// ============================================================================

const API_VERSION = "2024-09";
const USER_AGENT = "elkdonis-market/1.0";

export type EasyshipEnv = "sandbox" | "production";

export function easyshipEnv(): EasyshipEnv {
  return process.env.EASYSHIP_ENV === "production" ? "production" : "sandbox";
}

function config(): { base: string; token: string } | null {
  const env = easyshipEnv();
  const token =
    env === "production" ? process.env.EASYSHIP_PRODUCTION_TOKEN : process.env.EASYSHIP_SANDBOX_TOKEN;
  if (!token) return null;
  const host = env === "production" ? "public-api.easyship.com" : "public-api-sandbox.easyship.com";
  return { base: `https://${host}/${API_VERSION}`, token };
}

export function isEasyshipConfigured(): boolean {
  return config() !== null;
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

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new EasyshipError(0, "not_configured", [], "Shipping quotes are not set up.");
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
      throw new EasyshipError(
        res.status,
        err?.code ?? null,
        details,
        details[0] ?? err?.message ?? `Easyship ${res.status}`
      );
    }
    return json as T;
  }
}

// ---------------------------------------------------------------------------
// Shapes (only the fields this codebase reads or sends)
// ---------------------------------------------------------------------------

export interface EasyshipAddress {
  contact_name: string;
  company_name?: string | null;
  contact_phone: string;
  contact_email: string;
  line_1: string;
  line_2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country_alpha2: string;
}

export interface EasyshipParcelInput {
  box: { length: number; width: number; height: number };
  items: Array<{
    quantity: number;
    description: string;
    hs_code: string;
    declared_currency: string;
    declared_customs_value: number;
    actual_weight: number;
  }>;
}

export interface EasyshipRate {
  courier_service: { id: string; name: string; umbrella_name: string; courier_id: string };
  total_charge: number;
  currency: string;
  min_delivery_time: number | null;
  max_delivery_time: number | null;
  estimated_import_duty: number | null;
  estimated_import_tax: number | null;
  incoterms: string | null;
  description?: string | null;
  full_description?: string | null;
}

export interface EasyshipShipment {
  easyship_shipment_id: string;
  label_state?: string | null;
  shipment_state?: string | null;
  tracking_page_url?: string | null;
  trackings?: Array<{ tracking_number?: string | null; leg_number?: number }> | null;
  shipping_documents?: Array<{ category?: string; format?: string; url?: string | null; base64_encoded_strings?: string[] }> | null;
  courier_service?: { id?: string; name?: string; umbrella_name?: string } | null;
  rates?: EasyshipRate[] | null;
}

function shipmentBody(input: {
  origin: EasyshipAddress;
  destination: EasyshipAddress;
  parcels: EasyshipParcelInput[];
}) {
  return {
    origin_address: input.origin,
    destination_address: input.destination,
    incoterms: "DDU",
    insurance: { is_insured: false },
    shipping_settings: { units: { weight: "kg", dimensions: "cm" } },
    parcels: input.parcels,
  };
}

/** Quotes only. Nothing is bought. */
export async function requestRates(input: {
  origin: EasyshipAddress;
  destination: EasyshipAddress;
  parcels: EasyshipParcelInput[];
}): Promise<EasyshipRate[]> {
  const out = await call<{ rates?: EasyshipRate[] }>("POST", "/rates", {
    ...shipmentBody(input),
    courier_settings: { show_courier_logo_url: false, apply_shipping_rules: true },
  });
  return out.rates ?? [];
}

/**
 * Create a shipment on the collective's account for the chosen courier
 * service and buy its label. Spends money in production.
 */
export async function createShipmentWithLabel(input: {
  origin: EasyshipAddress;
  destination: EasyshipAddress;
  parcels: EasyshipParcelInput[];
  courierServiceId: string;
  reference: string;
}): Promise<EasyshipShipment> {
  // Easyship requires a company name on a shipment's origin (verified
  // 2026-11-07: 422 "origin_address.company_name can't be blank").
  const origin = { ...input.origin, company_name: input.origin.company_name?.trim() || input.origin.contact_name };
  const out = await call<{ shipment: EasyshipShipment }>("POST", "/shipments", {
    ...shipmentBody({ ...input, origin }),
    metadata: { reference: input.reference },
    courier_settings: { courier_service_id: input.courierServiceId, allow_fallback: false },
    shipping_settings: {
      units: { weight: "kg", dimensions: "cm" },
      buy_label: true,
      buy_label_synchronous: true,
      printing_options: { format: "url", label: "4x6", commercial_invoice: "A4", packing_slip: "none" },
    },
  });
  return out.shipment;
}

export async function getShipment(id: string): Promise<EasyshipShipment> {
  const out = await call<{ shipment: EasyshipShipment }>("GET", `/shipments/${encodeURIComponent(id)}`);
  return out.shipment;
}

/** Cancel a shipment whose label has not been used (refund per Easyship's terms). */
export async function cancelShipment(id: string): Promise<void> {
  await call("POST", `/shipments/${encodeURIComponent(id)}/cancel`, {});
}
