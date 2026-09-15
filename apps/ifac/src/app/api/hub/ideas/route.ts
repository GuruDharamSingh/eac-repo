import { createOrgIdea, listOrgIdeas } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Suggested ideas.
 *
 * The listing and the write both live in `@elkdonis/services/org-ideas` now —
 * this route was the only real implementation in the repo, so it was lifted
 * rather than copied and the two template apps serve the same shapes. What
 * stays here is IFAC's own guard.
 *
 * Unchanged in the move: an idea is a thread (`kind = 'idea'`, section
 * `ideas`, ORGANIZATION visibility) written through the shared `createThread`,
 * and it is published on submission — a suggestion box whose contents only an
 * admin can see is a comment form.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();
  return Response.json({
    ideas: await listOrgIdeas(siteConfig.orgId, { limit: 30 }),
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

  const idea = await createOrgIdea(siteConfig.orgId, {
    authorId: viewer.userId,
    title: payload.title ?? "",
    body: payload.body,
  });
  if (!idea) {
    return Response.json({ error: "Give the idea a short title" }, { status: 400 });
  }
  return Response.json({ ok: true, idea });
}
