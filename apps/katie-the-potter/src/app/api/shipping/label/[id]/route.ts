import type { NextRequest } from "next/server";
import { getApiEditor } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";
import { UUID_RE } from "@/lib/shop";
import { getShipment } from "@/lib/shipping/shipments";

/**
 * "Download label (PDF)" on /manage/orders: editors only. Redirects to the
 * label document Easyship made (its URL carries the buyer's address, so it
 * is never put in a page's HTML).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = await siteOrigin();
  const editor = await getApiEditor();
  if (!editor) return Response.redirect(`${origin}/login?next=${encodeURIComponent("/manage/orders")}`, 303);
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const row = await getShipment(id);
  if (!row?.labelUrl || !/^https:\/\//.test(row.labelUrl)) return new Response("No label yet", { status: 404 });
  return Response.redirect(row.labelUrl, 302);
}
