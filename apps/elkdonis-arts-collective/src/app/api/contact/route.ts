import { NextRequest, NextResponse } from "next/server";

const ORG_ID = "elkdonis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message } = body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const trimmed = email.trim().toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    const { db } = await import("@elkdonis/db");

    await db`
      INSERT INTO contacts (id, org_id, email, name, message, source)
      VALUES (
        ${crypto.randomUUID()},
        ${ORG_ID},
        ${trimmed},
        ${name?.trim() ?? null},
        ${message?.trim() ?? null},
        ${"landing-page"}
      )
    `;

    // Fire email non-blocking
    void (async () => {
      try {
        const { sendContactNotification } = await import("@elkdonis/email");
        const ownerEmail =
          process.env.EAC_OWNER_EMAIL ?? "info@elkdonis-arts.org";
        await sendContactNotification(ownerEmail, {
          senderName: name?.trim() || trimmed,
          senderEmail: trimmed,
          message: message?.trim() || undefined,
          orgName: "Elkdonis Arts Collective",
          source: "landing-page",
        });
      } catch (emailErr) {
        console.error("[eac] contact email failed:", emailErr);
      }
    })();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[/api/contact]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
