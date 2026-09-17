import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSections, readCurrentBook, readSuggestedBooks } from "@/lib/data";
import { BookLeaf } from "@/components/home/book-leaf";
import { BookCoverFallback } from "@/components/home/book-cover-fallback";
import { SuggestedBooks } from "@/components/home/bands";

export const metadata: Metadata = { title: "Books" };

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const sections = await getSiteSections();
  const book = readCurrentBook(sections);
  const suggested = readSuggestedBooks(sections);
  // The header's "turn to a page" box lands here.
  const wanted = page && /^\d+$/.test(page) ? Number(page) : null;
  const found = wanted != null && book?.pages.some((p) => p.number === wanted);

  return (
    <div className="column band">
      <p className="eyebrow">The books</p>
      <h1 style={{ fontSize: "1.8rem", marginTop: 4 }}>{book?.title ?? "What we're reading"}</h1>

      {book ? (
        <>
          <div className="bookslide" style={{ padding: "22px 0", height: "auto" }}>
            <div className="bookslide__cover" style={{ maxWidth: 170 }}>
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverUrl} alt={`Cover of ${book.title}`} />
              ) : (
                <BookCoverFallback title={book.title} author={book.author} />
              )}
            </div>
            <div className="bookslide__body">
              {book.author && <p className="bookslide__author">{book.author}</p>}
              {book.blurb && <p style={{ marginTop: 12 }}>{book.blurb}</p>}
              {book.review && (
                <blockquote className="bookslide__review">
                  {book.review}
                  {book.reviewSource && <cite>{book.reviewSource}</cite>}
                </blockquote>
              )}
              <div className="bookslide__meta">
                {book.currentPage && <span>The circle is on page {book.currentPage}{book.totalPages ? ` of ${book.totalPages}` : ""}</span>}
                {book.edition && <span>{book.edition}</span>}
              </div>
            </div>
          </div>

          <section className="band" id="read">
            <div className="band__head">
              <h2 className="band__title">Read along</h2>
              {wanted != null && !found && (
                <span className="eyebrow">page {wanted} hasn&rsquo;t been transcribed — opening the first we have</span>
              )}
            </div>
            <div className="hero" style={{ marginTop: 0 }}>
              <div style={{ height: "min(70vh, 640px)" }}>
                <BookLeaf title={book.title} pages={book.pages} initialPage={found ? wanted : book.currentPage} />
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}>
          The current book hasn&rsquo;t been entered yet. An editor can add it from{" "}
          <Link href="/manage/book">Manage → The book</Link>.
        </div>
      )}

      <section className="band">
        <SuggestedBooks books={suggested} />
      </section>
    </div>
  );
}
