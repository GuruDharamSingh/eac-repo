import {
  assignOrgDocument,
  createOrgDocument,
  listOrgDocuments,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * The group's living documents.
 *
 * Every read and write is behind membership, because what this route hands out
 * is a public WRITABLE share link — that link is the permission, so anyone who
 * has it can edit the document whether or not they are still in the group.
 *
 * The shapes are `@elkdonis/cms-ui/surface`'s `SurfaceDocument`, which
 * `createHubConnectors` reads without an adapter.
 */
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ error: "Members only" }, { status: 403 });
}

export async function GET() {
  if (!(await getApiMember())) return forbidden();
  // One snippet: the face draws a snapshot of the current document only, and
  // each one costs a WebDAV round trip.
  return Response.json({
    documents: await listOrgDocuments(siteConfig.orgId, { withSnippets: 1 }),
  });
}

export async function POST(request: Request) {
  const viewer = await getApiMember();
  if (!viewer) return forbidden();

  let payload: { title?: string; ideaId?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  // No title is not an error here: it asks for a scrap doc, named by date.
  const document = await createOrgDocument(siteConfig.orgId, {
    title: payload.title,
    authorId: viewer.userId,
    authorName: viewer.email,
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
  if (!(await getApiMember())) return forbidden();

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
