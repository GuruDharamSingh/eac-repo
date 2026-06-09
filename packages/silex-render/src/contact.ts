import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getOrgBySlug } from "./queries";

/**
 * Shared org-scoped inquiry/contact handler. Each host app exposes
 * POST /api/org/[slug]/contact as a one-liner that delegates here. Logs the
 * contact against the org and emails the org owner via @elkdonis/email.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveOwnerEmail(orgId: string): Promise<string | null> {
  try {
    const rows = await db<{ email: string | null }[]>`
      SELECT u.email
      FROM user_organizations uo
      JOIN users u ON (u.id = uo.user_id OR u.auth_user_id = uo.user_id)
      WHERE uo.org_id = ${orgId} AND uo.role = 'owner'
      ORDER BY uo.role
      LIMIT 1
    `;
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

export async function handleOrgContact(
  req: Request,
  { slug }: { slug: string }
): Promise<NextResponse> {
  try {
    const org = await getOrgBySlug(slug);
    if (!org) {
      return NextResponse.json({ error: "Unknown site." }, { status: 404 });
    }

    const body = (await req.json()) as {
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
      newsletter?: boolean;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    const name =
      (body.name?.trim() ||
        [body.firstName, body.lastName]
          .map((p) => p?.trim())
          .filter(Boolean)
          .join(" ")) ||
      null;

    const subject = body.subject?.trim();
    const messageBody = body.message?.trim();
    const fullMessage =
      [subject ? `Subject: ${subject}` : null, messageBody]
        .filter(Boolean)
        .join("\n\n") || null;

    try {
      await db`
        INSERT INTO contacts (id, org_id, email, name, message, source)
        VALUES (
          ${crypto.randomUUID()},
          ${org.id},
          ${email},
          ${name},
          ${fullMessage},
          ${"silex-site"}
        )
      `;
    } catch (dbErr) {
      console.error("[handleOrgContact] insert failed:", dbErr);
    }

    void (async () => {
      try {
        const { sendContactNotification } = await import("@elkdonis/email");
        const ownerEmail =
          (await resolveOwnerEmail(org.id)) ??
          process.env.EAC_OWNER_EMAIL ??
          "info@elkdonis-arts.org";
        await sendContactNotification(ownerEmail, {
          senderName: name || email,
          senderEmail: email,
          message: fullMessage || undefined,
          orgName: org.name,
          source: "silex-site",
        });
      } catch (emailErr) {
        console.error("[handleOrgContact] email failed:", emailErr);
      }
    })();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[handleOrgContact]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
