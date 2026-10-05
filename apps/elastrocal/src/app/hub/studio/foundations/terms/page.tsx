import Link from "next/link";
import type { Metadata } from "next";
import { describeFoundationHistory, foundationCatalogues, foundationsReady, foundationState, TERMS_SCOPE } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FoundationTerms } from "@/components/studio/foundation-terms";

export const metadata: Metadata = { title: "Basic terms · Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * "Basic terms, book by book": one book's catalogue of basic terms
 * (`?book=<slug>`, the first by default), grouped, for the owner to check —
 * the term itself (Right / Needs fixing / Not a basic term), its keywords
 * (click one to strike it, add his own) and a note.
 */
export default async function FoundationTermsPage({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const viewer = await requireStudioReviewer("/hub/studio/foundations/terms");
  const sp = await searchParams;
  const ready = await foundationsReady();
  const state = ready ? await foundationState(viewer.userId) : null;
  const catalogues = state ? await foundationCatalogues(viewer.userId, state) : [];
  const book = catalogues.find((c) => c.slug === sp.book) ?? catalogues[0];
  const history = state ? await describeFoundationHistory(state, 5, TERMS_SCOPE) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/foundations" className="text-sm text-muted-foreground hover:text-primary">
        ← Foundations
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Basic terms, book by book</p>
      {!book ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No book’s terms have been imported yet.</p>
      ) : (
        <>
          {catalogues.length > 1 && (
            <nav className="mt-2 flex flex-wrap gap-2" aria-label="Books">
              {catalogues.map((c) => (
                <Link
                  key={c.slug}
                  href={`/hub/studio/foundations/terms?book=${c.slug}`}
                  className={cn("rounded-xl border px-3 py-1.5 text-sm", c.slug === book.slug ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
                >
                  {c.book}{" "}
                  <span className="text-xs tabular-nums opacity-80">
                    {c.reviewed}/{c.total}
                  </span>
                </Link>
              ))}
            </nav>
          )}
          <FoundationTerms key={book.slug} catalogue={book} history={history.map((h) => ({ reviewId: h.reviewId, label: h.label }))} />
        </>
      )}
    </div>
  );
}
