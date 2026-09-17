import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  parseInboundRecipient,
  classifyInbound,
  addressOf,
  displayNameOf,
  recordInbound,
} from "@elkdonis/email";

// ============================================================================
// SendGrid Inbound Parse — where the network's mail comes back.
//
// ONE endpoint for every organisation, because Parse cannot route two
// addresses on one MX host to two different webhooks. Tenancy is carried in
// the address instead:
//
//     ifac@inbound.elkdonis-arts.org         → org `ifac`
//     ifac.k3n9x2@inbound.elkdonis-arts.org  → org `ifac`, reply on a thread
//
// Set up: point `inbound.elkdonis-arts.org` MX at `mx.sendgrid.net`, then add
// the host and this URL under Settings → Inbound Parse.
//
// ── Everything in this request is hostile until proven otherwise ───────────
//
// It is an unauthenticated public endpoint that anyone on the internet can
// POST to, carrying content anyone on the internet can write. So:
//
//   * the ECDSA signature is verified before a row is written, when a key is
//     configured — otherwise a stranger can forge an org's inbox;
//   * `from` is stored, never trusted: SMTP lets anyone write any From, and
//     nothing downstream treats it as identity;
//   * bodies are stored RAW and sanitised at render, because sanitising on the
//     way in destroys the evidence of what was actually sent;
//   * a thread token files a message against a thread and authorises nothing.
//
// It always answers 2xx once it has decided to accept, because a non-2xx earns
// 24 hours of retries for a message we have already refused on its merits.
// ============================================================================

export const runtime = "nodejs";
// Parse posts multipart form data of up to 30MB; nothing here may be cached.
export const dynamic = "force-dynamic";

/** SendGrid's own ceiling. A larger body is not ours to have received. */
const MAX_BYTES = 30 * 1024 * 1024;

/**
 * Verify the signed-webhook headers.
 *
 * Returns `"unconfigured"` when no key is set, which is a deliberate third
 * state rather than a pass: the route logs it loudly and still accepts, so
 * that inbound can be tested before the key exists — but the log says, every
 * time, that the endpoint is currently forgeable.
 */
async function verifySignature(
  req: Request,
  rawBody: Buffer
): Promise<"ok" | "bad" | "unconfigured"> {
  const publicKey = process.env.SENDGRID_INBOUND_PUBLIC_KEY;
  if (!publicKey) return "unconfigured";

  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp");
  if (!signature || !timestamp) return "bad";

  try {
    const { createVerify, createPublicKey } = await import("node:crypto");
    const verifier = createVerify("sha256");
    verifier.update(timestamp);
    verifier.update(rawBody);
    verifier.end();
    const key = createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    return verifier.verify(key, Buffer.from(signature, "base64")) ? "ok" : "bad";
  } catch (err) {
    console.error("[email/inbound] signature verification threw:", err);
    return "bad";
  }
}

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());

  if (raw.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }

  const verdict = await verifySignature(req, raw);
  if (verdict === "bad") {
    // 403 and not 200: a forged POST SHOULD be retried into the same 403, and
    // an attacker learning nothing beats SendGrid learning nothing.
    console.warn("[email/inbound] rejected a POST with a bad signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }
  if (verdict === "unconfigured") {
    console.warn(
      "[email/inbound] SENDGRID_INBOUND_PUBLIC_KEY is not set — this endpoint " +
        "is accepting UNVERIFIED mail and anyone can forge an org's inbox. " +
        "Enable the signed webhook in SendGrid and set the key."
    );
  }

  // Re-parse the body we buffered for the signature. `Request` can only be
  // read once, so it is rebuilt rather than read twice.
  let form: FormData;
  try {
    form = await new Response(raw, {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch (err) {
    console.error("[email/inbound] could not parse the form body:", err);
    return NextResponse.json({ error: "Unparseable" }, { status: 400 });
  }

  const field = (name: string): string | null => {
    const v = form.get(name);
    return typeof v === "string" ? v : null;
  };

  // The envelope is authoritative for WHO it was addressed to: the `to` header
  // can say anything, while the envelope is what the receiving MTA was told.
  let envelope: { to?: string[]; from?: string } = {};
  try {
    envelope = JSON.parse(field("envelope") ?? "{}");
  } catch {
    /* A malformed envelope falls back to the header below. */
  }

  const toAddress = envelope.to?.[0] ?? field("to") ?? "";
  if (!toAddress) {
    // Accepted, not retried: a message with no recipient is not going to
    // acquire one on the fourth delivery.
    console.warn("[email/inbound] a message arrived with no recipient; dropped");
    return NextResponse.json({ ok: true, dropped: "no-recipient" });
  }

  const orgIds = (await db<Array<{ id: string }>>`SELECT id FROM organizations`).map(
    (r) => r.id
  );
  const { orgId, threadId: token } = parseInboundRecipient(
    addressOf(toAddress) || toAddress,
    orgIds
  );

  if (!orgId) {
    console.warn(`[email/inbound] no org matches "${toAddress}"; dropped`);
    return NextResponse.json({ ok: true, dropped: "no-org" });
  }

  // ── Resolve the thread the reply token names ─────────────────────────────
  //
  // Exact first, because a thread id is a case-sensitive nanoid. The
  // case-insensitive retry exists because some mail clients lowercase an
  // address before replying to it — and it accepts the result ONLY when it is
  // unambiguous, since two threads differing by case alone would otherwise
  // file one org's reply onto the other's thread.
  let threadId: string | null = null;
  if (token) {
    const exact = await db<Array<{ id: string }>>`
      SELECT id FROM threads WHERE id = ${token} AND org_id = ${orgId} LIMIT 1
    `;
    if (exact[0]) {
      threadId = exact[0].id;
    } else {
      const loose = await db<Array<{ id: string }>>`
        SELECT id FROM threads WHERE lower(id) = ${token.toLowerCase()} AND org_id = ${orgId} LIMIT 2
      `;
      if (loose.length === 1) threadId = loose[0].id;
      else if (loose.length > 1) {
        console.warn(
          `[email/inbound] token "${token}" matches ${loose.length} threads case-insensitively; filed with no thread`
        );
      }
    }
  }

  const fromRaw = field("from") ?? envelope.from ?? "";
  const fromEmail = addressOf(fromRaw);
  const subject = field("subject");

  // Parse supplies these as extra fields when the host is configured for them.
  let headers: Record<string, string> = {};
  const headerBlob = field("headers");
  if (headerBlob) {
    for (const line of headerBlob.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }

  const spamRaw = field("spam_score");
  const spamScore = spamRaw ? Number.parseFloat(spamRaw) : null;

  const classification = classifyInbound({
    subject,
    headers,
    fromEmail,
    spamScore: Number.isFinite(spamScore) ? spamScore : null,
    hasThread: Boolean(threadId),
  });

  // Attachment BYTES are deliberately not stored yet: putting a stranger's
  // 30MB of files into the org's Nextcloud folder is its own decision, with
  // its own quota and its own scanning question. The metadata is kept so the
  // reader knows something was attached and can ask for it.
  let attachments: Array<{ name: string; type?: string; size?: number }> = [];
  const count = Number.parseInt(field("attachments") ?? "0", 10);
  for (let i = 1; i <= (Number.isFinite(count) ? count : 0); i++) {
    const file = form.get(`attachment${i}`);
    if (file && typeof file !== "string") {
      attachments.push({ name: file.name, type: file.type, size: file.size });
    }
  }

  try {
    const id = await recordInbound({
      orgId,
      threadId,
      fromEmail: fromEmail || "unknown@invalid",
      fromName: displayNameOf(fromRaw),
      toEmail: toAddress,
      subject,
      bodyText: field("text"),
      bodyHtml: field("html"),
      classification,
      attachments,
      spamScore: Number.isFinite(spamScore) ? spamScore : null,
      envelope,
      messageId: headers["Message-ID"] ?? headers["Message-Id"] ?? null,
    });

    // `null` is the dedupe path, not a failure — Parse retries the same POST.
    return NextResponse.json({ ok: true, id, duplicate: id === null });
  } catch (err) {
    // The one case that SHOULD be retried: our database was unavailable, and
    // the message is still recoverable on SendGrid's side for 24 hours.
    console.error("[email/inbound] could not file the message:", err);
    return NextResponse.json({ error: "Could not store" }, { status: 500 });
  }
}
