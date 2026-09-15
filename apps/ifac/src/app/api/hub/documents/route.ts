import {
  assignOrgDocument,
  createOrgDocument,
  listOrgDocuments,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Living documents — collaboratively edited Markdown in the group's storage.
 *
 * The mechanics moved to `@elkdonis/services/org-documents`; this route was
 * their only caller and is now one of three. The index still lives in
 * `site_config` under `living_documents` — the same key, the same entry
 * shape — so every document made before the move still lists. Entries written
 * then carry no `path`, which costs them a snippet on the face and nothing
 * else.
 *
 * The share `createOrgDocument` makes is a public WRITABLE link. That is what
 * makes a document collaborative for members with no Nextcloud account of
 * their own — which, in IFAC, is most of them — and it is why the URL is only
 * ever handed out past the guard above.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();
  return Response.json({
    documents: await listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }),
    canEdit: viewer.canEdit,
  });
}

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { title?: string; ideaId?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  // No title is not an error: it asks for a scrap doc, named by date.
  const document = await createOrgDocument(siteConfig.orgId, {
    title: payload.title,
    authorId: viewer.userId,
    ideaId: payload.ideaId ?? null,
  });
  if (!document) {
    return Response.json(
      { error: "Nextcloud would not create the document" },
      { status: 502 }
    );
  }
  return Response.json({ ok: true, document });
}

export async function PATCH(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { documentId?: string; ideaId?: string | null };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (!payload.documentId) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  const ok = await assignOrgDocument(
    siteConfig.orgId,
    payload.documentId,
    payload.ideaId ?? null
  );
  if (!ok) return Response.json({ error: "No such document" }, { status: 404 });
  return Response.json({ ok: true });
}
