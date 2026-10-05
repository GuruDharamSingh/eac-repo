import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { foundationCatalogues, foundationRulebook, foundationsReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { RulebookEntry, RulebookTerms } from "@/components/studio/foundation-rulebook";

export const metadata: Metadata = { title: "Rulebook · Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * The rulebook of one lesson: for each basic idea, what the owner has
 * confirmed so far, in reading form — his definition, core and fitting
 * qualities, apt pictures, good teaching passages with where they come from —
 * followed by the basic terms he has confirmed. This is what the next model
 * pass is given (the export writes the same content to foundations.json).
 */
export default async function FoundationRulebookPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson } = await params;
  const viewer = await requireStudioReviewer(`/hub/studio/foundations/${lesson}/rulebook`);
  if (!(await foundationsReady())) notFound();
  const [book, catalogues] = await Promise.all([foundationRulebook(viewer.userId, lesson), foundationCatalogues(viewer.userId)]);
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href={`/hub/studio/foundations/${lesson}`} className="text-sm text-muted-foreground hover:text-primary">
        ← Back to reviewing
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Rulebook</p>
      <h1 className="mt-1 text-2xl font-semibold">{book.lesson.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Only what you have confirmed is here. Nothing the AI said is in the rulebook until you mark it. To change something, go back to reviewing.
      </p>
      {book.entries.map(({ concept, entry }) => (
        <section key={concept.id} className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">{concept.label}</h2>
            <Link href={`/hub/studio/foundations/${lesson}?c=${concept.id}`} className="text-xs text-primary">
              {entry.progress.reviewed} / {entry.progress.total} reviewed · review →
            </Link>
          </div>
          <div className="mt-3">
            <RulebookEntry name={concept.label} entry={entry} />
          </div>
        </section>
      ))}
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">Basic terms you confirmed</h2>
          <Link href="/hub/studio/foundations/terms" className="text-xs text-primary">
            review →
          </Link>
        </div>
        <div className="mt-3">
          <RulebookTerms catalogues={catalogues} />
        </div>
      </section>
    </div>
  );
}
