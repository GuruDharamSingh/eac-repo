import { getWhiteboard, saveWhiteboard, type WhiteboardScene } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

/**
 * The group's shared whiteboard: one Excalidraw scene, org-wide.
 *
 * Any member can open and draw on it — the same gate as the ideas face, and
 * for the same reason: this is a scratch space, not editorial content, so
 * `canEdit` is deliberately not consulted. Publishing is an owner/guide act;
 * sketching is not.
 *
 * The scene lives in `site_config` under key `whiteboard`, read and written by
 * the shared service. The route exists per app because the permission gate is
 * the security boundary and is worth reading in the app it protects.
 */
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ error: "Members only" }, { status: 403 });
}

export async function GET() {
  if (!(await getHubViewer())) return forbidden();
  return Response.json({ scene: await getWhiteboard(siteConfig.orgId) });
}

export async function PUT(request: Request) {
  if (!(await getHubViewer())) return forbidden();

  let payload: { scene?: WhiteboardScene };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (!payload.scene || !Array.isArray(payload.scene.elements)) {
    return Response.json({ error: "scene.elements is required" }, { status: 400 });
  }

  await saveWhiteboard(siteConfig.orgId, payload.scene);
  return Response.json({ ok: true });
}
