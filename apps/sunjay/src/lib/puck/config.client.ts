"use client";

import { createElement, type ReactNode } from "react";
import { AutoField } from "@puckeditor/core";
import type { Block, PropDef } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildEditorConfig, buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
// By path until @elkdonis/blocks exports it: the package's `exports` has no entry for this file.
import { contractOf } from "../../../../../packages/blocks/src/contract";
import { fontVariables } from "@/lib/fonts";
import { CATALOGUE } from "./catalogue";
import { ServicePickerField } from "@/components/studio/service-picker";
import { PersonPickerField } from "@/components/studio/person-picker";
import { opensDrawAction, personWhoAction } from "@/lib/featured-person-actions";
import { SAMPLE_EVENT } from "@/blocks/event-sample";
import { SAMPLE_BOOKING, SAMPLE_SERVICES } from "@/blocks/service-sample";
import { SAMPLE_JOURNAL, SAMPLE_POST, SAMPLE_POST_THREAD } from "@/blocks/writing-sample";

// ============================================================================
// The catalogue as the EDITOR sees it.
//
// Resolvers run in the browser, inside Puck's preview iframe, where there is no
// database, so they go over HTTP to /api/blocks/<id> (editors only). The
// member panel is the exception: it describes the signed-in viewer, which is
// nothing to draw on a canvas, so it resolves to nothing and shows the sign-up
// form.
//
// Every keyed read below (`props.limit`, ...) is on purpose: the adapter
// remembers a resolver's answer until a key it READ changes, so a keystroke in
// a heading does not refetch.
// ============================================================================

async function getJson(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    // An editor that cannot reach the data shows the block empty. Throwing
    // would leave it stuck in Puck's loading state with no way out.
    return {};
  }
}

/**
 * The record a template is being edited WITH (2026-11-14): `/studio/<template>?thread=<id>` or `?piece=<slug>`, which
 * the studio page passes in as `metadata.threadId` / `metadata.piece` (and a page's `?service=` as `metadata.service`),
 * the same keys the published routes pass (app/[feed]/[slug], app/journal/[piece], app/[feed]). Forwarded as `at*`
 * query keys, never mixed with the block's own `piece` / `service` choice, so the editor draws what that record's page
 * draws. Without them a template draws the next gathering or the newest piece, as before.
 */
const atRecord = (q: URLSearchParams, metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return;
  if (typeof metadata.threadId === "string" && metadata.threadId) q.set("atThread", metadata.threadId);
  if (typeof metadata.piece === "string" && metadata.piece) q.set("atPiece", metadata.piece);
  if (typeof metadata.service === "string" && metadata.service) q.set("atService", metadata.service);
};

const viaApi =
  (id: string) =>
  async (props: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const q = new URLSearchParams();
    atRecord(q, metadata);
    if (typeof props.limit === "number") q.set("limit", String(props.limit));
    if (typeof props.source === "string") q.set("source", props.source);
    if (typeof props.feed === "string") q.set("feed", props.feed);
    if (typeof props.service === "string" && props.service) q.set("service", props.service);
    if (typeof props.piece === "string" && props.piece) q.set("piece", props.piece);
    if (typeof props.series === "string" && props.series) q.set("series", props.series);
    if (typeof props.which === "string" && props.which) q.set("which", props.which);
    if (typeof props.person === "string" && props.person) q.set("person", props.person);
    if (props.membersOnly === false) q.set("membersOnly", "0");
    return getJson(`/api/blocks/${id}?${q}`);
  };

/**
 * `viaApi`, with example data when the site has nothing to draw: a template
 * opened before any event, service or piece exists should still look like the
 * page it will become. Editor only; the published page never calls this, and
 * the sample is replaced the moment real data exists.
 */
const orSample =
  (id: string, sample: (body: Record<string, unknown>) => Record<string, unknown>, empty: (b: Record<string, unknown>) => boolean) =>
  async (props: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const body = await viaApi(id)(props, metadata);
    return empty(body) ? { ...body, ...sample(body) } : body;
  };

const eventSample = (id: string) => orSample(id, () => ({ event: SAMPLE_EVENT }), (b) => !b.event);

/** Featured person, Opens and a Card's record (2026-11-07): through the editors' actions, the same answer a visitor's page gets. */
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const opensOf = async (v: unknown) => { const s = str(v); return s ? (((await opensDrawAction("opens", s))?.opened as unknown) ?? null) : null; };

const clientResolvers: BlockResolvers = {
  "featured-person": async (props) => ({ who: str(props.person) ? await personWhoAction(props.person as string) : null, opened: await opensOf(props.opens) }),
  "link-button": async (props) => ({ opened: await opensOf(props.opens) }),
  "feature-card": async (props) => ({ bound: str(props.record) ? (((await opensDrawAction("record", props.record as string))?.bound as unknown) ?? null) : null, opened: await opensOf(props.opens) }),
  "pt-standing": viaApi("pt-standing"),
  "pt-calendar": viaApi("pt-calendar"),
  "pt-profile": viaApi("pt-profile"),
  "pt-threads": viaApi("pt-threads"),
  "pt-member": async () => ({ me: null, orgName: "" }),
  "pt-forum": viaApi("pt-forum"),
  "pt-writing": viaApi("pt-writing"),
  "pt-gallery": viaApi("pt-gallery"),
  "pt-event-header": eventSample("pt-event-header"),
  "pt-event-about": eventSample("pt-event-about"),
  "pt-talk-room": eventSample("pt-talk-room"),
  "pt-event-rsvp": eventSample("pt-event-rsvp"),
  "pt-event-materials": eventSample("pt-event-materials"),
  "pt-offering-card": eventSample("pt-offering-card"),
  "pt-services": orSample("pt-services", () => ({ services: SAMPLE_SERVICES }), (b) => !Array.isArray(b.services) || b.services.length === 0),
  "pt-service": orSample("pt-service", () => ({ chosen: SAMPLE_SERVICES[0] }), (b) => !b.chosen),
  "pt-booking": orSample("pt-booking", () => ({ booking: SAMPLE_BOOKING }), (b) => !(b.booking as { service?: unknown } | undefined)?.service),
  "pt-journal": orSample("pt-journal", () => ({ items: SAMPLE_JOURNAL }), (b) => !Array.isArray(b.items) || b.items.length === 0),
  "pt-article": orSample("pt-article", () => ({ post: SAMPLE_POST }), (b) => !b.post),
  // The post page template (2026-11-14): the post in `?thread=`, else an example.
  "pt-post": orSample("pt-post", () => ({ post: SAMPLE_POST_THREAD }), (b) => !b.post),
  "pt-series-nav": orSample(
    "pt-series-nav",
    () => ({ items: SAMPLE_JOURNAL.slice(0, 2), series: "Notes from the lab", current: "first-piece" }),
    (b) => !Array.isArray(b.items) || b.items.length < 2
  ),
  "thread-feed": async (props) => {
    const q = new URLSearchParams();
    if (typeof props.limit === "number") q.set("limit", String(props.limit));
    const body = await getJson(`/api/blocks/thread-feed?${q}`);
    return { items: Array.isArray(body.items) ? body.items : [] };
  },
};

/**
 * The canvas is an iframe whose <html> lacks the font-variable classes the
 * root layout sets, so the page's serif would fall back to Georgia there.
 */
function CanvasFonts({ children }: { settings: Record<string, unknown>; children?: ReactNode }) {
  return createElement("div", { className: fontVariables }, children);
}

// Puck's editor opens a page the canvas saved, so the box blocks are ordinary blocks to it too.
const blocks = [...CATALOGUE, ...(BOX_BLOCKS as unknown as Block<never>[])];

/**
 * Rows only: the canvas draws a block's own sample when a resolver finds nothing,
 * and labels it, so it has to be able to tell the two apart. Puck's editor keeps
 * the `orSample` resolvers above.
 */
const canvasResolvers: BlockResolvers = {
  ...clientResolvers,
  ...Object.fromEntries(
    [
      "pt-event-header",
      "pt-event-about",
      "pt-talk-room",
      "pt-event-rsvp",
      "pt-event-materials",
      "pt-offering-card",
      "pt-services",
      "pt-service",
      "pt-booking",
      "pt-journal",
      "pt-article",
      "pt-series-nav",
      "pt-post",
    ].map((id) => [id, viaApi(id)])
  ),
};

/**
 * What a row's rich text may hold: the same set as page-builder's top-level rich text (what `sanitizePageText` keeps),
 * with step-sized headings. Code, rules and alignment are off.
 */
const ROW_RICH_TEXT = { code: false, codeBlock: false, horizontalRule: false, textAlign: false, heading: { levels: [3, 4] } };

/** The canvas editor draws with the published shape: the editor shape's chrome needs Puck's own context. */
export const canvasConfig = buildPuckConfig({ resolvers: canvasResolvers, blocks, root: BOX_ROOT, morph: MorphMark });

/** What each sealed block declares: its settings in the right column, and its parts to click into. */
export const canvasContract = contractOf(CATALOGUE);

function makePuckConfig(tabs: boolean) {
  return buildEditorConfig({
  tabs,
  resolvers: clientResolvers,
  blocks,
  morph: MorphMark,
  root: { props: [], wrap: CanvasFonts },
  fields: {
    // A rich-text COLUMN of a rows prop (Numbered steps' "Words under it", 2026-11-14). A top-level rich-text prop
    // already gets Puck's formatted-text field from buildEditorConfig; a row's column fell back to a textarea that
    // showed the stored HTML (`<p>…</p>`). This hands the column Puck's own rich-text field, so the stored value
    // stays the same HTML and existing rows open as they are. Saving still goes through the host's sanitiser.
    richtext: (prop: PropDef) =>
      function RowRichText(props: Record<string, unknown>) {
        // No `id` or `name`: the public AutoField keeps the value in a store of its own, keyed by its own id, and
        // Puck's rich-text field reads it back by name (default: that id). The outer field's name ("steps[0].text")
        // is not a key of that store, so passing it drew an empty editor (harness/event-detail/drive-steps.cjs).
        return createElement(AutoField as never, {
          field: { type: "richtext", label: prop.label, options: ROW_RICH_TEXT },
          value: typeof props.value === "string" ? props.value : "",
          onChange: props.onChange,
          readOnly: props.readOnly,
        });
      },
    // A string that BINDS to a service gets a picker; every other string keeps
    // Puck's own box (null = leave it alone).
    string: (prop: PropDef) =>
      prop.binds === "service"
        ? function ServiceProp(props: Record<string, unknown>) {
            return createElement(ServicePickerField, props as never);
          }
        : // A person, an Opens or a Card's record gets "From what?" (2026-11-07); a piece of writing too (2026-11-14).
          prop.binds === "person" || prop.binds === "opens" || prop.binds === "record" || prop.binds === "piece" || prop.binds === "gathering" || prop.binds === "guide"
          ? function ReferenceProp(props: Record<string, unknown>) {
              return createElement(PersonPickerField, { ...(props as object), binds: prop.binds } as never);
            }
          : null,
  },
  media: {
    uploadEndpoint: "/api/upload",
    libraries: [
      { key: "org", label: "This site", endpoint: "/api/media/library" },
      { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
    ],
  },
  });
}

/** Flat field list: what the canvas's block-settings popup (CanvasEditor) draws. */
export const puckConfig = makePuckConfig(false);

/**
 * The whole-page editor's config (2026-11-21): the same blocks with each block's fields in Content and Style tabs
 * (Puck 0.24 FieldTab, `buildEditorConfig({ tabs })`). Kept apart from `puckConfig`: the settings popup and the
 * tab memory across block types are not yet checked with tabs.
 */
export const wholePageConfig = makePuckConfig(true);
