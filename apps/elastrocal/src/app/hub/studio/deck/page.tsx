import Link from "next/link";
import type { Metadata } from "next";
import { DECK_KINDS, FLAG_REASONS, loadDeckItem, nextQuestionId, PICK_REASONS, TRADITIONS, type DeckKind } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { ReviewCard } from "@/components/studio/review-card";
import { draftFootnotes } from "@/lib/draft-footnotes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review · Studio" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<DeckKind, string> = {
  all: "All",
  curated: "Curated",
  sign: "Signs",
  house: "Houses",
  aspect: "Aspects",
  planet: "Planets alone",
  zodiac: "Signs alone",
  realm: "Areas of life",
  "aspect-type": "Aspects alone",
  transit: "Transits",
  "transit-house": "Transit houses",
  "transit-sign": "Transit signs",
  compat: "Compatibility",
  general: "General",
};

/**
 * The review deck: one question at a time, chosen by the queue in
 * @elkdonis/astro-corpus — questions with AI-drafted answers to judge first,
 * then priority, the factors with the fewest gold texts, and chance.
 * `?mode=test` serves only the blind test set instead. Submitting refreshes
 * this page, which draws the next.
 */
export default async function DeckPage({ searchParams }: { searchParams: Promise<{ kind?: string; mode?: string }> }) {
  const viewer = await requireStudioReviewer("/hub/studio/deck");
  const sp = await searchParams;
  const test = sp.mode === "test";
  const kind = !test && (DECK_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as DeckKind) : "all";

  const id = await nextQuestionId(viewer.userId, kind, test ? "test" : "judge");
  const item = id ? await loadDeckItem(id) : null;

  // Candidate order is shuffled per showing and recorded with the review:
  // pairwise choices lean towards one position.
  const candidates = item ? [...item.candidates].sort(() => Math.random() - 0.5) : [];
  // Per-sentence sources for the AI drafts (lib/draft-footnotes.ts). Never the draft's design.
  const footnotes = item && !item.question.isTest
    ? await draftFootnotes(candidates.filter((c) => c.kind === "generated").map((c) => c.id)).catch((err) => {
        console.error("[elastrocal] draft footnotes failed", err);
        return {};
      })
    : {};

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
          ← Studio
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">{test ? "Test set · blind" : "Review"}</span>
      </div>

      {test ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Only test-set questions, with no AI drafts shown.{" "}
          <Link href="/hub/studio/deck" className="text-primary">
            Back to judging AI answers
          </Link>
        </p>
      ) : (
        <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Question kind">
          {DECK_KINDS.map((k) => (
            <Link
              key={k}
              href={k === "all" ? "/hub/studio/deck" : `/hub/studio/deck?kind=${k}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs",
                k === kind ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {KIND_LABEL[k]}
            </Link>
          ))}
        </nav>
      )}


      {item ? (
        <ReviewCard
          key={item.question.id}
          question={item.question}
          candidates={candidates}
          footnotes={footnotes}
          explainHref={item.question.isTest ? undefined : `/hub/studio/explain?q=${item.question.id}`}
          gold={item.gold}
          pickReasons={[...PICK_REASONS]}
          flagReasons={[...FLAG_REASONS]}
          traditions={[...TRADITIONS]}
        />
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          {test ? (
            <>
              <p>You have answered every test-set question.</p>
              <Link href="/hub/studio/deck" className="mt-3 inline-block text-primary">
                Judge AI answers
              </Link>
            </>
          ) : (
            <>
              <p>Nothing left to review in {KIND_LABEL[kind].toLowerCase()}.</p>
              <Link href="/hub/studio/deck" className="mt-3 inline-block text-primary">
                Review all kinds
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
