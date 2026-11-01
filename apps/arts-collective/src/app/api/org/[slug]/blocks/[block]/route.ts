import { NextResponse } from "next/server";
import { getOrgBySlug } from "@/lib/org";
import { isBlockDataId, loadBlockData } from "@/lib/puck/data";

/**
 * Rows for a data block on an org's designed landing page, for the editor's
 * canvas (the published page calls the loader directly).
 *
 * Per-org by route, like every console connector here (`/api/org/[slug]/…`):
 * this app hosts every org, so the deployment has no org of its own to take
 * the id from. Ungated, because everything `loadBlockData` returns is already
 * on the org's public site: published PUBLIC threads, the offering `/offering`
 * shows, and the people chips `/profile` draws.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; block: string }> }
) {
  const { slug, block } = await params;
  if (!isBlockDataId(block)) return NextResponse.json({ error: "Unknown block" }, { status: 404 });
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit"));
  const props: Record<string, unknown> = Number.isFinite(raw) ? { limit: raw } : {};
  return NextResponse.json(await loadBlockData(block, org.id, props));
}
