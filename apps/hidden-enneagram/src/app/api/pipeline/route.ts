import { NextResponse } from "next/server";
import { getPipelineBoard } from "@/lib/pipeline";
import { withMember } from "@/lib/pipeline-api";

export async function GET() {
  return withMember(async () => {
    const board = await getPipelineBoard();
    return NextResponse.json(board);
  });
}
