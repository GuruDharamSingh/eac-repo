"use client";

import { createElement, type ReactNode } from "react";
import type { PropDef } from "@elkdonis/blocks";
import { buildEditorConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { fontVariables } from "@/lib/fonts";
import { CATALOGUE } from "./catalogue";
import { ServicePickerField } from "@/components/studio/service-picker";
import { SAMPLE_EVENT } from "@/blocks/event-sample";
import { SAMPLE_BOOKING, SAMPLE_SERVICES } from "@/blocks/service-sample";
import { SAMPLE_JOURNAL, SAMPLE_POST } from "@/blocks/writing-sample";

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

const viaApi =
  (id: string) =>
  async (props: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const q = new URLSearchParams();
    if (typeof props.limit === "number") q.set("limit", String(props.limit));
    if (typeof props.source === "string") q.set("source", props.source);
    if (typeof props.feed === "string") q.set("feed", props.feed);
    if (typeof props.service === "string" && props.service) q.set("service", props.service);
    if (typeof props.piece === "string" && props.piece) q.set("piece", props.piece);
    if (typeof props.series === "string" && props.series) q.set("series", props.series);
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
  async (props: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const body = await viaApi(id)(props);
    return empty(body) ? { ...body, ...sample(body) } : body;
  };

const eventSample = (id: string) => orSample(id, () => ({ event: SAMPLE_EVENT }), (b) => !b.event);

const clientResolvers: BlockResolvers = {
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

export const puckConfig = buildEditorConfig({
  resolvers: clientResolvers,
  blocks: CATALOGUE,
  root: { props: [], wrap: CanvasFonts },
  fields: {
    // A string that BINDS to a service gets a picker; every other string keeps
    // Puck's own box (null = leave it alone).
    string: (prop: PropDef) =>
      prop.binds === "service"
        ? function ServiceProp(props: Record<string, unknown>) {
            return createElement(ServicePickerField, props as never);
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
