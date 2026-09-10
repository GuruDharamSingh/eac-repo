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

  // Self-join grants `viewer`, not `member`.
  //
  // This route is deliberately ungated — it is how `/login?org=<slug>` gets a
  // new person affiliated with the org that invited them, and requiring
  // approval there would break onboarding. But `member` is the role that
  // satisfies all three of:
  //
  //   - isOrgAffiliate (media-authz)      → the org's PRIVATE media
  //   - org_feeds.min_role = 'member'     → the org's non-public feeds
  //   - canClaimStore (commerce)          → opening a store in that org
  //
  // so an ungated route granting it meant any signed-in person could take
  // themselves from nothing to reading any org's private files in two
  // requests. `viewer` ranks below `member` in ROLE_RANK, so it carries
  // affiliation and public access and none of those three. Promotion to
  // `member` is a deliberate act by someone who already holds the org.
  await db`
    INSERT INTO user_organizations (user_id, org_id, role)
    VALUES (${user.id}, ${org.id}, 'viewer')
    ON CONFLICT (user_id, org_id) DO NOTHING
  `;

  return NextResponse.json({ ok: true, role: "viewer" });
}
