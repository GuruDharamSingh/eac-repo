import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";

/**
 * Confirm an organisation after its intake interview, from /hub/admin.
 *
 * Network-admin only. Org owners cannot confirm their own site — the whole
 * point of the gate is that someone from the collective has spoken to them.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { slug } = await params;

  try {
    const rows = await db<Array<{ slug: string }>>`
      UPDATE organizations
      SET subdomain_confirmed = TRUE,
          confirmed_at = NOW(),
          confirmed_by = ${user.id}
      WHERE slug = ${slug} AND NOT subdomain_confirmed
      RETURNING slug
    `;

    if (!rows[0]) {
      // Either no such org, or it was already confirmed. Both are fine to
      // report as success-ish — the caller's intent is satisfied either way.
      const [exists] = await db<Array<{ slug: string }>>`
        SELECT slug FROM organizations WHERE slug = ${slug} LIMIT 1
      `;
      if (!exists) {
        return NextResponse.json({ error: "Unknown organisation" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }

    return NextResponse.json({ ok: true, slug: rows[0].slug });
  } catch (err) {
    console.error("org confirm failed", err);
    return NextResponse.json(
      { error: "Could not confirm organisation" },
      { status: 500 }
    );
  }
}
