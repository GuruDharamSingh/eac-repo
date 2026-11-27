"use client";

import * as React from "react";
import type { ContentListItem } from "../../model";
import { contentQueryParams } from "../../query-string";
import type { ContentQuery, ContentSearchResult } from "../../search-types";

/** Where a remote library gets its pages: the route of CONTRACT §5, or a function the host owns. */
export type RemoteSource = { search(q: ContentQuery): Promise<ContentSearchResult> } | { endpoint: string };

export type RemoteItem = ContentSearchResult["items"][number];
export type RemoteFacets = ContentSearchResult["facets"];

export const NO_FACETS: RemoteFacets = { types: {}, statuses: {}, stores: [], sale: {} };

export interface RemoteState {
  items: RemoteItem[];
  facets: RemoteFacets;
  /** Sources not read or failed. Shown, never dropped. */
  missing: string[];
  nextCursor: string | null;
  /** The first page of a query is on its way. */
  loading: boolean;
  /** A "Show more" page is on its way. */
  loadingMore: boolean;
  error: string | null;
  /** The query the items answer (after the debounce). */
  settled: boolean;
  more: () => void;
  reload: () => void;
}

async function runSearch(source: RemoteSource, query: ContentQuery, signal: AbortSignal): Promise<ContentSearchResult> {
  if ("search" in source) return source.search(query);
  const qs = contentQueryParams(query).toString();
  const res = await fetch(`${source.endpoint}${source.endpoint.includes("?") ? "&" : "?"}${qs}`, { signal });
  const body = (await res.json().catch(() => ({}))) as Partial<ContentSearchResult> & { error?: string };
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : res.status === 403 || res.status === 401 ? "You can't see this." : "Could not load the library.");
  return {
    items: Array.isArray(body.items) ? body.items : [],
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    facets: { ...NO_FACETS, ...(body.facets ?? {}) },
    missing: Array.isArray(body.missing) ? body.missing : [],
  };
}

/**
 * The remote library's data: a debounced `q`, a cursor "Show more", the facets, errors and `missing`.
 * A new query aborts the one in flight (an endpoint source gets an AbortSignal; a `search()` function's
 * stale answer is ignored). `enabled: false` idles it (the files view with folders reads its own listing).
 */
export function useRemoteSearch(source: RemoteSource | undefined, query: ContentQuery, opts: { enabled?: boolean; debounceMs?: number } = {}): RemoteState {
  const { enabled = true, debounceMs = 300 } = opts;
  const [debouncedQ, setDebouncedQ] = React.useState(query.q ?? "");
  const first = React.useRef(true);
  const [state, setState] = React.useState<Omit<RemoteState, "more" | "reload">>({ items: [], facets: NO_FACETS, missing: [], nextCursor: null, loading: true, loadingMore: false, error: null, settled: false });
  const [reloadN, setReloadN] = React.useState(0);
  const seq = React.useRef(0);
  const abort = React.useRef<AbortController | null>(null);
  const cursorRef = React.useRef<string | null>(null);
  const queryRef = React.useRef(query);
  queryRef.current = query;
  // An inline `{ endpoint }` or `{ search }` object is new on every render of the host: the effect keys on the
  // endpoint string (or "fn") and reads the latest source from a ref. Change `key` on the library to switch functions.
  const sourceRef = React.useRef(source);
  sourceRef.current = source;
  const sourceKey = !source ? "" : "endpoint" in source ? source.endpoint : "fn";

  // Only `q` waits for the typing to pause; a chip or a toggle searches at once.
  React.useEffect(() => {
    const q = query.q ?? "";
    if (first.current || q === "") {
      first.current = false;
      setDebouncedQ(q);
      return;
    }
    const t = window.setTimeout(() => setDebouncedQ(q), debounceMs);
    return () => window.clearTimeout(t);
  }, [query.q, debounceMs]);

  const key = JSON.stringify({ ...query, q: debouncedQ, cursor: null });

  React.useEffect(() => {
    const src = sourceRef.current;
    if (!src || !enabled) return;
    const mine = ++seq.current;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState((s) => ({ ...s, loading: true, loadingMore: false, error: null, settled: false }));
    runSearch(src, { ...queryRef.current, q: debouncedQ || undefined, cursor: null }, ctl.signal)
      .then((r) => {
        if (mine !== seq.current) return;
        cursorRef.current = r.nextCursor;
        setState({ items: r.items, facets: r.facets, missing: r.missing, nextCursor: r.nextCursor, loading: false, loadingMore: false, error: null, settled: true });
      })
      .catch((err: unknown) => {
        if (mine !== seq.current || (err as Error)?.name === "AbortError") return;
        setState((s) => ({ ...s, items: [], nextCursor: null, loading: false, loadingMore: false, error: (err as Error)?.message || "Could not load the library.", settled: true }));
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, enabled, key, reloadN]);

  const more = React.useCallback(() => {
    const cursor = cursorRef.current;
    const src = sourceRef.current;
    if (!src || !cursor) return;
    const mine = seq.current;
    const ctl = new AbortController();
    abort.current = ctl;
    setState((s) => ({ ...s, loadingMore: true }));
    runSearch(src, { ...queryRef.current, q: debouncedQ || undefined, cursor }, ctl.signal)
      .then((r) => {
        if (mine !== seq.current) return;
        cursorRef.current = r.nextCursor;
        setState((s) => {
          const seen = new Set(s.items.map((i) => i.key));
          return { ...s, items: [...s.items, ...r.items.filter((i) => !seen.has(i.key))], nextCursor: r.nextCursor, missing: [...new Set([...s.missing, ...r.missing])], loadingMore: false };
        });
      })
      .catch((err: unknown) => {
        if (mine !== seq.current || (err as Error)?.name === "AbortError") return;
        setState((s) => ({ ...s, loadingMore: false, error: (err as Error)?.message || "Could not load more." }));
      });
  }, [debouncedQ]);

  const reload = React.useCallback(() => setReloadN((n) => n + 1), []);
  return { ...state, more, reload };
}

/** Keep the type used by hosts that narrow a result's items. */
export type { ContentListItem };
