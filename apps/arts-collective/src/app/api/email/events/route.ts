import { NextResponse } from "next/server";
import { ingestEvents, type SendGridEvent } from "@elkdonis/email";

// ============================================================================
// SendGrid's Event Webhook — the other half of "did it arrive".
//
// Mail Send answers 202 Accepted, which means queued. Delivered, bounced,
// blocked, marked-as-spam and unsubscribed arrive here and nowhere else, which
// is why a hard-bounced address has been retried on every send this network
// has ever made.
//
// Set up: Settings → Mail Settings → Event Webhook, pointed here, with the
// signed webhook enabled; put the verification key in
// SENDGRID_EVENT_PUBLIC_KEY.
//
// It answers 2xx for anything it has decided about, because a non-2xx earns 24
// hours of retries — and every event is deduped on SendGrid's own
// `sg_event_id`, so those retries are free when they do happen.
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verify(req: Request, raw: Buffer): Promise<"ok" | "bad" | "unconfigured"> {
  const publicKey = process.env.SENDGRID_EVENT_PUBLIC_KEY;
  if (!publicKey) return "unconfigured";

  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp");
  if (!signature || !timestamp) return "bad";

  try {
    const { createVerify, createPublicKey } = await import("node:crypto");
    const verifier = createVerify("sha256");
    verifier.update(timestamp);
    verifier.update(raw);
    verifier.end();
    const key = createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    return verifier.verify(key, Buffer.from(signature, "base64")) ? "ok" : "bad";
  } catch (err) {
    console.error("[email/events] signature verification threw:", err);
    return "bad";
  }
}

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());

  const verdict = await verify(req, raw);
  if (verdict === "bad") {
    // Unverified, this endpoint lets anyone POST a fake bounce and get an
    // address suppressed network-wide — so a bad signature is refused outright.
    console.warn("[email/events] rejected a POST with a bad signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }
  if (verdict === "unconfigured") {
    console.warn(
      "[email/events] SENDGRID_EVENT_PUBLIC_KEY is not set — accepting " +
        "UNVERIFIED delivery events, which anyone could forge to suppress an " +
        "address. Enable the signed webhook in SendGrid and set the key."
    );
  }

  // SendGrid BATCHES: the body is an array of events, and a handler written
  // for a single object silently drops all but the first.
  let events: SendGridEvent[];
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await ingestEvents(events);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // Retryable: our database was down and these events are still held for 24h.
    console.error("[email/events] ingest failed:", err);
    return NextResponse.json({ error: "Could not store" }, { status: 500 });
  }
}
