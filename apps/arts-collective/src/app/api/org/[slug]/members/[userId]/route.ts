import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { setOrgRole, removeOrgMember, type OrgRole } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { isOrgOwner } from "@/lib/org";

const ALLOWED_ROLES: OrgRole[] = ["owner", "guide", "member", "viewer"];

async function resolveOrgId(slug: string): Promise<string | null> {
  const rows = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;
  const user = await requireUser();

  const orgId = await resolveOrgId(slug);
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (!(await isOrgOwner(user.id, orgId))) {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role as OrgRole | undefined;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const membership = await setOrgRole(userId, orgId, role);
  return NextResponse.json({ ok: true, membership });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;
  const user = await requireUser();

  const orgId = await resolveOrgId(slug);
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  if (!(await isOrgOwner(user.id, orgId))) {
    return NextResponse.json({ error: "Owners only" }, { status: 403 });
  }
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Owners can't remove themselves" },
      { status: 400 }
    );
  }

  const removed = await removeOrgMember(userId, orgId);
  return NextResponse.json({ ok: removed });
}
