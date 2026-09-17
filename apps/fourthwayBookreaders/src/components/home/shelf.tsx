import type { ShelfItem } from "@/lib/types";
import { BookCoverFallback } from "./book-cover-fallback";

/**
 * The full-width shelf. Items drift sideways and bob in place; see the notes
 * in site.css on why the list is rendered twice. Server component — the
 * motion is entirely CSS.
 */
export function Shelf({ items }: { items: ShelfItem[] }) {
  if (items.length === 0) return null;
  // Enough copies to fill a wide window even with only a few items. Duplicating
  // to exactly two copies is the seamless-loop requirement; more pairs are fine.
  const pairs = Math.max(1, Math.ceil(8 / items.length));
  const rail: ShelfItem[] = [];
  for (let i = 0; i < pairs * 2; i++) rail.push(...items);
  const half = rail.length / 2;

  return (
    <section className="shelf full-bleed" aria-label="On the shelf">
      <div className="shelf__head">
        <p className="eyebrow">On the shelf</p>
        <h2>Art from the network, books to come</h2>
      </div>
      <div className="shelf__window">
        <div className="shelf__rail">
          {rail.map((item, i) => {
            const delay = `${((i % 7) * 0.45).toFixed(2)}s`;
            const inner = (
              <>
                <span className="shelf__float">
                  <span className="shelf__shadow" style={{ animationDelay: delay }} aria-hidden />
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="shelf__thumb"
                      // The 3MB master is not what a 108px thumbnail needs.
                      src={item.imageUrl.startsWith("/api/media/") ? `${item.imageUrl}?w=320` : item.imageUrl}
                      alt={i < half ? item.title : ""}
                      loading="lazy"
                      style={{ animationDelay: delay }}
                    />
                  ) : (
                    <span className="shelf__thumb" style={{ animationDelay: delay }}>
                      <BookCoverFallback title={item.title} author={item.author} />
                    </span>
                  )}
                </span>
                <span className="shelf__caption">{item.title}</span>
                <span className="shelf__kind">
                  {item.subtitle ?? (item.kind === "book" ? "book" : item.kind === "product" ? "for sale" : "artwork")}
                </span>
              </>
            );
            const key = `${item.id}#${i}`;
            // The second copy is presentational — hidden from AT so nothing is
            // announced twice.
            const hidden = i >= half ? { "aria-hidden": true as const, tabIndex: -1 } : {};
            return item.href ? (
              <a key={key} className="shelf__item" href={item.href} {...hidden}>{inner}</a>
            ) : (
              <div key={key} className="shelf__item" {...hidden}>{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
