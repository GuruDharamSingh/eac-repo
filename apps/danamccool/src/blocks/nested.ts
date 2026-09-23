// Client-safe: nested galleries as a block receives them, shared by the
// editor's resolvers (browser), the published page's (server) and the blocks.
//
// A picture — a gallery item, or an Image set row — can OPEN another of her
// galleries: in the full-size view the visitor can go into that gallery
// instead of stepping on through the one they are in. The link is only the
// other gallery's id (PortfolioItem.opens / the row's `opens`), so galleries
// nest to any depth without a tree of their own. The resolver loads every
// gallery reachable from a block, a level at a time, down to NEST_DEPTH, and
// the viewers refuse to enter a gallery already on the visitor's trail — so a
// loop (A opens B, B opens A) is a dead end, never an endless page.

export interface NestedPicture {
  id: string;
  url: string;
  title: string;
  /** Everything under the picture in the viewer: title — subtitle — year · medium. */
  caption: string;
  /** Its marketplace page, while it is for sale. */
  href?: string | null;
  /** The gallery this picture opens in turn. */
  opens?: string;
}

export interface NestedGallery {
  id: string;
  title: string;
  items: NestedPicture[];
}

/** Every gallery a block can reach, by id. */
export type Nested = Record<string, NestedGallery>;

/** How many galleries deep a visitor can go from a block. */
export const NEST_DEPTH = 4;

/** A gallery's id (a nanoid). */
const GALLERY_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A usable gallery id, or undefined. */
export function galleryIdOf(value: unknown): string | undefined {
  return typeof value === "string" && GALLERY_ID.test(value) ? value : undefined;
}

/** The galleries an Image set's rows open. */
export function opensIds(props: Record<string, unknown>): string[] {
  const rows = props.pictures;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => galleryIdOf((r as { opens?: unknown } | null)?.opens)).filter((x): x is string => !!x);
}
