import { actOnUpload, listThreadUploads } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { getPaathCircle } from "@/lib/paath";
import { siteConfig } from "@/config/site";

/**
 * The Akhand Path's recordings on their way to YouTube (video_uploads,
 * migration 193; services/youtube-uploads.ts). The circle's author or an org
 * owner/guide only — the same gate as ../publish.
 *
 *   GET  → { uploads }
 *   POST {id, action: approve|retry|skip|restore} → { uploads }
 */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });
const ACTIONS = ["approve", "retry", "skip", "restore"] as const;

async function gate() {
  const [circle, viewer] = await Promise.all([getPaathCircle(), getViewer().catch(() => null)]);
  if (!circle || !viewer) return null;
  if (viewer.userId !== circle.authorId && !viewer.canEdit) return null;
  return { circle, viewer };
}

export async function GET() {
  const g = await gate();
  if (!g) return nope();
  return Response.json({ uploads: await listThreadUploads(siteConfig.orgId, g.circle.id) });
}

export async function POST(request: Request) {
  const g = await gate();
  if (!g) return nope();
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  const action = ACTIONS.find((a) => a === body?.action);
  if (!body || typeof body.id !== "string" || !action) return Response.json({ error: "Bad request" }, { status: 400 });
  const ok = await actOnUpload(siteConfig.orgId, g.circle.id, body.id, action, g.viewer.userId);
  if (!ok) return Response.json({ error: action === "approve" ? "Choose a channel first, or it has already moved on." : "It has already moved on." }, { status: 400 });
  return Response.json({ uploads: await listThreadUploads(siteConfig.orgId, g.circle.id) });
}
