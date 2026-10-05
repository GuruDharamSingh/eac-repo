import Link from "next/link";
import type { Metadata } from "next";
import { libraryNotesList } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Your notes · Library · Studio" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { silo: "on the whole subject", keyword: "on a keyword", passage: "on a passage", correspondence: "on a value", term: "on a term", section: "on a book section", person: "on the people", reading: "on a line of a reading" };

/** Every note the owner has left in the Library, newest first, grouped by subject, each linking back to where it was written. */
export default async function LibraryNotesPage() {
  const viewer = await requireStudioReviewer("/hub/studio/library/notes");
  const groups = await libraryNotesList(viewer.userId);
  const total = groups.reduce((n, g) => n + g.notes.length, 0);
  const href = (g: (typeof groups)[number], targetType: string) =>
    g.silo.type === "glossary" ? `/hub/studio/library/glossary#${g.silo.subject}` : g.silo.type === "book" ? `/hub/studio/library/book/${g.silo.subject}` : targetType === "person" ? "/hub/studio/library/people" : `/hub/studio/library/${g.silo.type}/${encodeURIComponent(g.silo.subject)}`;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library" className="text-sm text-muted-foreground hover:text-primary">
        ← Library
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Library</p>
      <h1 className="mt-1 text-2xl font-semibold">Your notes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {total === 0 ? "You have not left any notes yet. Use ✎ on any page of the Library." : `${total} note${total === 1 ? "" : "s"}, newest first. To change one, open the page it is on.`}
      </p>
      {groups.map((g) => (
        <section key={`${g.silo.type}/${g.silo.subject}`} className="mt-6 rounded-2xl border border-border bg-card px-5 py-4">
          <h2 className="font-semibold">
            <Link href={href(g, g.notes[0].targetType)} className="hover:text-primary">
              {g.label} →
            </Link>
            <span className="ml-2 text-xs font-normal text-muted-foreground">{g.silo.type.replace(/_/g, " ")}</span>
          </h2>
          <ul className="mt-2 space-y-3">
            {g.notes.map((n) => (
              <li key={n.key} className="border-l-2 border-gold/60 pl-3 text-sm">
                <p className="whitespace-pre-line">{n.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.createdAt.slice(0, 10)} · {KIND[n.targetType] ?? n.targetType}
                  {n.versions > 1 ? ` · edited ${n.versions - 1}×` : ""} ·{" "}
                  <Link href={href(g, n.targetType)} className="text-primary">
                    open
                  </Link>
                </p>
                {n.context && <p className="mt-0.5 text-xs text-muted-foreground">About: {n.context}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
