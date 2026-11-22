import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getTourById } from "@/lib/tours";
import { loadTourLayout } from "@/lib/tour-layout";
import { loadTourPageData } from "@/lib/tour-page-data";
import { readStageOptions } from "@/blocks/tour/stage-options";

export const dynamic = "force-dynamic";

/**
 * The tour popup's stage (2026-11-20): the same TourPageData the tour page builds, plus the Hero stage block's
 * saved settings from the site's tour layout, so the popup draws the stage the page draws. Read only. Published
 * tours are public; drafts only for editors. Guide notes are stripped in loadTourPageData.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);
  const base = await getTourById(id);
  if (!base || (base.status !== "published" && !viewer?.canEdit)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [{ data }, layout] = await Promise.all([loadTourPageData(base, viewer, { others: false }), loadTourLayout()]);
  const block = layout.content.find((c) => c.type === "TourStage");
  const options = readStageOptions(block?.props ?? {});
  return NextResponse.json({ data, options });
}
