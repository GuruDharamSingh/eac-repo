import { getWhiteboard, saveWhiteboard, type WhiteboardScene } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * The group's shared whiteboard: one Excalidraw scene, org-wide. Any member
 * can open and draw on it, the same as the ideas face — this is a scratch
 * space, not editorial content, so there is no editor gate.
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
