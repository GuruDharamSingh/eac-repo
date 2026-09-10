import { NextRequest, NextResponse } from "next/server";
import { createPipelineStack } from "@/lib/pipeline";
import { badRequest, withEditor } from "@/lib/pipeline-api";

export async function POST(request: NextRequest) {
  return withEditor(async () => {
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("A list needs a title");

    const stack = await createPipelineStack(title);
    return NextResponse.json(stack, { status: 201 });
  });
}
