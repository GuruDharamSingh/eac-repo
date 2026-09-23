import { NextResponse } from "next/server";
import { getInboxMessage, recordSend, sendEmail, setInboxState } from "@elkdonis/email";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Reply to a message in the org's inbox, from the org's own address.
 *
 * The suite used to hand you a `mailto:` link, which opened whatever mail app
 * the browser is bound to and sent the reply from a PERSON — so the recipient
 * saw an individual's address, the org's inbox never learned a reply had been
 * sent, and the thread ended up split across someone's personal Sent folder.
 *
 * The reply goes out through the same `sendEmail` every other letter uses, so
 * From name, reply-to and the unsubscribe group are resolved from this org's
 * `email:identity` rather than restated here, and the send lands in the same
 * ledger the Activity tab already reads.
 *
 * `ifacgroup.com` is domain-authenticated in SendGrid (subdomain `em5156`),
 * which is what makes sending as this org legitimate rather than spoofed. An
 * org WITHOUT authentication would fail SPF/DKIM and be rejected outright by
 * Gmail — so if this route is copied to another site, check that first.
 */
export async function POST(req: Request) {
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { messageId?: string; to?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = (body.messageId ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!messageId) return NextResponse.json({ error: "No message" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Write something first" }, { status: 400 });

  // The recipient is taken from the STORED message, never from the request.
  // A client-supplied address would turn an org's editor tools into an open
  // relay: post any address, and mail goes out signed as the organisation.
  const original = await getInboxMessage(siteConfig.orgId, messageId);
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = original.fromEmail?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "That message has no reply address" },
      { status: 422 }
    );
  }

  const subject = (body.subject ?? "").trim() ||
    (original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject ?? ""}`);

  // Escape before wrapping in HTML: the body is operator-typed, but it is
  // still text being put into markup, and a stray `<` should survive as a `<`
  // rather than opening a tag.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<div style="white-space:pre-wrap">${escaped}</div>`;

  try {
    const res = await sendEmail({
      to,
      subject,
      html,
      orgId: siteConfig.orgId,
      // EmailKind has no `reply` member. `contact` is the conversational
      // kind and an answer to an enquiry is exactly that; the finer label
      // rides in `categories`, which is free-form.
      kind: "contact",
      categories: ["inbox-reply"],
      customArgs: { inbox_message_id: messageId },
    });

    await recordSend({
      orgId: siteConfig.orgId,
      kind: "contact",
      toEmail: to,
      subject,
      sgMessageId: res.messageId,
      // `queued`, not "sent": SendGrid ACCEPTING a message is not delivery.
      // The event webhook is what later moves it to delivered/bounced, and
      // claiming delivery here would make the ledger lie.
      status: res.ok ? "queued" : "failed",
      error: res.ok ? null : "send returned not-ok",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "SendGrid refused the message" }, { status: 502 });
    }

    // Answering something is the strongest possible signal it has been dealt
    // with, so it stops being unread without the operator also having to say so.
    await setInboxState(siteConfig.orgId, messageId, "read").catch(() => {});

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error("[ifac] email reply:", err);
    // Record the failure too — a reply that never left is exactly the thing
    // the ledger should be able to account for.
    await recordSend({
      orgId: siteConfig.orgId,
      kind: "contact",
      toEmail: to,
      subject,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
    return NextResponse.json({ error: "Could not send" }, { status: 500 });
  }
}
