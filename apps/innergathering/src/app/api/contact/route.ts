import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";

/**
 * "Leave a Message" from the footer. Lands in `contacts` for this org, and
 * emails the collective's inbox when the email client is configured — a
 * delivery failure never costs the person their message.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; message?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const name = body.name?.trim() || null;
  const message = body.message?.trim() || null;

  try {
    await db`
      INSERT INTO contacts (id, org_id, email, name, message, status, source)
      VALUES (${nanoid()}, ${siteConfig.orgId}, ${email}, ${name}, ${message}, 'new', 'landing-page')
    `;
  } catch (err) {
    console.error("[innergathering] contact:", err);
    return NextResponse.json({ error: "Could not save your message." }, { status: 500 });
  }

  void (async () => {
    try {
      const { sendContactNotification } = await import("@elkdonis/email");
      await sendContactNotification(siteConfig.fallbackNotifyEmail, { senderName: name ?? email, senderEmail: email, message: message ?? undefined, orgId: siteConfig.orgId, orgName: siteConfig.orgName, source: "landing-page" });
    } catch (err) {
      console.error("[innergathering] contact email:", err);
    }
  })();

  return NextResponse.json({ ok: true });
}
