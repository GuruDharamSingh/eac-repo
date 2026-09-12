import { NextResponse, type NextRequest } from "next/server";
import { getIdentity } from "@/lib/auth";
import { deleteChart, updateChart } from "@/lib/charts";
import { firstIssue, updateChartSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rename, (un)favourite or annotate one of the keeper's charts. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const { keeper } = await getIdentity();
  if (!keeper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateChartSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const ok = await updateChart(id, keeper, parsed.data);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { keeper } = await getIdentity();
  if (!keeper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await deleteChart(id, keeper);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
