import { NextResponse } from "next/server";
import { getPipelineBoard, provisionPipelineBoard } from "@/lib/pipeline";
import { withEditor } from "@/lib/pipeline-api";

/** Creates the org's board on first use. Idempotent — safe to double-click. */
export async function POST() {
  return withEditor(async () => {
    await provisionPipelineBoard();
    return NextResponse.json(await getPipelineBoard());
  });
}
