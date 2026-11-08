import { createHmac, timingSafeEqual } from "node:crypto";
import { applyTracking } from "./shipments";

// ============================================================================
// Easyship webhooks (API 2024-09, "Webhooks guide" read 2026-11-07).
//
// Signature: header `X-EASYSHIP-SIGNATURE` is a JWT signed HS256 with the
// webhook's secret key (`webh_…`, shown on the Easyship dashboard's webhook
// page); its claims carry `easyship_company_id`. NOTE: the token does not
// cover the body, so a valid token proves the sender knows the secret, not
// that this body is the one it signed. We accept only events about
// shipments we created, only move a shipment's status forward, and never
// buy, refund or cancel from a webhook.
//
// Secrets: EASYSHIP_WEBHOOK_SECRET (the production account's webhook) and
// EASYSHIP_SANDBOX_WEBHOOK_SECRET (the sandbox's). Either may be unset; with
// none set the route answers 503. EASYSHIP_COMPANY_ID, when set, must match
// the token's easyship_company_id.
//
// Events used: shipment.tracking.status.changed, shipment.label.created,
// shipment.label.failed (logged), shipment.cancelled. Easyship retries a
// non-2xx up to 30 times and then deactivates the webhook, so anything we
// can parse but do not need is answered 200.
// ============================================================================

const b64url = (buf: Buffer) => buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export type JwtCheck = { ok: true; claims: Record<string, unknown> } | { ok: false; reason: string };

/** Verify an HS256 JWT against any of the secrets. */
export function verifyEasyshipSignature(token: string | null, secrets: string[], companyId?: string | null): JwtCheck {
  if (!token) return { ok: false, reason: "missing signature" };
  const usable = secrets.map((s) => s.trim()).filter(Boolean);
  if (usable.length === 0) return { ok: false, reason: "not configured" };
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { ok: false, reason: "not a JWT" };
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(fromB64url(h).toString("utf8"));
    claims = JSON.parse(fromB64url(p).toString("utf8"));
  } catch {
    return { ok: false, reason: "unreadable JWT" };
  }
  if (header.alg !== "HS256") return { ok: false, reason: "wrong algorithm" };
  const given = Buffer.from(sig);
  const match = usable.some((secret) => {
    const want = Buffer.from(b64url(createHmac("sha256", secret).update(`${h}.${p}`).digest()));
    return want.length === given.length && timingSafeEqual(want, given);
  });
  if (!match) return { ok: false, reason: "bad signature" };
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp < now - 60) return { ok: false, reason: "expired" };
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return { ok: false, reason: "not yet valid" };
  if (companyId && claims.easyship_company_id !== companyId) return { ok: false, reason: "other company" };
  return { ok: true, claims };
}

/** Sign claims as Easyship does (tests and the rehearsal script only). */
export function signEasyshipJwt(claims: Record<string, unknown>, secret: string): string {
  const h = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b64url(Buffer.from(JSON.stringify(claims)));
  return `${h}.${p}.${b64url(createHmac("sha256", secret).update(`${h}.${p}`).digest())}`;
}

export function webhookSecrets(): string[] {
  return [process.env.EASYSHIP_WEBHOOK_SECRET ?? "", process.env.EASYSHIP_SANDBOX_WEBHOOK_SECRET ?? ""].filter((s) => s.trim());
}

interface EsWebhookBody {
  event_type?: string;
  resource_type?: string;
  resource_id?: string;
  data?: {
    easyship_shipment_id?: string;
    status?: string;
    tracking_number?: string;
    tracking_page_url?: string;
    label_url?: string;
  };
}

/** The whole webhook, framework-free: raw body + header in, status + text out. */
export async function handleEasyshipWebhook(
  raw: string,
  signature: string | null,
  secrets: string[] = webhookSecrets()
): Promise<{ status: number; body: string }> {
  if (secrets.length === 0) return { status: 503, body: "Easyship webhook not configured" };
  const check = verifyEasyshipSignature(signature, secrets, process.env.EASYSHIP_COMPANY_ID || null);
  if (check.ok === false) return { status: 401, body: `Refused: ${check.reason}` };
  let ev: EsWebhookBody;
  try {
    ev = JSON.parse(raw) as EsWebhookBody;
  } catch {
    return { status: 400, body: "Bad JSON" };
  }
  const type = ev.event_type ?? "";
  const id = ev.data?.easyship_shipment_id ?? ev.resource_id ?? "";
  if (!id || (ev.resource_type && ev.resource_type !== "shipment")) return { status: 200, body: "ignored" };
  if (!["shipment.tracking.status.changed", "shipment.label.created", "shipment.label.failed", "shipment.cancelled"].includes(type)) {
    return { status: 200, body: "ignored" };
  }
  const row = await applyTracking({
    easyshipShipmentId: id,
    status: type === "shipment.tracking.status.changed" ? ev.data?.status ?? null : null,
    trackingNumber: ev.data?.tracking_number ?? null,
    trackingUrl: ev.data?.tracking_page_url ?? null,
    labelUrl: type === "shipment.label.created" ? ev.data?.label_url ?? null : null,
    eventType: type,
  });
  return { status: 200, body: row ? `ok ${row.status}` : "unknown shipment" };
}
