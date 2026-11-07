// Stand-in for apps/elktours/src/lib/review-actions.ts in the harness (2026-11-06).
const g = globalThis as any;
g.__reviewCalls = [];
export async function listReviewsAction(target: { type: string; id: string }) {
  g.__reviewCalls.push(target);
  return {
    reviews: [{ id: "r1", target, rating: 5, body: "Unhurried and full of stories.", status: "visible", author: { userId: "u1", name: "A visitor", slug: null, avatarUrl: null }, mine: false, createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z", hiddenReason: null }],
    summary: { target, count: 1, ratedCount: 1, average: 5 },
    viewer: { signedIn: false, canReview: false, canModerate: false, mineId: null },
  };
}
export async function saveReviewAction() { return { ok: true }; }
export async function deleteOwnReviewAction() { return { ok: true }; }
export async function setReviewHiddenAction() { return { ok: true }; }
