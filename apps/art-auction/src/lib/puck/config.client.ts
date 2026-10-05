"use client";

import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { CATALOGUE } from "./catalogue";
import { SAMPLE_BIDS, SAMPLE_LOTS, SAMPLE_NOW, SAMPLE_STATS } from "@/blocks/auction-types";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// Resolvers run in the browser, inside Puck's iframe, where there is no
// database, so they ask the site's public routes (/api/auction/live, /articles,
// /discussion). When a site has nothing to show yet (no lots, no topics) the
// editor gets example data, so a template opened before the auction exists
// still looks like the page it will become. The example lots carry the marker
// `now` (SAMPLE_NOW), which tells the blocks not to poll over them. Editor
// only: a published page never calls these.
// ============================================================================

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    // An editor that cannot reach the data shows examples. Throwing would leave
    // the block stuck in Puck's loading state with no way out.
    return fallback;
  }
}

const live = (parts: string, props: Record<string, unknown>, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams({ parts, ...extra });
  if (typeof props.event === "string" && props.event) q.set("event", props.event);
  if (typeof props.scope === "string") q.set("scope", props.scope);
  if (typeof props.limit === "number") q.set("limit", String(props.limit));
  return `/api/auction/live?${q}`;
};

type Live = { now?: string; lots?: unknown[]; bids?: unknown[]; stats?: { lotsOpen: number } };

const withLots =
  (limit?: number) =>
  async (props: Record<string, unknown>) => {
    const body = await getJson<Live>(live("lots", limit ? { ...props, limit } : props), {});
    return body.lots && body.lots.length > 0 ? { now: body.now, lots: body.lots } : { now: SAMPLE_NOW, lots: SAMPLE_LOTS };
  };

const withStats = async (props: Record<string, unknown>) => {
  const body = await getJson<Live>(live("stats", props), {});
  return body.stats && body.stats.lotsOpen > 0 ? { now: body.now, stats: body.stats } : { now: SAMPLE_NOW, stats: SAMPLE_STATS };
};

const clientResolvers: BlockResolvers = {
  "au-lots": withLots(),
  "au-timeline": withLots(),
  "au-hero": withLots(12),
  "au-ticker": async (props) => {
    const body = await getJson<Live>(live("bids", props, { bidsLimit: String(props.limit ?? 8) }), {});
    return body.bids && body.bids.length > 0 ? { now: body.now, bids: body.bids } : { now: SAMPLE_NOW, bids: SAMPLE_BIDS };
  },
  "au-stats": withStats,
  "au-countdown": withStats,
  // Article blocks: the editor has no `/read/<slug>` page to learn the article
  // from, so it uses the one named in the block, else the newest, else nothing
  // (the block's own example data).
  "au-article": async (props) => {
    let slug = typeof props.slug === "string" ? props.slug : "";
    if (!slug) {
      const t = await getJson<{ topics: Array<{ readHref: string }> }>("/api/auction/articles?kind=topics&limit=1", { topics: [] });
      slug = t.topics[0]?.readHref.replace(/^\/read\//, "") ?? "";
    }
    const body = slug ? await getJson<{ post: unknown }>(`/api/auction/articles?slug=${encodeURIComponent(slug)}`, { post: null }) : { post: null };
    return body.post ? { post: body.post } : {};
  },
  "au-discussion": async (props) => {
    const t = await getJson<{ topics: Array<{ id: string }> }>("/api/auction/articles?kind=topics&limit=1", { topics: [] });
    const id = t.topics[0]?.id;
    if (!id) return {};
    const body = await getJson<{ discussion: unknown }>(`/api/auction/discussion?thread=${encodeURIComponent(id)}&limit=${props.limit ?? 8}`, { discussion: null });
    return body.discussion ? { discussion: body.discussion } : {};
  },
  "au-topics": async (props) => {
    const body = await getJson<{ topics: unknown[] }>(`/api/auction/articles?kind=topics&limit=${props.limit ?? 6}`, { topics: [] });
    return body.topics.length ? { topics: body.topics } : {};
  },
};

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  blocks: CATALOGUE,
  media: { uploadEndpoint: "/api/upload" },
});
