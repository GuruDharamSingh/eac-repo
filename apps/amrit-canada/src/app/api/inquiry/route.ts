import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const threadId: string | undefined = body.threadId;
    const name: string = (body.name ?? "").trim();
    const email: string = (body.email ?? "").trim();
    const message: string = (body.message ?? "").trim();

    if (!threadId || !name || !email) {
      return NextResponse.json(
        { error: "Name, email, and the service are required." },
        { status: 400 }
      );
    }

    const [thread] = await db<{ id: string; title: string; author_email: string | null }[]>`
      SELECT t.id, t.title, u.email AS author_email
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.id = ${threadId}
        AND t.org_id = ${siteConfig.orgId}
        AND t.status = 'published'
      LIMIT 1
    `;

    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db`
      INSERT INTO guest_submissions (id, thread_id, kind, name, email, message)
      VALUES (${nanoid()}, ${thread.id}, 'inquiry', ${name}, ${email}, ${message || null})
    `;

    if (email) {
      await db`
        INSERT INTO contacts (id, org_id, email, name, message, status, source)
        VALUES (${nanoid()}, ${siteConfig.orgId}, ${email}, ${name}, ${message || null}, 'new', 'inquiry')
        ON CONFLICT DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[amrit-canada] POST /api/inquiry:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
