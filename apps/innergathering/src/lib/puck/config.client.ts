"use client";

import { SHARED_BLOCKS, type Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildEditorConfig, buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { contractOf } from "@elkdonis/blocks/contract";
import { LANDING_BLOCKS } from "./landing-blocks";
import { withRouter } from "./router-shim";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// Resolvers here run in the browser, inside Puck's preview iframe, where there
// is no database — so they go over HTTP. The endpoint returns only rows that
// are already published and public, which is the same set the published page
// shows, so the canvas shows the truth rather than a mock.
//
// Everything that is not site-specific — the adapter, the picker, the slider —
// now lives in @elkdonis/page-builder. What stays here is exactly what differs
// between this site and the next one: its feeds and its storage.
// ============================================================================

// The landing blocks' rows come over HTTP for the same reason; dates arrive as text and are made dates again, which is
// what the band (calendar link, times) expects. The forum cannot be drawn here, so its block draws a note in its place.
const THREAD_DATES = ["scheduledAt", "rsvpDeadline", "recurrenceUntil", "publishedAt", "createdAt", "nextOccurrenceAt"];
const withDates = (item: { thread?: Record<string, unknown> }) => {
  if (!item?.thread) return item;
  const thread = { ...item.thread };
  for (const k of THREAD_DATES) if (typeof thread[k] === "string") thread[k] = new Date(thread[k] as string);
  return { ...item, thread };
};

const clientResolvers: BlockResolvers = {
  "offerings-band": async (props) => {
    const params = new URLSearchParams();
    if (typeof props.featured === "string") params.set("featured", props.featured);
    if (typeof props.more === "string") params.set("more", props.more);
    if (typeof props.moreCount === "number") params.set("moreCount", String(props.moreCount));
    try {
      const res = await fetch(`/api/blocks/offerings?${params}`);
      if (!res.ok) return { items: [], rows: [] };
      const body = (await res.json()) as { items?: unknown[]; rows?: unknown[]; signedIn?: boolean; nextcloudUrl?: string | null };
      return {
        items: Array.isArray(body.items) ? body.items.map((i) => withDates(i as never)) : [],
        rows: Array.isArray(body.rows) ? body.rows : [],
        signedIn: Boolean(body.signedIn),
        nextcloudUrl: body.nextcloudUrl ?? null,
      };
    } catch {
      return { items: [], rows: [] };
    }
  },
  "grand-forum": async () => ({ preview: true, embed: null, question: null, signedIn: true }),
  "thread-feed": async (props, metadata) => {
    const params = new URLSearchParams();
    if (typeof metadata.orgId === "string") params.set("orgId", metadata.orgId);
    if (typeof props.limit === "number") params.set("limit", String(props.limit));

    try {
      const res = await fetch(`/api/blocks/thread-feed?${params}`);
      if (!res.ok) return { items: [] };
      const body = (await res.json()) as { items?: unknown };
      return { items: Array.isArray(body.items) ? body.items : [] };
    } catch {
      // An editor that cannot reach the feed shows an empty one. Throwing here
      // would leave the block stuck in Puck's loading state with no way out.
      return { items: [] };
    }
  },
};

// Puck's editor opens box pages too: the box blocks are ordinary blocks to it.
// The landing blocks are drawn inside a router that does nothing (router-shim.tsx): the editor draws them outside Next's router.
const landingForEditor = LANDING_BLOCKS.map((b) => withRouter(b as Block<Record<string, unknown>>) as unknown as Block<never>);
const blocks = [...SHARED_BLOCKS, ...landingForEditor, ...(BOX_BLOCKS as unknown as Block<never>[])];

/** What the landing editor offers Puck on a block ("Settings..."): the shared blocks and the landing's own, with their parts. */
export const canvasContract = contractOf([...SHARED_BLOCKS, ...LANDING_BLOCKS] as never);

/** The canvas editor draws with the published shape: the editor shape's chrome needs Puck's own context. */
export const canvasConfig = buildPuckConfig({ resolvers: clientResolvers, blocks, root: BOX_ROOT, morph: MorphMark });

export const puckConfig = buildEditorConfig({
  blocks,
  root: BOX_ROOT,
  morph: MorphMark,
  resolvers: clientResolvers,
  media: {
    // The same two endpoints the site's own composer uses, so a page block
    // draws on exactly the library an author already knows — org-scoped,
    // editor-gated, backed by this org's Nextcloud folder.
    uploadEndpoint: "/api/upload",
    // Two places to choose from, as separate tabs: what this site has
    // published, and what the person has in their own storage. The org comes
    // first because a page block is usually site material; a personal photo is
    // the deliberate case.
    libraries: [
      { key: "org", label: "This site", endpoint: "/api/media/library" },
      { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
    ],
  },
});
