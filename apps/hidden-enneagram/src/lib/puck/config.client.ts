"use client";

import { createElement, type ReactNode } from "react";
import { contractOf } from "@elkdonis/blocks/contract";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { buildPuckConfig } from "@elkdonis/page-builder/config";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { fontVariables } from "@/lib/fonts";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { figurePlacement } from "@/blocks/enneagram-block";
import { STATIC_COURSE } from "@/blocks/course-data";

// ============================================================================
// The catalogue as the EDITOR sees it (katie's config.client.ts). Resolvers
// run in the browser, inside Puck's preview iframe, where there is no
// database. Every keyed read is deliberate: the adapter remembers a
// resolver's answer until a key it READ changes, so a keystroke does not
// refetch while a MOVE (placement) does. The course card shows the static
// copy of the course on the canvas; the published page reads the live one.
// The same resolvers draw the "Edit look" popup (canvasConfig).
// ============================================================================

async function getJson<T>(url: string, key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const body = (await res.json()) as Record<string, unknown>;
    return (body[key] as T) ?? fallback;
  } catch {
    // An editor that cannot reach the data shows the block empty; throwing
    // would leave it stuck in Puck's loading state.
    return fallback;
  }
}

const clientResolvers: BlockResolvers = {
  "he-enneagram": async (_props, metadata) => ({ placement: figurePlacement(metadata.placement) }),
  "he-course": async () => ({ course: STATIC_COURSE }),
  "thread-feed": async (props) => ({
    items: await getJson(`/api/blocks/thread-feed?limit=${typeof props.limit === "number" ? props.limit : 10}`, "items", []),
  }),
  // Round 3: the same records through the editor's routes (visitor-visible data only).
  "he-shelf": async (props) => ({
    items: await getJson(`/api/blocks/he-shelf?source=${encodeURIComponent(String(props.source ?? ""))}&feed=${encodeURIComponent(String(props.feed ?? ""))}&limit=${Number(props.limit) || 3}`, "items", []),
  }),
  "he-forum": async (props) => ({ topics: await getJson(`/api/blocks/he-records?block=forum&limit=${Number(props.limit) || 0}`, "topics", []) }),
  "he-person": async (props) =>
    props.layout === "page"
      ? { person: null, page: await getJson(`/api/blocks/he-records?block=person-page&slug=${encodeURIComponent(String(props.slug ?? ""))}`, "page", null) }
      : { person: await getJson(`/api/blocks/he-records?block=person&slug=${encodeURIComponent(String(props.slug ?? ""))}`, "person", null) },
  "he-service": async (props) => ({
    service: await getJson(`/api/blocks/he-records?block=service&slug=${encodeURIComponent(String(props.serviceSlug ?? ""))}`, "service", null),
    booking: null,
  }),
  // Round 6: the article template's sample (a feed's newest public post, or the one named).
  "he-post": async (props) => ({
    post: await getJson(
      `/api/blocks/he-records?block=post&feed=${encodeURIComponent(String(props.postFeed ?? ""))}&slug=${encodeURIComponent(String(props.postSlug ?? ""))}`,
      "post",
      null,
    ),
  }),
};

/**
 * The canvas is an iframe whose <html> lacks the font-variable classes the
 * root layout sets on the page; its root carries them.
 */
function CanvasFonts({ children }: { settings: Record<string, unknown>; children?: ReactNode }) {
  return createElement("div", { className: `${fontVariables} he-canvas` }, children);
}

/** What each block declares: its settings, and its parts to click into (the look layer). */
export const canvasContract = contractOf(CATALOGUE);

/** The published-shape config the "Edit look" popup draws a block with. */
export const canvasConfig = buildPuckConfig({ resolvers: clientResolvers, blocks: CATALOGUE, morph: MorphMark, root: { props: [], wrap: CanvasFonts } });

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  blocks: CATALOGUE,
  morph: MorphMark,
  root: { props: [], wrap: CanvasFonts },
  media: {
    uploadEndpoint: "/api/upload",
    libraries: [{ key: "site", label: "Site images", endpoint: "/api/media/library" }],
  },
});
