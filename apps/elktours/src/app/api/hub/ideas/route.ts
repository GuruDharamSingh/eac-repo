import { createOrgIdea, listOrgIdeas } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Suggested ideas.
 *
 * An idea is a thread in this org's `ideas` feed, published on submission —
 * a suggestion box whose contents only an admin can see is a comment form.
 * Members-only both ways: the feed is not public, so neither is this.
 */
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ error: "Members only" }, { status: 403 });
}

export async function GET() {
  if (!(await getApiMember())) return forbidden();
  return Response.json({
    // No `threadHref`: a thread's address is the forum's to build (its
    // connectors own `hrefs.thread`), and guessing it here would be a link
    // that silently 404s the day that shape changes.
    ideas: await listOrgIdeas(siteConfig.orgId),
  });
}

export async function POST(request: Request) {
  const viewer = await getApiMember();
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
    return Response.json({ error: "Give the idea a few more words" }, { status: 400 });
  }
  return Response.json({ ok: true, idea });
}
