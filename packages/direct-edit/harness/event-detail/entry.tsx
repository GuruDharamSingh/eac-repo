// Harness entry (2026-11-14, editing landscape round 1): Para Theater's event detail, services and writing blocks on
// the canvas editor, wired as apps/sunjay/src/components/studio/CanvasEditor.tsx wires it (canvasConfig, its contract,
// "From what?" = components/landing/person-records.ts). The server actions are stubbed (build.cjs turns any
// "use server" module into stubs; service-actions is aliased to service-actions-stub.ts for real fixtures).
//
// Query: doc=a (every block drawn with rich rows) | b (the empty and fallback states); looks=1 stores a `size` look on
// every declared part (10px + its index), so the driver can check each selector against what is drawn;
// view=published draws the document with the published shape (<Render>, no editor) instead of the canvas.
import "@elkdonis/blocks/blocks.css";
import "@elkdonis/direct-edit/direct-edit.css";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { Render } from "@puckeditor/core";
import { mountTreePage } from "/app/packages/direct-edit/src/puck/mount";
import { canvasConfig, canvasContract, puckConfig } from "/app/apps/sunjay/src/lib/puck/config.client";
import { records } from "/app/apps/sunjay/src/components/landing/person-records";
import { landingPublishedConfig } from "/app/apps/sunjay/src/lib/puck/config.landing";
import { HOME_BLOCKS } from "/app/apps/sunjay/src/blocks/home-blocks";
import { contractOf } from "/app/packages/blocks/src/contract";
import { SAMPLE_EVENT } from "/app/apps/sunjay/src/blocks/event-sample";
import { SAMPLE_BOOKING, SAMPLE_SERVICES } from "/app/apps/sunjay/src/blocks/service-sample";
import { SAMPLE_JOURNAL, SAMPLE_POST } from "/app/apps/sunjay/src/blocks/writing-sample";

const g = globalThis as any;
const q = new URLSearchParams(location.search);
const which = q.get("doc") === "b" ? "b" : "a";
const pic = (fill: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 480"><rect width="840" height="480" fill="${fill}"/><text x="30" y="60" font-family="sans-serif" font-size="30" fill="#fff">${label}</text></svg>`)}`;

// ── the document: the event-detail template's shape, then services and writing ──────────────────────────────
const n = (type: string, id: string, props: Record<string, unknown> = {}) => ({ type, props: { id, ...props } });
const band = (id: string, content: unknown[]) => n("pt-band", id, { ground: "plain", padding: "regular", width: "wide", rule: false, content });
const doc = {
  root: { props: { title: "Event detail" } },
  content: [
    band("b-head", [n("pt-event-header", "ev-head", { showCrumb: true, showFacts: true, showCover: true })]),
    band("b-mid", [
      n("split-row", "split", {
        ratio: "wide-start", align: "start", gap: "loose", columns: "stacked",
        start: [
          n("pt-talk-room", "ev-room", { heading: "The room", note: "Opens ten minutes before.", membersOnly: true, startOpen: true, height: 400 }),
          n("pt-notice", "notice", { title: "This session is recorded", body: "<p>Recordings stay in the group's folder.</p>", tone: "note" }),
        ],
        end: [
          n("pt-event-rsvp", "ev-rsvp", { showAttendees: true }),
          n("pt-event-materials", "ev-mat", { heading: "Materials" }),
        ],
      }),
    ]),
    band("b-about", [n("pt-event-about", "ev-about", { heading: "About this gathering" })]),
    n("pt-offering-card", "offer", { eyebrow: "Open to everyone", heading: "Current Offerings", showCall: true, showRsvp: true, showCalendar: true }),
    n("pt-services", "svc-cards", { heading: "Services", intro: "What we offer.", limit: 12, layout: "cards", showImages: true, chooseLabel: "Choose", emptyMessage: "Nothing is offered right now." }),
    n("pt-services", "svc-rows", { heading: "Services", intro: "", limit: 12, layout: "rows", showImages: true, chooseLabel: "Pick", emptyMessage: "Nothing is offered right now." }),
    n("pt-service", "svc-one", { service: "", showImage: true, showBody: true }),
    n("pt-booking", "svc-book", { service: "", heading: "Book", notesLabel: "Anything we should know?" }),
    n("pt-journal", "journal", { heading: "Writing", intro: "Notes from the lab.", limit: 12, series: "", lead: true, emptyNote: "Nothing is published here yet." }),
    n("pt-article", "article", { piece: "", reading: "journal", showBack: true, showCover: true }),
    n("pt-series-nav", "series", { heading: "In this series" }),
    n("pt-standing", "standing", { which: "standing", tall: true }),
    n("pt-profile", "profile", { person: "", showLinks: true, linkLabel: "Read more" }),
    n("pt-gallery", "gallery", { heading: "Gallery", limit: 12, autoAdvanceSeconds: 1 }),
  ],
};
const galleryImages = ["#39475a", "#6d5a44", "#3f5a6b"].map((fill, i) => ({ url: pic(fill, `Picture ${i + 1}`), name: `Picture ${i + 1}` }));
const siteGuideRow = { userId: "u-jason", slug: "jason-ford", displayName: "Jason (the site's guide)", roleTitle: "Teacher", bio: "Bio.", photoUrl: null, city: null, socialLinks: [], sortOrder: 0 };
const standingRow = {
  event: { id: "lab", title: "Standing lab (live)", slug: "lab", kind: "meeting", feedSlug: "gatherings", excerpt: "The weekly lab.", description: null, location: null, isOnline: true, meetingUrl: null, coverImageUrl: null, scheduledAt: "2026-11-18T23:30:00.000Z", recurrencePattern: "WEEKLY", isRsvpEnabled: true, durationMinutes: 90 },
  at: "2026-11-18T23:30:00.000Z",
  source: "weekly",
};

// ── what the resolvers would have filled: rich rows (a), or the empty and fallback states (b) ─────────────────
const event = {
  ...SAMPLE_EVENT,
  excerpt: "A weekly lab for movement, voice and presence.",
  coverImageUrl: pic("#2d3a4a", "Ritual Theatre Lab"),
  cancelled: true,
  talkUrl: "https://cloud.example.invalid/call/abc",
  hasRoom: true,
  isMember: true,
  signedIn: true,
  attendees: [{ name: "A member", isMember: true, photoUrl: null }],
};
// Titled apart from the contract's samples, so the driver can tell the page's own rows from the editor's example.
const services = [
  { ...SAMPLE_SERVICES[0], id: "live-1", slug: "live-lab", title: "Live Lab (the newest)", coverImageUrl: pic("#4a3a2d", "Movement Lab") },
  { ...SAMPLE_SERVICES[1], id: "live-2", slug: "live-one", title: "Live one-to-one" },
];
const liveBooking = { ...SAMPLE_BOOKING, service: services[0] };
const RESOLVED: Record<"a" | "b", Record<string, Record<string, unknown>>> = {
  a: {
    "ev-head": { event }, "ev-room": { event }, "ev-rsvp": { event }, "ev-mat": { event }, "ev-about": { event }, offer: { event },
    "svc-cards": { services }, "svc-rows": { services },
    "svc-one": { chosen: services[0] }, "svc-book": { booking: liveBooking },
    journal: { items: SAMPLE_JOURNAL.map((i, k) => (k === 0 ? { ...i, coverImageUrl: pic("#39475a", "Lead") } : { ...i, coverImageUrl: pic("#55708a", "Row") })) },
    article: { post: { ...SAMPLE_POST, title: "The newest piece (live)", coverImageUrl: pic("#6b3f4c", "Cover") } },
    series: { items: SAMPLE_JOURNAL.slice(0, 2), series: "Notes from the lab", current: "first-piece" },
    standing: { standing: standingRow, canEdit: true },
    profile: { guide: siteGuideRow, links: [{ label: "Elkdonis Arts", url: "https://elkdonis-arts.org", emphasis: true }] },
    gallery: { images: galleryImages },
  },
  b: {
    "ev-head": { event: null },
    "ev-room": { event: { ...SAMPLE_EVENT, talkUrl: null, hasRoom: false } },
    "ev-rsvp": { event: SAMPLE_EVENT }, "ev-mat": { event: SAMPLE_EVENT }, "ev-about": { event: SAMPLE_EVENT },
    offer: { event: null },
    "svc-cards": { services: [] }, "svc-rows": { services: [] },
    "svc-one": { chosen: services[1] }, "svc-book": { booking: { ...liveBooking, unavailable: null } },
    journal: { items: [] },
    article: { post: SAMPLE_POST },
    series: { items: SAMPLE_JOURNAL.slice(0, 2), series: "Notes from the lab", current: "second-piece" },
    standing: { standing: null, canEdit: false },
    profile: { guide: null, links: [] },
    gallery: { images: galleryImages },
  },
};

// ── looks: a `size` on every declared part, 10px + the part's index in its block's declaration ────────────────
const contract = canvasContract as unknown as Record<string, { parts?: Record<string, { sel: string; prop?: string }> }>;
const sizeOf = (type: string, part: string) => 10 + Object.keys(contract[type]?.parts ?? {}).indexOf(part);
function withLooks(list: any[]): any[] {
  return list.map((node) => {
    const props = { ...node.props };
    const parts = contract[node.type]?.parts;
    if (parts && !["pt-band", "split-row"].includes(node.type)) {
      props.morph = { v: 1, parts: Object.fromEntries(Object.keys(parts).map((p) => [p, { size: sizeOf(node.type, p) }])) };
    }
    for (const [k, v] of Object.entries(props)) if (Array.isArray(v) && v.every((x: any) => x && typeof x === "object" && "type" in x)) props[k] = withLooks(v as any[]);
    return { ...node, props };
  });
}
const stored = q.get("looks") === "1" ? { ...doc, content: withLooks(doc.content) } : doc;

g.__contract = contract;
g.__sizeOf = sizeOf;
g.__doc = JSON.parse(JSON.stringify(stored));
g.__saved = null;
// The Puck editor's field for the pt-steps rows (the "Words under it" fix): read by the driver.
g.__stepsFields = (puckConfig as any).components["pt-steps"].fields.steps;
// A block's editor resolver, run as Puck and the canvas run it on load: for the template-preview plumbing.
g.__resolveEditor = async (which: "puck" | "canvas", type: string, props: Record<string, unknown>, metadata: Record<string, unknown>) => {
  const c = (which === "puck" ? (puckConfig as any) : (canvasConfig as any)).components[type];
  const out = await c.resolveData({ props: { id: "probe", ...props } }, { metadata, changed: {}, trigger: "load", lastData: null, parent: null });
  return JSON.parse(JSON.stringify(out?.props ?? null));
};

const host = document.getElementById("host")!;
if (q.get("view") === "home") {
  // The home page's live pieces (config.landing.ts), as app/page.tsx hands them over: the default drawing under the
  // piece's id, and a node whose `which` is not the standing meeting under `home-standing#<node id>`.
  const tree = { root: { props: {} }, content: [
    { type: "home-standing", props: { id: "hs-1", which: "standing" } },
    { type: "home-standing", props: { id: "hs-2", which: "next" } },
    { type: "home-standing", props: { id: "hs-3" } },
  ] };
  const parts = { "home-standing": "<p data-drawn>the standing meeting</p>", "home-standing#hs-2": "<p data-drawn>the next gathering</p>" };
  createRoot(host).render(h(Render as any, { config: landingPublishedConfig, data: tree, metadata: { parts } }));
  g.__homeContract = (contractOf as any)(HOME_BLOCKS);
  g.__ready = true;
} else if (q.get("view") === "published") {
  // The published shape: resolved rows merged into the props, as resolveAllData leaves them for <Render>.
  const merge = (list: any[]): any[] => list.map((node) => {
    const props = { ...node.props, ...(RESOLVED[which][node.props.id] ?? {}) };
    for (const [k, v] of Object.entries(props)) if (Array.isArray(v) && v.every((x: any) => x && typeof x === "object" && "type" in x)) props[k] = merge(v as any[]);
    return { ...node, props };
  });
  createRoot(host).render(h(Render as any, { config: canvasConfig, data: { ...stored, content: merge(stored.content) } }));
  g.__ready = true;
} else {
  g.__editor = mountTreePage({
    host,
    config: canvasConfig as never,
    contract: canvasContract as never,
    doc: JSON.parse(JSON.stringify(stored)),
    resolved: RESOLVED[which],
    metadata: { orgId: "sunjay", slug: "event-detail" },
    records,
    pageName: "Event detail page",
    onSave: async (d: unknown) => { g.__saved = JSON.parse(JSON.stringify(d)); return { ok: true }; },
  } as never);
  g.__ready = true;
}
