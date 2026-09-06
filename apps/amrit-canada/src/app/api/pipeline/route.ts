import { NextResponse } from "next/server";
import { getApiMember } from "@/lib/auth";
import { getPipelineBoard } from "@/lib/pipeline";

export async function GET() {
  const viewer = await getApiMember();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const board = await getPipelineBoard();
    return NextResponse.json(board);
  } catch (error) {
    console.error("[amrit-canada] pipeline fetch error:", error);
    return NextResponse.json({ error: "Could not load the pipeline board" }, { status: 502 });
  }
}
