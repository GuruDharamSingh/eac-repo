import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { canManageIfac, getSiteContent, isSectionKey } from "@/lib/data";

export async function GET() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ content: await getSiteContent() });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const sectionKey = String(body.sectionKey || "");
  if (!isSectionKey(sectionKey)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }

  await db`
    INSERT INTO org_site_sections (org_id, section_key, content, updated_by, updated_at)
    VALUES (
      ${siteConfig.orgId},
      ${sectionKey},
      ${db.json(body.content ?? {})},
      ${session.user?.db_user_id ?? session.user?.id ?? null},
      NOW()
    )
    ON CONFLICT (org_id, section_key)
    DO UPDATE SET
      content = EXCLUDED.content,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;

  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
