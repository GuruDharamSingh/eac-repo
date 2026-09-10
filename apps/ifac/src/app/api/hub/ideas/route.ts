import { createThread } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { listIdeas } from "@/lib/hub-data";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Suggested ideas.
 *
 * An idea is a thread (`kind = 'idea'`), written through the shared
 * `createThread` rather than a hand-rolled INSERT — which is what earned it
 * slug uniqueness, excerpt derivation and correct published_at handling for
 * free. IFAC's only other write path, /api/admin/events, is a raw INSERT and
 * has none of those.
 *
 * Ideas are published on submission rather than queued for approval: a
 * suggestion box whose contents only an admin can see is a comment form. What
 * an admin does have is the ability to archive one.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();
  return Response.json({
    ideas: await listIdeas(30),
    canEdit: viewer.canEdit,
  });
}

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let payload: { title?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const title = (payload.title ?? "").trim().slice(0, 200);
  if (title.length < 3) {
    return Response.json(
      { error: "Give the idea a short title" },
      { status: 400 }
    );
  }

  try {
    const thread = await createThread({
      kind: "idea",
      orgId: siteConfig.orgId,
      authorId: viewer.userId,
      title,
      body: (payload.body ?? "").trim().slice(0, 5000) || undefined,
      status: "published",
      // Members-only: an idea under discussion is not the org's public face.
      visibility: "ORGANIZATION",
      section: "ideas",
    });
    return Response.json({ ok: true, id: thread.id, title: thread.title });
  } catch (error) {
    console.error("[ifac] hub/ideas create:", error);
    return Response.json({ error: "Could not save that idea" }, { status: 500 });
  }
}
