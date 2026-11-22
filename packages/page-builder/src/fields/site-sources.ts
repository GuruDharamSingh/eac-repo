// ============================================================================
// SiteSources: the lists a site's editors choose from.
//
// One object per app, read by BOTH editors: Puck's custom fields (record-
// fields.tsx here) and the house editor's "From what?" (record-sources.ts).
// The app builds it from its own server actions or endpoints; this package
// never imports app code and never calls a server action itself.
//
// Every loader is optional: a site without galleries omits `galleries` and
// the fields for it show an empty list. Shapes are structural minimums; an
// app's richer rows are accepted as they are.
// ============================================================================

export type PickerArtworkStatus = "available" | "reserved" | "sold" | "portfolio";

export interface PickerArtwork {
  id: string;
  title: string;
  year: number | null;
  medium: string | null;
  image: string | null;
  status: PickerArtworkStatus;
}

export interface PickerGallery {
  id: string;
  title: string;
  itemCount: number;
  pagePath: string | null;
}

export interface PickerPage {
  slug: string;
  title: string;
  href: string;
}

export interface SiteSources {
  /** The pieces a block can bind (`binds: "artwork"`). */
  artworks?: () => Promise<PickerArtwork[]>;
  /** Galleries (`binds: "gallery" | "opens-gallery" | "gallery-pictures"`). */
  galleries?: () => Promise<PickerGallery[]>;
  /** Pages (`binds: "page-link"`). */
  pages?: () => Promise<PickerPage[]>;
}

/**
 * Words shown by the pickers. Defaults are neutral; a site that speaks in the
 * owner's voice ("her pieces") passes its own. Every key is optional.
 */
export interface PickerCopy {
  artworkLabel?: string;
  artworkMissing?: string;
  artworkChoose?: string;
  artworkSearch?: string;
  galleryLabel?: string;
  galleryEmpty?: string;
  opensGalleryEmpty?: string;
  pageLinkLabel?: string;
  pageLinkLoading?: string;
  recordLabel?: string;
  recordNone?: string;
  recordArtwork?: string;
  recordGallery?: string;
  recordGalleryEmpty?: string;
  recordHint?: string;
}

/**
 * GET `{ items: [...] }` from an endpoint, as a `SiteSources` loader. A
 * non-OK reply is an empty list; a network failure rejects (the artwork
 * picker then retries on the next open).
 */
export function itemsFromEndpoint<T>(url: string, key = "items"): () => Promise<T[]> {
  return async () => {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    return (body[key] as T[] | undefined) ?? [];
  };
}
