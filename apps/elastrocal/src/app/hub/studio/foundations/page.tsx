import Link from "next/link";
import type { Metadata } from "next";
import { correspondenceView, foundationCatalogues, foundationsReady, listFoundationLessons } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * "Foundations": the training restarted from the basics, one basic idea at a
 * time, read from a small shelf of books. Each lesson (first: the four
 * elements) lists what the books say about each idea for the owner to
 * confirm, correct and add to; what he confirms becomes the rulebook entry.
 * "Basic terms, book by book" is the per-book term catalogue.
 */
export default async function FoundationsPage() {
  const viewer = await requireStudioReviewer("/hub/studio/foundations");
  if (!(await foundationsReady()))
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        The foundations tables are not set up yet (migration 183).{" "}
        <Link href="/hub/studio" className="text-primary">
          Back to the studio
        </Link>
      </div>
    );
  const [lessons, catalogues, corr] = await Promise.all([listFoundationLessons(viewer.userId), foundationCatalogues(viewer.userId), correspondenceView(viewer.userId)]);
  const cells = corr?.types.reduce((n, t) => n + t.total, 0) ?? 0;
  const cellsJudged = corr?.types.reduce((n, t) => n + t.judged, 0) ?? 0;
  const terms = catalogues.reduce((n, c) => n + c.total, 0);
  const termsDone = catalogues.reduce((n, c) => n + c.reviewed, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
        ← Studio
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Foundations</p>
      <h1 className="mt-1 text-2xl font-semibold">Start from the basics</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One basic idea at a time. The AI has read a small shelf of books and noted what they say. You check it: confirm what is right, reject what is not,
        fix what it misread, and add what the books missed. What you confirm becomes the rulebook the AI learns from.
      </p>

      <Link href="/hub/studio/library" className="mt-5 flex items-center justify-between rounded-2xl border-2 border-gold bg-gold/10 px-5 py-4 hover:bg-gold/20">
        <span>
          <span className="block font-semibold">Library: see what we have so far</span>
          <span className="block text-sm text-muted-foreground">Every subject with its keywords, passages and the books they come from. Just for looking; nothing to decide.</span>
        </span>
        <span className="text-xl text-gold" aria-hidden>
          →
        </span>
      </Link>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lessons</h2>
      {lessons.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No lesson has been imported yet.</p>}
      <ul className="mt-3 space-y-3">
        {lessons.map((l) => (
          <li key={l.lesson} className="rounded-2xl border border-primary/60 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/hub/studio/foundations/${l.lesson}`} className="text-lg font-semibold hover:text-primary">
                {l.title} →
              </Link>
              <span className="text-xs tabular-nums text-muted-foreground">
                {l.reviewed.toLocaleString()} / {l.total.toLocaleString()} reviewed
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${l.total ? Math.round((100 * l.reviewed) / l.total) : 0}%` }} />
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {l.progress.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/hub/studio/foundations/${l.lesson}?c=${c.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm hover:border-primary/60"
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {c.reviewed} / {c.total} · {c.defined ? "defined" : "no definition yet"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Read from {l.shelf.length} book{l.shelf.length === 1 ? "" : "s"}
                {l.version ? ` · reading of ${l.version}` : ""}
              </span>
              <Link href={`/hub/studio/foundations/${l.lesson}/rulebook`} className="text-primary">
                The rulebook so far →
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">The correspondence table</h2>
      <Link href="/hub/studio/foundations/correspondences" className="mt-3 flex items-center justify-between rounded-2xl border border-primary/60 px-5 py-4 hover:bg-primary/5">
        <span>
          <span className="block font-semibold">What goes with what</span>
          <span className="block text-sm text-muted-foreground">
            {cells === 0
              ? "No table has been imported yet."
              : `One table of what each book gives for every sign, planet, house and element (colour, ruler, keywords…): ${cellsJudged.toLocaleString()} / ${cells.toLocaleString()} values checked. Say what to keep, and which rows are useful for readings.`}
          </span>
        </span>
        <span className="text-xl text-primary" aria-hidden>
          →
        </span>
      </Link>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Basic terms, book by book</h2>
      <Link href="/hub/studio/foundations/terms" className="mt-3 flex items-center justify-between rounded-2xl border border-primary/60 px-5 py-4 hover:bg-primary/5">
        <span>
          <span className="block font-semibold">Check each book’s basic terms</span>
          <span className="block text-sm text-muted-foreground">
            {catalogues.length === 0
              ? "No book has been imported yet."
              : `${catalogues.map((c) => c.book).join(" · ")}: ${termsDone} / ${terms} terms checked. Say which terms are right, and which keywords to keep.`}
          </span>
        </span>
        <span className="text-xl text-primary" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}
