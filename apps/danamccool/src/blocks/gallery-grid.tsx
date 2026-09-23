import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { galleryProp } from "./artwork-data";
import { GalleryGridView, type GridItem } from "./gallery-grid.client";
import type { Nested } from "./nested";

// ============================================================================
// Gallery grid — a gallery shown the way IFAC shows an artist's work.
//
// Uniform square tiles set close together; a title rises over a tile when it
// is pointed at (only where there is one); a click opens the full picture in
// a slideshow, with previous / next. Signed in as someone who can edit the
// site, the SAME grid on the public page can be rearranged in place: drag a
// tile to move it, drag its bottom-right corner to make it bigger or smaller.
// The layout is saved to the gallery, so every visitor sees it.
//
// It is IFAC's own component (@elkdonis/cms-ui/gallery ProfileGallery), with
// three options that exist for this block: square tiles, titles on hover,
// and small thumbnails in the grid (the slideshow still opens the original).
//
// A picture can OPEN another of her galleries (set in the Pictures panel):
// its slide then offers "Enter <gallery>", and the slideshow steps through
// that one, with a trail back up. See nested.ts.
//
// The pictures are the gallery's (managed in the Galleries panel); an item
// that is one of her artworks shows the artwork's current title. The block
// is interactive — its declaration is here, its component in the .client file
// — because a server file that says "use client" breaks the catalogue.
//
// `items`, `galleryId` and `editable` come from the resolver, never from an
// author: `editable` is only ever true on the published page for a signed-in
// editor, never inside the page editor (Puck's own drag would fight it).
// ============================================================================

const props = [
  galleryProp("Gallery"),
  {
    // Not a value the page stores: the editor shows this gallery's pictures
    // here to caption, and writes the words straight to the gallery.
    name: "pictures",
    kind: "string",
    binds: "gallery-pictures",
    label: "Pictures",
    description: "Titles and subtitles, saved to the gallery as you type.",
    default: "",
  },
  { name: "heading", kind: "string", label: "Heading", default: "", inlineEditable: true },
  {
    name: "perRow",
    kind: "select",
    label: "Tiles across (to start)",
    description: "Where a picture has not been sized by hand yet. Resizing one by its corner overrides this.",
    default: "4",
    options: [
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "6", label: "6" },
    ],
  },
  {
    name: "gap",
    kind: "select",
    label: "Space between pictures",
    default: "6",
    options: [
      { value: "0", label: "None — edge to edge" },
      { value: "2", label: "Hairline" },
      { value: "6", label: "Small (as it is now)" },
      { value: "12", label: "A little bigger" },
      { value: "20", label: "Roomy" },
      { value: "32", label: "Airy" },
    ],
  },
  {
    name: "captions",
    kind: "select",
    label: "Titles",
    default: "hover",
    options: [
      { value: "hover", label: "Over the picture, on hover" },
      { value: "never", label: "Never" },
    ],
  },
] as const;

export type GalleryGridProps = PropsOf<typeof props> & {
  items?: GridItem[];
  galleryId?: string | null;
  editable?: boolean;
  /** The gallery's own title, and the galleries its pictures open — from the resolver. */
  galleryTitle?: string;
  nested?: Nested;
};

export function GalleryGrid({
  heading,
  perRow = "4",
  gap = "6",
  captions = "hover",
  items = [],
  galleryId = null,
  editable = false,
  galleryTitle = "",
  nested = {},
}: GalleryGridProps) {
  // In the editor an inline-editable prop arrives as an editing element, not
  // a string — draw it whenever it is anything but empty text.
  const showHeading = typeof heading === "string" ? heading.trim() !== "" : heading != null;
  return (
    <section className="dm-grid">
      {showHeading ? <h1 className="page-title dm-grid-title">{heading as never}</h1> : null}
      <GalleryGridView
        items={items}
        galleryId={galleryId}
        editable={editable}
        perRow={Number(perRow) || 4}
        // Older pages stored a number; both mean pixels.
        gap={Number.isFinite(Number(gap)) ? Number(gap) : 6}
        captions={captions === "never" ? "never" : "hover"}
        title={(typeof heading === "string" && heading.trim()) || galleryTitle || "Gallery"}
        nested={nested}
      />
    </section>
  );
}

export const galleryGrid = defineBlock(
  {
    id: "dm-gallery-grid",
    label: "Gallery grid (square tiles)",
    category: "listings",
    description:
      "A gallery as IFAC shows an artist's work: square tiles close together, titles on hover, a slideshow on click — rearrange and resize in place when signed in.",
    memberSafe: true,
    styling: "tokens",
    interactive: true,
    dataDriven: true,
    props,
  },
  GalleryGrid,
  () => ({ gallery: "", heading: "", perRow: "4" as const, gap: "6" as const, captions: "hover" as const, items: [], galleryId: null, editable: false })
);
