import { getPublishTarget, setPublishTarget } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { getPaathCircle } from "@/lib/paath";
import { siteConfig } from "@/config/site";

/**
 * Where the Akhand Path's recordings go (threads.metadata.publish.youtube;
 * services/publish-target.ts). The circle's author or an org owner/guide only.
 *
 *   GET  → PublishTargetView
 *   POST {connectionId?, privacy?, mode?} → PublishTargetView
 */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });

async function gate() {
  const [circle, viewer] = await Promise.all([getPaathCircle(), getViewer().catch(() => null)]);
  if (!circle || !viewer) return null;
  if (viewer.userId !== circle.authorId && !viewer.canEdit) return null;
  return { circle, viewer };
}

export async function GET() {
  const g = await gate();
  if (!g) return nope();
  const target = await getPublishTarget(siteConfig.orgId, g.circle.id);
  return target ? Response.json(target) : nope();
}

export async function POST(request: Request) {
  const g = await gate();
  if (!g) return nope();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });
  const r = await setPublishTarget(siteConfig.orgId, g.circle.id, g.viewer.userId, body);
  if (r.ok === false) return Response.json({ error: r.error }, { status: 400 });
  return Response.json(r.target);
}
