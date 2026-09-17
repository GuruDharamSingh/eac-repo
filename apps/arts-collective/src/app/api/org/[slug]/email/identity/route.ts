import { NextResponse } from "next/server";
import { saveOrgEmailIdentity, inboundAddressFor, inboundEnabled } from "@elkdonis/email";
import { guardOrgEmailWrite } from "@/lib/email-suite";

/**
 * Save the org's sending identity: its colours, its reply routing, its owners.
 *
 * Owner-and-guide only, and deliberately NOT owner-only: a guide who runs the
 * org's mail day to day is exactly who needs this, and locking it to the owner
 * is how IFAC — which has no owner row at all — ended up with settings nobody
 * could reach.
 *
 * `fromEmail` is not settable here on purpose. Sending as a domain that is not
 * authenticated in SendGrid fails SPF and DKIM and is rejected outright by
 * Gmail and Yahoo, so it stays a deliberate act by someone who has just done
 * the DNS — not a text field in a console.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await guardOrgEmailWrite(slug);
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    fromName?: string | null;
    replyTo?: string | null;
    ownerEmails?: unknown;
    palette?: unknown;
    inboundReplies?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input: Record<string, unknown> = {};
  if (body.fromName !== undefined) input.fromName = body.fromName;
  if (body.ownerEmails !== undefined) input.ownerEmails = body.ownerEmails;
  // The palette's hex values are re-validated inside saveOrgEmailIdentity —
  // they land in a style attribute in an email, so the allow-list lives beside
  // the write and not out here where a second caller could miss it.
  if (body.palette !== undefined) input.palette = body.palette;

  const routeIn = body.inboundReplies === true;
  if (body.inboundReplies !== undefined) {
    if (routeIn && !inboundEnabled()) {
      return NextResponse.json(
        { error: "This network isn't set up to receive mail yet." },
        { status: 400 }
      );
    }
    input.inboundReplies = routeIn;
    // The toggle IS the reply-to: switching it on points replies at the org's
    // inbound address, and switching it off hands the address back rather than
    // leaving a dead inbound address behind as the reply-to. Storing the
    // consequence rather than re-deriving it at send time means the Look tab
    // shows the truth about where replies go.
    input.replyTo = routeIn
      ? inboundAddressFor(guard.orgId)
      : body.replyTo !== undefined
        ? body.replyTo
        : null;
  } else if (body.replyTo !== undefined) {
    input.replyTo = body.replyTo;
  }

  const result = await saveOrgEmailIdentity(guard.orgId, input);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
