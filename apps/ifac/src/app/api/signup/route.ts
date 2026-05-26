import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const interest = String(body.interest || "").trim();
    const region = String(body.region || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const combinedMessage = [
      message,
      interest && `Interest: ${interest}`,
      region && `Region: ${region}`,
    ]
      .filter(Boolean)
      .join("\n") || null;

    await db`
      INSERT INTO contacts (id, org_id, email, name, message, status, source)
      VALUES (
        ${nanoid()},
        ${siteConfig.orgId},
        ${email},
        ${name},
        ${combinedMessage},
        'new',
        'ifac_signup'
      )
      ON CONFLICT DO NOTHING
    `;

    // Notify owner non-blocking
    void (async () => {
      try {
        const { sendContactNotification } = await import("@elkdonis/email");
        const ownerEmail =
          process.env.NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? "info@ifacgroup.com";
        await sendContactNotification(ownerEmail, {
          senderName: name,
          senderEmail: email,
          message: combinedMessage ?? undefined,
          orgName: siteConfig.orgName,
          source: "ifac_signup",
        });
      } catch (emailErr) {
        console.error("[ifac] signup email failed:", emailErr);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ifac] signup error:", error);
    return NextResponse.json({ error: "Could not submit sign-up." }, { status: 500 });
  }
}
