import { NextResponse, type NextRequest } from "next/server";
import { VocabError, getVocabCard, nextVocabCard, recordVocabReview, vocabGroups, vocabProgress, vocabReady, vocabState } from "@elkdonis/astro-corpus/server";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * The app's swipe deck for "Sort the vocabulary" (bedrock step 1), owners only.
 *
 * GET  → the next card to sort (term, where it came from, example sentences,
 *        how many books use it), the owner's existing group names, progress.
 *        ?c=<cardId> loads one card instead of the next.
 * POST { cardId, verdict: group | not-a-term | skip, groups?: string[],
 *        conviction?: 0-5, voice?, note?, seconds? }
 *        records a vocab-sort through the same recordVocabReview as the web
 *        studio (device 'android'). "group" needs at least one group name; an
 *        existing group's near-duplicate spelling is matched to it by the
 *        corpus layer, never made a second group.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  if (!(await vocabReady())) return NextResponse.json({ error: "The vocabulary tables are not set up" }, { status: 503 });
  const state = await vocabState(viewer.userId);
  const c = request.nextUrl.searchParams.get("c");
  const [card, progress, view] = await Promise.all([
    c ? getVocabCard(c) : nextVocabCard(viewer.userId, state),
    vocabProgress(viewer.userId, state),
    vocabGroups(viewer.userId),
  ]);
  return NextResponse.json({
    card,
    progress,
    // Groups with the most cards first: the likeliest places for the next term.
    groups: [...view.groups].sort((a, b) => b.total - a.total).map((g) => ({ name: g.name, total: g.total })),
  });
}

export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const seconds = typeof b.seconds === "number" && b.seconds >= 0 && b.seconds < 86400 ? b.seconds : null;
  try {
    await recordVocabReview({
      reviewerId: viewer.userId,
      action: "vocab-sort",
      payload: { cardId: b.cardId, verdict: b.verdict, groups: b.groups, note: b.note, conviction: b.conviction, voice: b.voice },
      seconds,
      device: "android",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof VocabError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[mobile] vocab deck failed", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
