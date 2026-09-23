import { setShowcaseCardSize } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

/**
 * How big the showcase's cards are. Set from the page itself by a guide;
 * services re-checks owner-or-guide, so this route only says who is asking.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Sign in first." }, { status: 401 });

  let body: { size?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }

  const r = await setShowcaseCardSize(viewer.userId, siteConfig.orgId, String(body.size ?? ""));
  if (r.ok === false) return Response.json({ error: r.error }, { status: 403 });
  return Response.json({ ok: true, size: r.size });
}
