import { NextResponse, type NextRequest } from "next/server";
import {
  CENTER_SECTION_IDS,
  canEditOrgIdentity,
  resolveCenterLayout,
  saveCenterLayout,
  type CenterLayout,
} from "@elkdonis/services";
import { isAdmin } from "@elkdonis/auth-server";
import type { SurfaceCenterLayout, SurfaceCenterLayoutShape } from "@elkdonis/cms-ui/surface";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * The center's definition, read and written from the arranging surface.
 *
 * GET ?org=<id>  → the resolved layout (default ← network ← org), the section
 *                  labels, and whether the viewer may edit it.
 * PATCH ?org=<id> → save that org's row (owner/guide/admin), or the network
 *                  default when `org` is `elkdonis` (admin only).
 */
export const dynamic = "force-dynamic";

const NETWORK_CONFIG_ORG = "elkdonis";

const SECTION_LABELS: Record<string, string> = {
  profile: "Your card",
  buttons: "Your buttons",
  orgs: "Where you are",
  promo: "Promoted slot",
  site: "The site, scaled",
  org: "The org's card",
  pinned: "Pinned",
  feed: "Latest from the org",
  featured: "Featured",
  network: "Across the network",
};

async function orgName(orgId: string): Promise<string | null> {
  const { db } = await import("@elkdonis/db");
  const [row] = await db<Array<{ name: string }>>`SELECT name FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return row?.name ?? null;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get("org") ?? siteConfig.orgId;
  const name = await orgName(orgId);
  if (!name) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ layout }, canEdit, admin] = await Promise.all([
    resolveCenterLayout(orgId),
    canEditOrgIdentity(viewer.userId, orgId),
    isAdmin(viewer.userId).catch(() => false),
  ]);
  const out: SurfaceCenterLayout = {
    orgId,
    orgName: name,
    resolved: layout,
    sections: CENTER_SECTION_IDS.map((id) => ({ id, label: SECTION_LABELS[id] ?? id })),
    canEdit: canEdit || admin,
    networkOrgId: admin ? NETWORK_CONFIG_ORG : null,
  };
  return NextResponse.json(out);
}

export async function PATCH(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const orgId = request.nextUrl.searchParams.get("org") ?? siteConfig.orgId;
  if (!(await orgName(orgId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = await isAdmin(viewer.userId).catch(() => false);
  const allowed =
    orgId === NETWORK_CONFIG_ORG ? admin : admin || (await canEditOrgIdentity(viewer.userId, orgId));
  if (!allowed) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as SurfaceCenterLayoutShape | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    // saveCenterLayout validates: unknown sections, voices and limits are dropped.
    const saved = await saveCenterLayout(orgId, body as unknown as Partial<CenterLayout>);
    return NextResponse.json({ ok: true, layout: saved });
  } catch (err) {
    console.error("[center] layout PATCH:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
