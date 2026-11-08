import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";

// ============================================================================
// The contact form's handler (round 6, 2026-11-08): POST /api/org/<org>/contact,
// posted by he-contact (components/contact/contact-form.tsx). Moved here from
// the shared package this site no longer uses, line for line in behaviour: the
// same validation and messages, a `contacts` row against the org, a note to
// the org's owner by @elkdonis/email (sent after the reply, never awaited),
// and the same responses: 201 { ok: true }; 400/404/500 { error }.
// ============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The `contacts.source` value every message from this form has carried; kept
 * as stored so the address book and old rows read the same.
 */
const CONTACT_SOURCE = "silex-site";

async function orgBySlug(slug: string): Promise<{ id: string; name: string } | null> {
  try {
    const [org] = await db<{ id: string; name: string }[]>`
      SELECT id, name FROM organizations WHERE slug = ${slug} LIMIT 1
    `;
    return org ?? null;
  } catch {
    return null;
  }
}

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

export async function handleContact(req: Request, { slug }: { slug: string }): Promise<NextResponse> {
  try {
    const org = await orgBySlug(slug);
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
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const name =
      body.name?.trim() ||
      [body.firstName, body.lastName]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ") ||
      null;

    const subject = body.subject?.trim();
    const messageBody = body.message?.trim();
    const fullMessage = [subject ? `Subject: ${subject}` : null, messageBody].filter(Boolean).join("\n\n") || null;

    try {
      await db`
        INSERT INTO contacts (id, org_id, email, name, message, source)
        VALUES (${crypto.randomUUID()}, ${org.id}, ${email}, ${name}, ${fullMessage}, ${CONTACT_SOURCE})
      `;
    } catch (dbErr) {
      console.error("[hidden-enneagram] contact insert failed:", dbErr);
    }

    void (async () => {
      try {
        const { sendContactNotification } = await import("@elkdonis/email");
        const ownerEmail = (await resolveOwnerEmail(org.id)) ?? process.env.EAC_OWNER_EMAIL ?? "info@elkdonis-arts.org";
        await sendContactNotification(ownerEmail, {
          senderName: name || email,
          senderEmail: email,
          message: fullMessage || undefined,
          orgName: org.name,
          source: CONTACT_SOURCE,
        });
      } catch (emailErr) {
        console.error("[hidden-enneagram] contact email failed:", emailErr);
      }
    })();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[hidden-enneagram] contact:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
