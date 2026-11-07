import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getExperienceById, listExperienceTours } from "@/lib/experiences";
import type { ExperiencePopupData } from "@/components/surfaces/popup-types";

export const dynamic = "force-dynamic";

/**
 * The experience popup's data (Overview · Artist · In tours). Published
 * experiences are public; drafts only for editors. `metadata.page` (Puck
 * data) is not sent: the popup never draws it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);
  try {
    const e = await getExperienceById(id);
    // Drafts: editors only. Members-only (ORGANIZATION): members and editors. Never to the public.
    const visible = canEdit || (e?.status === "published" && (e.visibility === "PUBLIC" || (e.visibility === "ORGANIZATION" && Boolean(viewer?.isMember))));
    if (!e || !visible) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const tours = await listExperienceTours(e.id, { publishedOnly: !canEdit });
    const data: ExperiencePopupData = {
      experience: { ...e, page: null },
      tours,
      canEdit,
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[surfaces/experience]", err);
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
