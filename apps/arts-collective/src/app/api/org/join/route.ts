import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";

export async function POST(req: Request) {
  const user = await requireUser();

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const orgs = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  const org = orgs[0];
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const existing = await db<{ role: string }[]>`
    SELECT role FROM user_organizations
    WHERE user_id = ${user.id} AND org_id = ${org.id}
    LIMIT 1
  `;
  if (existing[0]) {
    return NextResponse.json({
      ok: true,
      already: true,
      role: existing[0].role,
    });
  }

  await db`
    INSERT INTO user_organizations (user_id, org_id, role)
    VALUES (${user.id}, ${org.id}, 'member')
    ON CONFLICT (user_id, org_id) DO NOTHING
  `;

  return NextResponse.json({ ok: true, role: "member" });
}
