import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@elkdonis/auth-server";
import { reviewResponse } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Record an Elkdonis review of one submission.
 *
 * Network-admin only. Org owners cannot review submissions about their own
 * collective — vetting is the platform's judgement, not the applicant's.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { responseId } = await params;
  const body = await request.json().catch(() => null);
  const outcome = body?.outcome;

  if (outcome !== "reviewed" && outcome !== "returned") {
    return NextResponse.json(
      { error: "outcome must be 'reviewed' or 'returned'" },
      { status: 400 }
    );
  }
  // A return with no explanation leaves the applicant with nothing to act on.
  if (outcome === "returned" && !body?.note?.trim()) {
    return NextResponse.json(
      { error: "A note is required when returning a submission" },
      { status: 400 }
    );
  }

  const result = await reviewResponse(responseId, user.id, outcome, {
    note: body?.note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
