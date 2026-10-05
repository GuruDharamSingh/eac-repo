import Link from "next/link";
import type { Metadata } from "next";
import { libraryBooks, libraryReady } from "@elkdonis/astro-corpus/server";
import { LibraryBooks } from "@/components/studio/library-books";
import { requireStudioReviewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Books · Library · Studio" };
export const dynamic = "force-dynamic";

/** The books: the ones with an outline first (with how many passages of each kind of reading they hold), then the rest. */
export default async function LibraryBooksPage() {
  await requireStudioReviewer("/hub/studio/library/books");
  const { outlined, withoutOutline } = (await libraryReady()) ? await libraryBooks() : { outlined: [], withoutOutline: [] };
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library" className="text-sm text-muted-foreground hover:text-primary">
        ← Library
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Library</p>
      <h1 className="mt-1 text-2xl font-semibold">Books</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {outlined.length} book{outlined.length === 1 ? " has" : "s have"} an outline: every passage in them is marked with its section and its kind of reading. Each card says what the book is and which basics it has; the highest-priority books come first. {withoutOutline.length} more
        {withoutOutline.length === 1 ? " book has" : " books have"} been read but have no outline yet.
      </p>
      <LibraryBooks books={outlined} />
      {withoutOutline.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">No outline yet · {withoutOutline.length}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Passages from these show as “kind not known yet”.</p>
          <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border text-sm">
            {withoutOutline.map((b) => (
              <li key={b.title} className="flex justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0 truncate">{b.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{b.passages.toLocaleString()} passages</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
