import { NextResponse } from "next/server";
import { listPipelineArchivedCards } from "@/lib/pipeline";
import { withMember } from "@/lib/pipeline-api";

export async function GET() {
  return withMember(async () => NextResponse.json(await listPipelineArchivedCards()));
}
