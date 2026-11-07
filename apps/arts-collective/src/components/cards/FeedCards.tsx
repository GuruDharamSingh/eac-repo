import "@/components/classifieds/classifieds.css";
import type { Item } from "@elkdonis/direct-edit/block";
import { declsToStyle, planAd, sheetDecls } from "@/lib/classifieds/catalog";
import { cardsToSheet, safeHref, type CardsDoc } from "@/lib/cards/catalog";
import { BlockKids } from "@/components/classifieds/BlockView";

/**
 * An org's feed drawn with its card design: the same design for every item,
 * its {{tokens}} filled from each item (lib/cards/catalog.ts feedItem). Each
 * card is one link to its post when the design says so. Server-rendered: the
 * render plan (lib/classifieds/catalog.ts planAd) and BlockView build every
 * element; item values are text, never markup.
 */
export function FeedCards({ doc, items, heading = true }: { doc: CardsDoc; items: Item[]; heading?: boolean }) {
  const sheet = cardsToSheet(doc);
  const ad = sheet.ads[0]!;
  const shown = items.slice(0, Math.max(1, Math.min(24, doc.limit ?? 6)));
  return (
    <div className="cl-sheet cl-list" style={declsToStyle(sheetDecls(sheet))} data-cards="feed">
      {heading && doc.title ? <h2 className="cl-listhead">{doc.title}</h2> : null}
      {shown.map((item, i) => {
        const plan = planAd(sheet, ad, { item });
        const style = declsToStyle(plan.decls);
        const href = doc.card.link.kind === "item" ? safeHref(item.href) : null;
        const key = `${i}-${item.href ?? ""}`;
        return href ? (
          <a key={key} className={plan.cls} style={style} href={href} aria-label={item.title ?? undefined}>
            <BlockKids plan={plan} links={false} />
          </a>
        ) : (
          <article key={key} className={plan.cls} style={style}>
            <BlockKids plan={plan} links />
          </article>
        );
      })}
    </div>
  );
}
