import { NextResponse, type NextRequest } from "next/server";
import { ClaimError, claimStats, latestClaimVerdicts, loadClaimPassage, nextClaimTextId, recordClaimReview } from "@elkdonis/astro-corpus/server";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * The app's swipe deck for "Check AI claims" (studio refinement), owners only.
 *
 * GET  → the next passage that still has claims to judge: its sentences, and
 *        each claim with its tags, the sentences it most likely came from and
 *        any verdict already given. { passage: null } when everything is seen.
 *        ?textId=<uuid> loads one passage instead of the next.
 * POST { statementId, textId, verdict: accurate | partly | wrong,
 *        conviction?: 0-5, voice?: <uploaded recording path>, note?, seconds? }
 *        records a claim-verdict through the same recordClaimReview as the web
 *        studio (device 'android'), so both land in the same review data.
 *        conviction: 0 = no real reason for the verdict, 5 = a strong feeling
 *        of why; voice: the reasoning as a voice memo (/api/mobile/v1/media).
 * POST { action: "skip", textId } passes the passage over (claim-skip).
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const textId = request.nextUrl.searchParams.get("textId") ?? (await nextClaimTextId(viewer.userId));
  const stats = await claimStats(viewer.userId);
  if (!textId) return NextResponse.json({ passage: null, stats });
  const p = await loadClaimPassage(textId, viewer.userId);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const latest = latestClaimVerdicts(p.reviews);
  return NextResponse.json({
    stats,
    passage: {
      textId: p.textId,
      book: p.book,
      author: p.author,
      pages: p.pages,
      headings: p.headings,
      sentences: p.sentences,
      claims: p.claims.map((c) => ({
        id: c.id,
        body: c.body,
        because: c.because,
        condition: c.condition,
        keys: c.factors.map((f) => ({ key: f.key, label: f.label })),
        conditionKeys: c.conditionKeys,
        sentences: c.sentences,
        verdict: (latest.get(c.id)?.payload.verdict as string | undefined) ?? null,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const skip = b.action === "skip";
  const seconds = typeof b.seconds === "number" && b.seconds >= 0 && b.seconds < 86400 ? b.seconds : null;
  try {
    await recordClaimReview({
      reviewerId: viewer.userId,
      action: skip ? "claim-skip" : "claim-verdict",
      payload: skip
        ? { textId: b.textId, note: b.note }
        : { statementId: b.statementId, textId: b.textId, verdict: b.verdict, note: b.note, conviction: b.conviction, voice: b.voice },
      seconds,
      device: "android",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[mobile] claim deck failed", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
