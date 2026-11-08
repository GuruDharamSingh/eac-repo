import { NextRequest, NextResponse } from "next/server";
import { createPipelineCard } from "@/lib/pipeline";
import { badRequest, num, withMember } from "@/lib/pipeline-api";

export async function POST(request: NextRequest) {
  return withMember(async () => {
    const body = await request.json().catch(() => null);
    const stackId = num(body?.stackId);
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (stackId === null) return badRequest("stackId is required");
    if (!title) return badRequest("A card needs a title");

    const card = await createPipelineCard({
      stackId,
      title,
      description: typeof body?.description === "string" ? body.description : undefined,
      duedate: typeof body?.duedate === "string" ? body.duedate : null,
    });
    return NextResponse.json(card, { status: 201 });
  });
}
