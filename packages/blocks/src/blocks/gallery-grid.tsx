import { defineBlock, type PropsOf } from "../registry";
import { GalleryGridView, type GridItem } from "./gallery-grid.client";
import type { Nested } from "./gallery-grid.nested";

// ============================================================================
// Gallery grid — uniform square tiles, resizable in place.
//
// Lifted out of danamccool ("the way IFAC shows an artist's work"), which is
// still its origin story: uniform square tiles set close together; a title
// rises over a tile when it is pointed at (only where there is one); a click
// opens the full picture in a slideshow, with previous / next. Signed in as
// someone who owns the gallery, the SAME grid on the public page can be
// rearranged in place: drag a tile to move it, drag its bottom-right corner
// to make it bigger or smaller. The layout is saved to the gallery, so every
// visitor sees it.
//
// It is IFAC's own component (@elkdonis/cms-ui/gallery ProfileGallery), with
// three options that exist for this block: square tiles, titles on hover,
// and small thumbnails in the grid (the slideshow still opens the original).
//
// A picture can OPEN another of the person's galleries (set in their gallery
// manager): its slide then offers "Enter <gallery>", and the slideshow steps
// through that one, with a trail back up. See gallery-grid.nested.ts.
//
// ── What promoting this cost ────────────────────────────────────────────────
//
// One thing: the save path. danamccool's original called a server action
// straight out of the client component, which only works because that app's
// gallery, its site and its editor are all the same tenant. A block ANY org
// can place has no such guarantee — the gallery may belong to someone who
// administers nothing on the host's roster — so the client component here
// posts to a FIXED PATH instead, `PATCH /api/galleries/:id/items`, the same
// "every host implements one route" contract contact-form's /api/contact
// already uses. @elkdonis/services' `updateOwnGalleryItems` is the function
// that route calls: it checks the gallery's OWNER against the signed-in
// viewer before writing, which is deliberately narrower than danamccool's own
// "anyone who can edit this site" rule (gallery-actions.ts) — a shared route
// cannot assume the viewer and the gallery share an org's roster, so it falls
// back to the one relationship that is always true regardless of which org's
// page this is rendered on: whose gallery it is.
//
// `items`, `galleryId` and `editable` come from the resolver, never from an
// author: `editable` is only ever true on the published page for the
// gallery's own owner, never inside the page editor (Puck's own drag would
// fight it).
// ============================================================================

const props = [
  {
    name: "gallery",
    kind: "string",
    binds: "gallery",
    label: "Gallery",
    description: "Leave empty to use the gallery linked to this page.",
    default: "",
  },
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
      { value: "6", label: "Small" },
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
  const showHeading = typeof heading === "string" ? heading.trim() !== "" : heading != null;
  return (
    <section className="blk blk-gallery-grid">
      {showHeading ? <h2 className="blk blk-heading-title">{heading as never}</h2> : null}
      <GalleryGridView
        items={items}
        galleryId={galleryId}
        editable={editable}
        perRow={Number(perRow) || 4}
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
    id: "gallery-grid",
    label: "Gallery grid (square tiles)",
    category: "listings",
    description:
      "A gallery as square tiles close together, titles on hover, a slideshow on click — rearrange and resize in place, signed in as the gallery's owner.",
    memberSafe: true,
    styling: "tokens",
    interactive: true,
    dataDriven: true,
    props,
  },
  GalleryGrid,
  () => ({ gallery: "", heading: "", perRow: "4" as const, gap: "6" as const, captions: "hover" as const, items: [], galleryId: null, editable: false })
);
