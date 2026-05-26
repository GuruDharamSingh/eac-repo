import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { canManageIfac, getContacts, getIfacUsers } from "@/lib/data";

const VALID_ROLES = new Set(["viewer", "member", "guide"]);

export async function GET() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [users, contacts] = await Promise.all([getIfacUsers(), getContacts()]);
  return NextResponse.json({ users, contacts });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const userId = String(body.userId || "").trim();
  const role = String(body.role || "").trim();
  if (!userId || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "A valid userId and role are required." }, { status: 400 });
  }

  await db`
    INSERT INTO user_organizations (user_id, org_id, role, joined_at)
    VALUES (${userId}, ${siteConfig.orgId}, ${role}, NOW())
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = ${role}
  `;

  const [users, contacts] = await Promise.all([getIfacUsers(), getContacts()]);
  return NextResponse.json({ ok: true, users, contacts });
}
