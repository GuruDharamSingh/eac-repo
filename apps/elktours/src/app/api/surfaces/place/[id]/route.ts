import { NextResponse } from "next/server";
import { getApiEditor } from "@/lib/auth";
import { getPlace, listPlaceUsage } from "@/lib/places";
import { listAssets } from "@/lib/assets";
import type { PlacePopupData } from "@/components/surfaces/popup-types";

export const dynamic = "force-dynamic";

/**
 * The place popup's data. The catalogue is private (private notes, stats),
 * so this is editors only: anyone else gets a 404, not a 403.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const editor = await getApiEditor().catch(() => null);
  if (!editor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  try {
    const place = await getPlace(id);
    if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [usage, assets] = await Promise.all([listPlaceUsage(id), listAssets({ placeId: id })]);
    const data: PlacePopupData = { place, usage, assets };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[surfaces/place]", err);
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
