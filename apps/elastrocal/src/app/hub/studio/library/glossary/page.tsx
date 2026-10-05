import Link from "next/link";
import type { Metadata } from "next";
import { libraryGlossary, libraryNotes, libraryReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { LibraryNote } from "@/components/studio/library-note";

export const metadata: Metadata = { title: "Glossary · Library · Studio" };
export const dynamic = "force-dynamic";

/** Every book's glossary terms in one alphabetical list; a term two books define shows both. */
export default async function LibraryGlossaryPage() {
  const viewer = await requireStudioReviewer("/hub/studio/library/glossary");
  const terms = (await libraryReady()) ? await libraryGlossary() : [];
  const notes = await libraryNotes(viewer.userId, { type: "glossary" });
  const letters = [...new Set(terms.map((t) => t.term.charAt(0).toUpperCase()))];
  const books = new Set(terms.flatMap((t) => t.definitions.map((d) => d.book)));
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library" className="text-sm text-muted-foreground hover:text-primary">
        ← Library
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Library</p>
      <h1 className="mt-1 text-2xl font-semibold">Glossary</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {terms.length} terms from {books.size} book{books.size === 1 ? "" : "s"}, A to Z. Where two books have the same term, both are shown under it. Use ✎ to leave a note on a term.
      </p>
      <nav className="mt-3 flex flex-wrap gap-1 text-sm">
        {letters.map((l) => (
          <a key={l} href={`#letter-${l}`} className="rounded border border-border px-2 py-0.5 hover:border-primary/60">
            {l}
          </a>
        ))}
      </nav>
      <dl className="mt-4">
        {terms.map((t, i) => {
          const first = i === 0 || terms[i - 1].term.charAt(0).toUpperCase() !== t.term.charAt(0).toUpperCase();
          return (
            <div key={t.slug} id={t.slug} className="scroll-mt-4 border-t border-border/60 py-3">
              {first && <span id={`letter-${t.term.charAt(0).toUpperCase()}`} className="scroll-mt-4" />}
              <dt className="flex flex-wrap items-start gap-x-1 font-semibold">
                <span className="min-w-0 flex-1">
                  {t.term}
                  {t.also.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">also: {t.also.join(", ")}</span>}
                </span>
                <span className="font-normal">
                  <LibraryNote
                    targetType="term"
                    targetId={t.slug}
                    silo={{ type: "glossary", subject: t.slug }}
                    context={`Glossary term “${t.term}”: ${t.definitions.map((d) => `${d.book}: ${(d.definition || d.keywords.join(", ")).slice(0, 180)}`).join(" | ")}`}
                    note={notes[`term|${t.slug}`]}
                  />
                </span>
              </dt>
              {t.definitions.map((d, j) => (
                <dd key={j} className="mt-1 text-sm leading-relaxed">
                  {t.see && /^see /i.test(d.definition.trim()) ? (
                    t.see.slug ? (
                      <a href={`#${t.see.slug}`} className="text-primary">
                        See {t.see.term} →
                      </a>
                    ) : (
                      d.definition
                    )
                  ) : (
                    d.definition || (d.keywords.length ? <span className="text-muted-foreground">Keywords: {d.keywords.join(", ")}</span> : <span className="text-muted-foreground">No definition given.</span>)
                  )}
                  {d.definition && d.keywords.length > 0 && <span className="block text-xs text-muted-foreground">Keywords: {d.keywords.join(", ")}</span>}
                  <span className="block text-xs text-muted-foreground">
                    — {d.book}
                    {d.pages ? ` · ${d.pages}` : ""}
                  </span>
                </dd>
              ))}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
