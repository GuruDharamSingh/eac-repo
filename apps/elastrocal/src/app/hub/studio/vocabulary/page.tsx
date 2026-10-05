import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { describeVocabHistory, getVocabCard, nextVocabCard, vocabProgress, vocabReady, vocabState } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { VocabSorter } from "@/components/studio/vocab-sorter";

export const metadata: Metadata = { title: "Sort the vocabulary · Studio" };
export const dynamic = "force-dynamic";

/**
 * "Sort the vocabulary" (bedrock, step 1): one candidate term at a time —
 * the first deck in its order, then by how many books use it. Put it in one
 * of your groups (or a new one), rename it, mark it the same as another
 * card, or say it is not a term. Your groups become the concept kinds and
 * your renames and synonyms the thesaurus (/hub/studio/vocabulary/groups).
 * `?c=<cardId>` re-sorts one card.
 */
export default async function VocabularyPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const viewer = await requireStudioReviewer("/hub/studio/vocabulary");
  const sp = await searchParams;
  if (!(await vocabReady()))
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        The vocabulary tables are not set up yet (migration 182).{" "}
        <Link href="/hub/studio" className="text-primary">
          Back to the studio
        </Link>
      </div>
    );
  const state = await vocabState(viewer.userId);
  const [card, progress] = await Promise.all([sp.c ? getVocabCard(sp.c) : nextVocabCard(viewer.userId, state), vocabProgress(viewer.userId, state)]);
  if (sp.c && !card) notFound();

  const current = card ? (state.decisions.get(card.id) ?? null) : null;
  const history = await describeVocabHistory(state, 5);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
          ← Studio
        </Link>
        <Link href="/hub/studio/vocabulary/groups" className="text-sm text-primary">
          Your groups ({state.groups.length}) →
        </Link>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.2em] text-gold">Sort the vocabulary</span>
          <span className="tabular-nums">
            {progress.deck.total > 0 ? `${progress.deck.sorted} / ${progress.deck.total} of the first deck · ` : ""}
            {progress.all.sorted.toLocaleString()} / {progress.all.total.toLocaleString()} in all
          </span>
        </div>
        {progress.deck.total > 0 && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.round((100 * progress.deck.sorted) / progress.deck.total)}%` }} />
          </div>
        )}
      </div>

      {card ? (
        <VocabSorter
          key={card.id}
          card={card}
          current={current ? { verdict: current.verdict, groups: current.groups, preferred: current.preferred, sameAs: current.sameAs } : null}
          groups={state.groups}
          ratings={[...(state.examples.get(card.id)?.values() ?? [])].map((e) => ({ text: e.text, rating: e.rating, note: e.note }))}
          history={history.map((h) => ({ reviewId: h.reviewId, label: h.label }))}
          revisiting={Boolean(sp.c)}
        />
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <p>{progress.all.total === 0 ? "No vocabulary cards have been imported yet." : "Every card has been sorted."}</p>
          <Link href="/hub/studio/vocabulary/groups" className="mt-3 inline-block text-primary">
            See your groups
          </Link>
        </div>
      )}
    </div>
  );
}
