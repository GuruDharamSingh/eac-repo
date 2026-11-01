import { NextRequest, NextResponse } from "next/server";
import { deletePipelineStack, renamePipelineStack } from "@/lib/pipeline";
import { badRequest, num, withEditor } from "@/lib/pipeline-api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stackId: string }> }
) {
  return withEditor(async () => {
    const { stackId: rawStackId } = await params;
    const stackId = num(rawStackId);
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (stackId === null) return badRequest("stackId is required");
    if (!title) return badRequest("A list needs a title");

    const stack = await renamePipelineStack(stackId, title);
    return NextResponse.json(stack);
  });
}

/** Deck deletes the stack's cards with it — the UI confirms first. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stackId: string }> }
) {
  return withEditor(async () => {
    const { stackId: rawStackId } = await params;
    const stackId = num(rawStackId);
    if (stackId === null) return badRequest("stackId is required");

    await deletePipelineStack(stackId);
    return new NextResponse(null, { status: 204 });
  });
}
