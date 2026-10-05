import Link from "next/link";
import type { Metadata } from "next";
import { vocabGroups, vocabReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { VocabGroups } from "@/components/studio/vocab-groups";

export const metadata: Metadata = { title: "Vocabulary groups · Studio" };
export const dynamic = "force-dynamic";

/**
 * The emerging thesaurus: every group the owner made, its cards under their
 * preferred labels with synonyms nested under the main card, plus the cards
 * he called "not a term" and the ones he skipped. Rename or merge a group,
 * move a card; all of it is stored as reviews and replayed on read.
 */
export default async function VocabularyGroupsPage() {
  const viewer = await requireStudioReviewer("/hub/studio/vocabulary/groups");
  if (!(await vocabReady()))
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        The vocabulary tables are not set up yet (migration 182).{" "}
        <Link href="/hub/studio" className="text-primary">
          Back to the studio
        </Link>
      </div>
    );
  const view = await vocabGroups(viewer.userId);
  const cards = view.groups.reduce((n, g) => n + g.total, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio/vocabulary" className="text-sm text-muted-foreground hover:text-primary">
          ← Sorting
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Your groups</span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Your vocabulary</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {view.groups.length} group{view.groups.length === 1 ? "" : "s"} · {cards.toLocaleString()} cards sorted · {view.notTerms.length} not terms ·{" "}
        {view.skipped.length} skipped. Your groups become the concept kinds; your labels and “same as” links the thesaurus.
      </p>
      <VocabGroups view={view} />
    </div>
  );
}
