// ============================================================================
// A `piece` record source: the content library's one search as a picker
// (CONTENT_CORNERSTONE Step 6, HOUSE_EDITOR_ONE row H; 2026-11-26).
//
// Typed STRUCTURALLY against @elkdonis/direct-edit's RecordSources, like
// record-sources.ts: page-builder depends on neither direct-edit nor
// @elkdonis/content. It only calls the host's own `/api/content/search`
// (`contentRoutes(host).search`), so rights are decided on the server for the
// signed-in person: the picker never sees a piece its viewer may not read.
//
// It handles ONE new kind, `binds: "piece"`, and nothing else; existing
// fields and `recordSourcesFrom` are untouched. A value is a content key
// (`thread:<id>` / `artwork:<id>`), the same string `resolveContentRefs`
// takes, so a block stores a key and resolves it when it renders.
//
//     import { contentRecordSource, withContentSource, recordSourcesFrom } from "@elkdonis/page-builder";
//     const records = withContentSource(
//       recordSourcesFrom(sources),
//       contentRecordSource({ endpoint: "/api/content/search" }),
//     );
// ============================================================================

import type { RecordChoiceLike, RecordSourceItemLike, RecordSourcesLike } from "./record-sources";

/** The `binds` kind this source handles. */
export const PIECE_BINDS = "piece";

/** The part of a search item the picker reads (a `ContentListItem` is assignable). */
interface PieceRow {
  key: string;
  type?: string;
  title?: string;
  status?: string;
  siteName?: string;
  excerpt?: string;
  cover?: string | null;
}

export interface ContentRecordSourceOptions {
  /** The host's search route, e.g. `/api/content/search`. */
  endpoint: string;
  /**
   * Optional: a route that answers `GET ?keys=a,b` with `{ results: [row | { key, gone: true }] }`
   * (`resolveContentRefs`). Without it a value resolves from the pieces already listed, else falls back to its key.
   */
  resolveEndpoint?: string;
  /** Organisations the person can choose from besides their own work. Default none. */
  orgs?: ReadonlyArray<{ id: string; name: string }>;
  /** Offer "Whole network". Default true. */
  network?: boolean;
  /** Restrict to these content types (`types=`). Default: every type. */
  types?: readonly string[];
  /** Rows per list. Default 60, at most 100. */
  limit?: number;
  /** For tests and non-browser hosts. Default: the global `fetch` with same-origin credentials. */
  fetch?: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
}

const TYPE_WORD: Record<string, string> = { artwork: "Artwork", writing: "Writing", event: "Event", meeting: "Meeting", product: "Product", video: "Video", series: "Series" };

export function contentRecordSource(opts: ContentRecordSourceOptions): RecordSourcesLike {
  const limit = Math.max(1, Math.min(100, Math.floor(opts.limit ?? 60)));
  const doFetch = opts.fetch ?? ((url: string) => fetch(url, { credentials: "same-origin" }));
  // Pieces seen in lists, so describe/resolve need no second request for a value the person just chose.
  const seen = new Map<string, PieceRow>();

  const sourceItems: RecordSourceItemLike[] = [
    { ref: "mine", label: "Your work", hint: "Everything you made or are credited on" },
    ...(opts.orgs ?? []).map((o) => ({ ref: `org:${o.id}`, label: o.name, hint: "An organisation you run" })),
    ...(opts.network === false ? [] : [{ ref: "network", label: "Whole network", hint: "Public, published pieces" }]),
  ];

  const hintOf = (r: PieceRow) => [r.type ? TYPE_WORD[r.type] ?? r.type : null, r.siteName ?? null, r.status && r.status !== "published" ? r.status : null].filter(Boolean).join(" · ");

  async function get(params: URLSearchParams): Promise<unknown> {
    const res = await doFetch(`${opts.endpoint}${opts.endpoint.includes("?") ? "&" : "?"}${params}`);
    return res.ok ? res.json() : null;
  }

  return {
    handles: (binds) => binds === PIECE_BINDS,
    async sources() {
      return sourceItems;
    },
    async choices(_binds, source): Promise<RecordChoiceLike[]> {
      // Only a source this list offered: the picker never builds a scope string from anything else.
      if (!sourceItems.some((s) => s.ref === source)) return [];
      const p = new URLSearchParams({ scope: source, view: "published", limit: String(limit) });
      if (opts.types?.length) p.set("types", opts.types.join(","));
      const body = (await get(p)) as { items?: PieceRow[] } | null;
      const rows = Array.isArray(body?.items) ? body!.items! : [];
      return rows.filter((r) => typeof r?.key === "string").map((r) => {
        seen.set(r.key, r);
        return { value: r.key, label: r.title || r.key, hint: hintOf(r) };
      });
    },
    async resolve(_binds, value) {
      if (!value) return null;
      const known = seen.get(value);
      if (known) return { item: known };
      if (opts.resolveEndpoint) {
        const res = await doFetch(`${opts.resolveEndpoint}${opts.resolveEndpoint.includes("?") ? "&" : "?"}keys=${encodeURIComponent(value)}`);
        const body = res.ok ? ((await res.json()) as { results?: Array<PieceRow | { key: string; gone?: true }> }) : null;
        const hit = body?.results?.find((r) => r.key === value);
        if (hit && !("gone" in hit && hit.gone)) {
          seen.set(value, hit as PieceRow);
          return { item: hit };
        }
        if (hit) return null;
      }
      // No route, or it could not be reached: the key stands for itself.
      return { item: { key: value, title: value } };
    },
    describe(_binds, value, drawn) {
      const item = drawn?.item as { title?: string } | undefined;
      return item?.title || value;
    },
    title: () => "Choose a piece",
    clearLabel: () => "Clear the choice",
  };
}

/**
 * `base` with the `piece` kind added: `piece` goes to `content`, every other kind to `base`, so a host keeps its
 * existing record sources unchanged. With no `base`, only `piece` is handled.
 */
export function withContentSource(base: RecordSourcesLike | null | undefined, content: RecordSourcesLike): RecordSourcesLike {
  const pick = (binds: string) => (content.handles(binds) ? content : base ?? content);
  return {
    handles: (binds) => content.handles(binds) || !!base?.handles(binds),
    sources: (binds) => pick(binds).sources(binds),
    choices: (binds, source) => pick(binds).choices(binds, source),
    resolve: (binds, value) => pick(binds).resolve(binds, value),
    describe: (binds, value, drawn) => pick(binds).describe(binds, value, drawn),
    title: (binds) => pick(binds).title?.(binds) ?? "Choose",
    clearLabel: (binds) => pick(binds).clearLabel?.(binds) ?? "Clear the choice",
  };
}
