// ============================================================================
// The house editor's "From what?" fed by the same SiteSources the Puck fields
// read, so a site lists its pieces, galleries and pages once.
//
// Typed STRUCTURALLY against @elkdonis/direct-edit's RecordSources (canvas/
// records.ts): page-builder does not depend on direct-edit, and the host
// passes the result to direct-edit's `records` option, so any drift is a type
// error there. It lives in page-builder rather than direct-edit because it
// depends on SiteSources, which lives here.
//
//     import { recordSourcesFrom } from "@elkdonis/page-builder";
//     const records = recordSourcesFrom(danaSources); // -> RecordSources
// ============================================================================

import type { PickerArtwork, PickerGallery, PickerPage, SiteSources } from "./site-sources";

export interface RecordSourceItemLike { ref: string; label: string; hint?: string }
export interface RecordChoiceLike { value: string; label: string; hint?: string; follows?: boolean; disabled?: boolean }
export interface RecordSourcesLike {
  handles(binds: string): boolean;
  sources(binds: string): Promise<RecordSourceItemLike[]>;
  choices(binds: string, source: string): Promise<RecordChoiceLike[]>;
  resolve(binds: string, value: string): Promise<Record<string, unknown> | null>;
  describe(binds: string, value: string, drawn: Record<string, unknown> | null | undefined): string;
  title?(binds: string): string;
  clearLabel?(binds: string): string;
}

type Row = PickerArtwork | PickerGallery | PickerPage;

const KINDS = ["artwork", "gallery", "opens-gallery", "gallery-pictures", "page-link"];

const STATUS: Record<PickerArtwork["status"], string> = {
  available: "For sale",
  reserved: "Reserved",
  sold: "Sold",
  portfolio: "Not for sale",
};

export interface RecordSourcesOptions {
  /** What a value draws, by prop name. Default: `{ item }`, the matching list row. */
  resolve?: (binds: string, value: string, item: Row) => Record<string, unknown> | null;
}

export function recordSourcesFrom(sources: SiteSources, opts: RecordSourcesOptions = {}): RecordSourcesLike {
  const lists = (binds: string): Promise<Row[]> =>
    binds === "artwork"
      ? (sources.artworks?.() ?? Promise.resolve([]))
      : binds === "page-link"
        ? (sources.pages?.() ?? Promise.resolve([]))
        : (sources.galleries?.() ?? Promise.resolve([]));
  const idOf = (binds: string, it: Row) => (binds === "page-link" ? (it as PickerPage).href : (it as PickerArtwork).id);

  return {
    handles: (binds) => KINDS.includes(binds) && (binds === "artwork" ? !!sources.artworks : binds === "page-link" ? !!sources.pages : !!sources.galleries),
    // One source per kind: the list itself. A host with more places to choose
    // from wraps this and adds its own.
    async sources(binds) {
      return [{ ref: "all", label: binds === "artwork" ? "Artworks" : binds === "page-link" ? "Pages" : "Galleries" }];
    },
    async choices(binds) {
      const all = await lists(binds);
      return all.map((it) => {
        if (binds === "artwork") {
          const a = it as PickerArtwork;
          return { value: a.id, label: `${a.title}${a.year ? `, ${a.year}` : ""}`, hint: STATUS[a.status] };
        }
        if (binds === "page-link") {
          const p = it as PickerPage;
          return { value: p.href, label: p.title, hint: p.href };
        }
        const g = it as PickerGallery;
        return { value: g.id, label: g.title, hint: `${g.itemCount}${g.pagePath ? ` · /${g.pagePath}` : ""}` };
      });
    },
    async resolve(binds, value) {
      if (!value) return null;
      const item = (await lists(binds)).find((it) => idOf(binds, it) === value);
      if (!item) return null;
      return opts.resolve ? opts.resolve(binds, value, item) : { item };
    },
    describe(binds, value, drawn) {
      const item = drawn?.item as { title?: string } | undefined;
      if (!item) return binds === "page-link" ? value : "Not shown: this record is gone or not public.";
      return item.title ?? value;
    },
    title: (binds) => (binds === "artwork" ? "Choose an artwork" : binds === "page-link" ? "Choose a page" : "Choose a gallery"),
    clearLabel: (binds) => (binds === "page-link" ? "Not a link (clear the choice)" : "Clear the choice"),
  };
}
