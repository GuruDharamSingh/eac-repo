import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { libraryBook, libraryNotes, libraryReady, placementLabel, READING_KINDS, readingGroup, readingLabel } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LibraryNote } from "@/components/studio/library-note";
import { BASIC_LABEL, words } from "@/components/studio/library-books";

export const metadata: Metadata = { title: "Book outline · Library · Studio" };
export const dynamic = "force-dynamic";

const siloLabel = (silo: string) => {
  const i = silo.indexOf("/");
  const subject = silo.slice(i + 1);
  return silo.startsWith("placement/") ? placementLabel(subject) : silo.startsWith("house/") ? `House ${subject}` : subject.charAt(0).toUpperCase() + subject.slice(1);
};
const siloHref = (silo: string) => {
  const i = silo.indexOf("/");
  return `/hub/studio/library/${silo.slice(0, i)}/${encodeURIComponent(silo.slice(i + 1))}`;
};

/** One book's outline: chapters, their sections, each with its kind of reading, what it is about, its layout and where it is filed. */
export default async function LibraryBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await requireStudioReviewer(`/hub/studio/library/book/${slug}`);
  if (!(await libraryReady())) notFound();
  const book = await libraryBook(slug);
  if (!book) notFound();
  const notes = await libraryNotes(viewer.userId, { type: "book", subject: slug });
  const here = { type: "book", subject: slug };
  const card = book.card;
  const flat = book.chapters.flatMap((c) => c.sections);
  /** The outline section a passage number falls in (the most specific one), as an anchor. */
  const anchorOf = (from: number) => {
    const hit = flat.filter((x) => x.from <= from && from <= x.to).sort((a, b) => b.level - a.level || b.from - a.from)[0];
    return hit ? `#s-${hit.from}-${hit.to}` : null;
  };
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library/books" className="text-sm text-muted-foreground hover:text-primary">
        ← Books
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Book outline</p>
      <h1 className="mt-1 text-2xl font-semibold">{card?.title ?? book.book}</h1>
      {card && (
        <p className="mt-1 text-sm text-muted-foreground">
          {[card.author, words(card.tradition), words(card.type), card.priority ? `${card.priority} priority` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      {card && (
        <section className="mt-4 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
          {card.shape && <p className="leading-relaxed">{card.shape}</p>}
          {card.textQuality && <p className="mt-2 text-xs text-muted-foreground">Text quality: {words(card.textQuality)}</p>}
          {card.duplicateOf && <p className="mt-1 text-xs text-gold">May be a second copy of: {card.duplicateOf}</p>}
          {Object.keys(card.basics).length > 0 && (
            <>
              <h2 className="mt-4 font-semibold">Where the basics are</h2>
              <p className="text-xs text-muted-foreground">Each line says what is there and which passages it covers; the link jumps to that part of the outline below.</p>
              <div className="mt-2 space-y-2">
                {Object.keys(BASIC_LABEL)
                  .filter((k) => card.basics[k]?.length)
                  .map((k) => (
                    <details key={k} open={card.basics[k].length <= 6}>
                      <summary className="cursor-pointer select-none text-sm font-medium capitalize">
                        {BASIC_LABEL[k]} <span className="text-xs font-normal tabular-nums text-muted-foreground">· {card.basics[k].length}</span>
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-4 text-sm">
                        {card.basics[k].map((e, i) => {
                          const href = anchorOf(e.from);
                          return (
                            <li key={i}>
                              {e.what}{" "}
                              <span className="text-xs text-muted-foreground">
                                · passage{e.to > e.from ? `s ${e.from}–${e.to}` : ` ${e.from}`}
                                {href && (
                                  <>
                                    {" · "}
                                    <a href={href} className="text-primary">
                                      in the outline ↓
                                    </a>
                                  </>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ))}
              </div>
            </>
          )}
          {card.alsoHas.length > 0 && (
            <>
              <h2 className="mt-4 font-semibold">Also has</h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {card.alsoHas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        {book.chapters.length} chapters · {book.sections} sections · {book.passages.toLocaleString()} passages. Each section says what kind of reading it is and what it is about; the links
        go to where its passages are filed. A section with no link is about too many things at once, so it stays under its chapter only.
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {READING_KINDS.filter((k) => book.byKind[k]).map((k) => (
          <span key={k} className="rounded-full border border-border px-2 py-0.5">
            {readingLabel(k)} <span className="tabular-nums text-muted-foreground">{book.byKind[k]}</span>
          </span>
        ))}
      </p>
      <LibraryNote box targetType="silo" targetId={`book/${slug}`} silo={here} context={`Book: ${card?.title ?? book.book}${card?.author ? `, ${card.author}` : ""}`} note={notes[`silo|book/${slug}`]} />
      {book.chapters.map((c, ci) => (
        <section key={`${ci}-${c.chapter}`} className="mt-6">
          <h2 className="font-semibold">{c.chapter}</h2>
          <ul className="mt-1.5 divide-y divide-border/60 rounded-xl border border-border text-sm">
            {c.sections.map((sec) => {
              const group = readingGroup(sec.kind);
              const id = `${slug}:${sec.from}-${sec.to}`;
              return (
                <li key={`${sec.from}-${sec.to}-${sec.title}`} id={`s-${sec.from}-${sec.to}`} className="scroll-mt-4 px-3 py-2 target:bg-gold/10" style={{ paddingLeft: `${0.75 + Math.max(0, sec.level - 2) * 1}rem` }}>
                  <div className="flex flex-wrap items-start gap-x-1">
                    <div className="min-w-0 flex-1">
                      <span className={cn(sec.level <= 2 && "font-medium")}>{sec.title}</span>{" "}
                      <span className={cn("rounded-full border px-1.5 text-[10px]", group === "general" || group === "natal" ? "border-primary/50 text-primary" : "border-gold text-foreground")}>{readingLabel(sec.kind)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[sec.subjects.length ? `about ${sec.subjects.slice(0, 6).join(", ")}${sec.subjects.length > 6 ? "…" : ""}` : null, sec.layout ? sec.layout.replace(/_/g, " ") : null, `${sec.passages ?? 0} passage${sec.passages === 1 ? "" : "s"}`]
                          .filter(Boolean)
                          .join(" · ")}
                        {sec.silos.length > 0 && " · filed in "}
                        {sec.silos.slice(0, 8).map((silo, i) => (
                          <span key={silo}>
                            {i > 0 && ", "}
                            <Link href={siloHref(silo)} className="text-primary">
                              {siloLabel(silo)}
                            </Link>
                          </span>
                        ))}
                      </span>
                      {sec.note && <span className="block text-xs italic text-muted-foreground">{sec.note}</span>}
                    </div>
                    <LibraryNote targetType="section" targetId={id} silo={here} context={`${book.book}, section “${sec.title}” (${c.chapter}; ${readingLabel(sec.kind)}${sec.subjects.length ? `; about ${sec.subjects.slice(0, 6).join(", ")}` : ""})`} note={notes[`section|${id}`]} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
