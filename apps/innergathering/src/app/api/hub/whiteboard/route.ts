import { getWhiteboard, saveWhiteboard, type WhiteboardScene } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * The group's shared whiteboard: one Excalidraw scene, org-wide.
 *
 * Any member may draw on it — deliberately NOT `canEdit`. Publishing is an
 * organiser's act; sketching a seating plan is not, and a scratch space that
 * four of the five people can only look at is not a scratch space.
 *
 * The scene lives in `site_config`, read and written by the shared service.
 * The route exists per app because the permission gate is the security
 * boundary and is worth reading in the app it protects.
 */
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ error: "Members only" }, { status: 403 });
}

export async function GET() {
  if (!(await getApiMember())) return forbidden();
  return Response.json({ scene: await getWhiteboard(siteConfig.orgId) });
}

export async function PUT(request: Request) {
  if (!(await getApiMember())) return forbidden();
  const body = (await request.json().catch(() => ({}))) as { scene?: WhiteboardScene };
  if (!body.scene) return Response.json({ error: "scene required" }, { status: 400 });
  await saveWhiteboard(siteConfig.orgId, body.scene);
  return Response.json({ ok: true });
}
