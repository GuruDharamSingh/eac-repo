import { db } from "@elkdonis/db";
import { createCollaborativeDocument } from "@elkdonis/services";
import { nanoid } from "nanoid";
import { siteConfig } from "@/config/site";
import { listLivingDocuments } from "@/lib/hub-data";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Living documents — collaboratively edited Markdown in the group's storage.
 *
 * Why the index lives in `site_config` rather than in Nextcloud: the files are
 * written as `<timestamp>-<id>.md`, so a PROPFIND of the Documents folder
 * recovers dates but NOT titles. A title has to be recorded when the document
 * is created or it is gone. inner-gathering's about-document route established
 * `site_config` as the place for exactly this, for a single document; this is
 * the same idea holding a list, which is why it needs no migration.
 *
 * The share created by `createCollaborativeDocument` is a public *writable*
 * link. That is what makes the document collaborative for members who have no
 * Nextcloud account of their own — which, in IFAC, is most of them — and it is
 * also why the URL is only ever handed to members past the guard above.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();
  return Response.json({
    documents: await listLivingDocuments(),
    canEdit: viewer.canEdit,
  });
}

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { title?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const title = (payload.title ?? "").trim().slice(0, 200);
  if (!title) {
    return Response.json({ error: "Give the document a title" }, { status: 400 });
  }

  // The service's signature is meeting-shaped (`meetingTitle`, `meetingId`)
  // because a meeting agenda was its first caller. A synthetic id is the
  // honest thing to pass for a standalone document — it only ever becomes part
  // of the filename.
  const documentId = nanoid();
  const created = await createCollaborativeDocument(
    siteConfig.orgId,
    title,
    documentId
  );
  if (!created) {
    return Response.json(
      { error: "Nextcloud would not create the document" },
      { status: 502 }
    );
  }

  const entry = {
    id: documentId,
    title,
    url: created.url,
    editUrl: created.editUrl,
    createdAt: new Date().toISOString(),
    createdBy: viewer.userId,
  };

  // Append inside the statement rather than read-modify-write: two members
  // creating a document at once would otherwise have one silently overwrite
  // the other's entry.
  await db`
    INSERT INTO site_config (org_id, key, value)
    VALUES (${siteConfig.orgId}, 'living_documents', ${db.json([entry] as never)})
    ON CONFLICT (org_id, key) DO UPDATE
      SET value = COALESCE(site_config.value, '[]'::jsonb) || ${db.json([entry] as never)},
          updated_at = NOW()
  `;

  return Response.json({ ok: true, document: entry });
}
