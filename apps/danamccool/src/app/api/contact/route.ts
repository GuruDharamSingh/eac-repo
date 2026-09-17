import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { getRedisClient } from "@elkdonis/redis";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";

// ============================================================================
// Where the contact form's messages go.
//
// The block that posts here is in @elkdonis/blocks and knows none of this: it
// sends to a fixed path and reports what came back. Everything that decides
// WHOSE message this is happens on this side, from the deployment's own org —
// never from the request — so a copied form cannot file under another org.
//
// Messages land in `contacts`, which already exists (org_id, email, name,
// message, status, source) and is already what the inquiry route on
// amrit-canada writes to. No new table, and Dana's inbox is one query.
//
// NOTHING IS EMAILED. The network's SendGrid key is still a placeholder and no
// mail has ever been sent from here, so a route that claimed to notify her
// would be claiming something untrue. The messages are stored and readable at
// /manage/messages; wiring the notification is a separate, honest piece of
// work that needs a key first.
// ============================================================================

const MAX = { name: 120, email: 200, subject: 120, message: 4000 };

/** Deliberately loose — a validator that rejects real addresses is worse than
 *  one that lets an undeliverable one through, since nothing here sends. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Six messages an hour from one address.
 *
 * Through Redis, which this deployment already runs, and wrapped so that Redis
 * being down means the form still works rather than the site losing its
 * contact page. A rate limit is a courtesy to the person reading the inbox,
 * not a security boundary — the honeypot and the length caps are what actually
 * hold the line.
 */
async function withinRate(ip: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `contact:${siteConfig.orgId}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    return count <= 6;
  } catch {
    return true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // The honeypot. A person never sees the field; a bot that fills every
    // input does. Answered with 200 and no record — telling a bot it was
    // detected is telling it what to change.
    if (String(body.company ?? "").trim()) {
      return NextResponse.json({ ok: true });
    }

    const name = String(body.name ?? "").trim().slice(0, MAX.name);
    const email = String(body.email ?? "").trim().slice(0, MAX.email);
    const subject = String(body.subject ?? "").trim().slice(0, MAX.subject);
    const message = String(body.message ?? "").trim().slice(0, MAX.message);

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Please give your name, your email and a message." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
    }

    // `x-forwarded-for` is the proxy's word for who this is, and it is a
    // header — trusted only for rate limiting, never for anything that grants
    // access.
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    if (!(await withinRate(ip))) {
      return NextResponse.json(
        { error: "That is a lot of messages. Please try again later." },
        { status: 429 }
      );
    }

    // The subject is kept with the message rather than dropped: `contacts` has
    // no column for one, and losing "About: a commission" would lose the most
    // useful line in the message.
    const stored = subject ? `About: ${subject}\n\n${message}` : message;

    await db`
      INSERT INTO contacts (id, org_id, email, name, message, status, source)
      VALUES (${nanoid()}, ${siteConfig.orgId}, ${email}, ${name}, ${stored}, 'new', 'contact-form')
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[danamccool] POST /api/contact:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
