import { NextResponse } from "next/server";
import { acceptNetworkTerms, hasAcceptedNetworkTerms } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * The network Terms (migration 223): POST records the signed-in person's
 * acceptance of the current version; GET says whether they have.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json({ accepted: await hasAcceptedNetworkTerms(user.id) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const r = await acceptNetworkTerms(user.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
