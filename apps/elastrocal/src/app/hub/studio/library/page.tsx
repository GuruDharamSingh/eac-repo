import Link from "next/link";
import type { Metadata } from "next";
import { libraryIndex, libraryReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Library · Studio" };
export const dynamic = "force-dynamic";

/**
 * The Library: what has been accumulated so far, by subject, and where it
 * came from. Read-only. Each subject ("silo") lists its keywords, passages
 * and the books behind them.
 */
export default async function LibraryPage() {
  await requireStudioReviewer("/hub/studio/library");
  if (!(await libraryReady()))
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">
        The library tables are not set up yet (migrations 183 to 185).{" "}
        <Link href="/hub/studio" className="text-primary">
          Back to the studio
        </Link>
      </div>
    );
  const index = await libraryIndex();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
      <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
        ← Studio
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Library</p>
      <h1 className="mt-1 text-2xl font-semibold">What we have so far, and where it came from</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything gathered from the books, filed by subject. Open a subject to see its keywords, the passages filed under it and which books they come from. Nothing here needs a
        decision from you.
      </p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {index.groups.map((g) => (
          <a key={g.name} href={`#${g.name.replace(/\s+/g, "-").toLowerCase()}`} className="rounded-full border border-border px-3 py-1 hover:border-primary/60">
            {g.name} <span className="text-xs tabular-nums text-muted-foreground">{g.silos.length}</span>
          </a>
        ))}
        <Link href="/hub/studio/library/glossary" className="rounded-full border border-primary/60 px-3 py-1 text-primary">
          Glossary <span className="text-xs tabular-nums">{index.glossary.terms}</span>
        </Link>
        <Link href="/hub/studio/library/people" className="rounded-full border border-primary/60 px-3 py-1 text-primary">
          People <span className="text-xs tabular-nums">{index.people}</span>
        </Link>
        <Link href="/hub/studio/library/books" className="rounded-full border border-primary/60 px-3 py-1 text-primary">
          Books
        </Link>
        <Link href="/hub/studio/library/notes" className="rounded-full border border-gold px-3 py-1">
          ✎ Your notes
        </Link>
      </nav>

      {index.groups.map((g) => (
        <section key={g.name} id={g.name.replace(/\s+/g, "-").toLowerCase()} className="mt-8 scroll-mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {g.name} <span className="tabular-nums">· {g.silos.length}</span>
          </h2>
          {g.silos.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing filed here yet.</p>}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.silos.map((s) => (
              <li key={`${s.type}/${s.subject}`}>
                <Link
                  href={`/hub/studio/library/${s.type}/${encodeURIComponent(s.subject)}`}
                  className="block rounded-xl border border-border bg-card px-4 py-2.5 text-sm hover:border-primary/60"
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {[s.keywords ? `${s.keywords.toLocaleString()} keywords` : null, s.passages ? `${s.passages.toLocaleString()} passages` : null, `${s.books} book${s.books === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-8 grid gap-2 sm:grid-cols-2">
        <Link href="/hub/studio/library/glossary" className="rounded-xl border border-primary/60 px-4 py-3 text-sm hover:bg-primary/5">
          <span className="font-semibold">Glossary terms</span>
          <span className="block text-xs text-muted-foreground">
            {index.glossary.terms} terms from {index.glossary.books} books, in one alphabetical list
          </span>
        </Link>
        <Link href="/hub/studio/library/people" className="rounded-xl border border-primary/60 px-4 py-3 text-sm hover:bg-primary/5">
          <span className="font-semibold">People</span>
          <span className="block text-xs text-muted-foreground">{index.people ? `${index.people} famous people, by placement` : "No people have been imported yet."}</span>
        </Link>
      </section>
    </div>
  );
}
