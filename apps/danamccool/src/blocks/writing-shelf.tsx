import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { WritingShelf, type ShelfItem } from "@elkdonis/cms-ui/writing";

// ============================================================================
// Her writing, on any page — the blog's own shelf, as a block.
//
// The same component /blog uses, so a page's "latest writing" and the blog
// itself are one publication. Published pieces only: drafts belong on /blog,
// where she is signed in to see them. Pieces open at /blog/<slug>, where she
// writes and edits them in place — nothing here needs the page editor.
//
// `items` comes from a resolver (lib/puck/config.*), never from the author.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Writing", inlineEditable: true },
  { name: "kicker", kind: "string", label: "Small line above", default: "", inlineEditable: true },
  { name: "limit", kind: "number", label: "How many pieces", default: 5, min: 1, max: 20, step: 1 },
] as const;

export type WritingShelfBlockProps = PropsOf<typeof props> & { items?: ShelfItem[] };

export function WritingShelfBlock({ heading, kicker, limit = 5, items = [] }: WritingShelfBlockProps) {
  return (
    <div className="dm-blog" style={{ margin: "2.5rem 0" }}>
      <WritingShelf
        items={items.slice(0, Math.max(1, limit))}
        basePath="/blog"
        heading={typeof heading === "string" ? heading : "Writing"}
        kicker={typeof kicker === "string" && kicker ? kicker : undefined}
        emptyNote="Nothing published yet."
      />
      <p className="dm-blog-edit">
        <a href="/blog">All writing →</a>
      </p>
    </div>
  );
}

export const writingShelf = defineBlock(
  {
    id: "dm-writing-shelf",
    label: "Writing (her blog)",
    category: "listings",
    description: "Her latest published pieces from /blog, each opening on its own page.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    props,
  },
  WritingShelfBlock,
  () => ({ heading: "Writing", kicker: "", limit: 5, items: [] })
);
