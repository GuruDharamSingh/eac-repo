import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import { createCollaborativeDocument } from "@elkdonis/services";

// site_config rows for the collective are keyed under this org (see
// /api/admin/site-config). The Nextcloud folder uses the IG org.
const SITE_CONFIG_ORG = "elkdonis";
const NEXTCLOUD_ORG = "inner_group";
const ABOUT_KEY = "about_document";

const ADMIN_EMAILS = (process.env.EAC_ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

async function assertAdmin() {
  const session = await getServerSession();
  if (!session?.user) return null;
  if (session.user.email && ADMIN_EMAILS.includes(session.user.email)) return session.user;
  const [u] = await db`SELECT is_admin FROM users WHERE id = ${session.user.id} LIMIT 1`;
  if (u?.is_admin) return session.user;
  return null;
}

interface AboutDocument {
  fileId: string;
  url: string;
  editUrl: string;
  shareToken: string;
  createdAt: string;
}

async function readAboutDoc(): Promise<AboutDocument | null> {
  const [row] = await db`
    SELECT value FROM site_config
    WHERE org_id = ${SITE_CONFIG_ORG} AND key = ${ABOUT_KEY}
    LIMIT 1
  `;
  return (row?.value as AboutDocument) ?? null;
}

// GET — public: returns the configured About document (or null).
export async function GET() {
  try {
    return NextResponse.json({ document: await readAboutDoc() });
  } catch (error) {
    console.error("[about-document] read failed:", error);
    return NextResponse.json({ document: null });
  }
}

// POST — admin: create the living document in Nextcloud and store its share.
// If one already exists, returns it (idempotent) unless { recreate: true }.
export async function POST(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.recreate) {
      const existing = await readAboutDoc();
      if (existing) return NextResponse.json({ document: existing });
    }

    const result = await createCollaborativeDocument(
      NEXTCLOUD_ORG,
      "About — Elkdonis Arts Collective",
      "about-living-doc",
      `# About the Elkdonis Arts Collective\n\n*This is a living document. Anyone with edit access in Nextcloud can keep it current.*\n\nWrite the collective's story here.\n`
    );

    if (!result) {
      return NextResponse.json({ error: "Failed to create document in Nextcloud" }, { status: 502 });
    }

    const document: AboutDocument = {
      fileId: result.fileId,
      url: result.url,
      editUrl: result.editUrl,
      shareToken: result.shareToken,
      createdAt: new Date().toISOString(),
    };

    await db`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${SITE_CONFIG_ORG}, ${ABOUT_KEY}, ${db.json(document as any)}, NOW())
      ON CONFLICT (org_id, key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
    `;

    return NextResponse.json({ document });
  } catch (error) {
    console.error("[about-document] create failed:", error);
    return NextResponse.json({ error: "Failed to create About document" }, { status: 500 });
  }
}

// DELETE — admin: unlink the configured document (does not delete from Nextcloud).
export async function DELETE() {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await db`DELETE FROM site_config WHERE org_id = ${SITE_CONFIG_ORG} AND key = ${ABOUT_KEY}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[about-document] delete failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
