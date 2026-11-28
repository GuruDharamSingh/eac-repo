// ============================================================================
// The offer-page catalogue: one plain-data module (lane C, 2026-11-27).
//
// Read by two doors: the Catalogue view (Catalogue.tsx) and the JSON route
// (app/offer-templates/catalogue.json/route.ts, for agents). No JSX, no browser
// APIs, so a server route can import it.
//
// Where each part comes from:
//   - templates and patterns: imported from each template's own `<id>.meta.tsx`
//     (so they cannot drift from the template) plus TEMPLATES in templates/types.tsx;
//   - layers, flows, tokens, font templates, CSS rules, data contract: written by hand
//     from the code as read on 2026-11-27. They point at file and line instead of
//     copying types; if a line has moved, the file is the authority, not this number.
//     `CHECKED_AT` says when the lines were last compared with the files.
// ============================================================================
import { TEMPLATES, type TemplateInfo } from "@elkdonis/cms-ui/offer-templates/types";
import type { PatternMeta, TemplateMeta } from "@elkdonis/cms-ui/offer-templates/meta";
import type { OfferFlow, OfferLayerId } from "@elkdonis/cms-ui/offer-surface";
import { meta as announcement } from "@elkdonis/cms-ui/offer-templates/announcement.meta";
import { meta as artwork } from "@elkdonis/cms-ui/offer-templates/artwork.meta";
import { meta as documentMeta } from "@elkdonis/cms-ui/offer-templates/document.meta";
import { meta as essay } from "@elkdonis/cms-ui/offer-templates/essay.meta";
import { meta as event } from "@elkdonis/cms-ui/offer-templates/event.meta";
import { meta as feature } from "@elkdonis/cms-ui/offer-templates/feature.meta";
import { meta as gazette } from "@elkdonis/cms-ui/offer-templates/gazette.meta";
import { meta as note } from "@elkdonis/cms-ui/offer-templates/note.meta";
import { meta as profile } from "@elkdonis/cms-ui/offer-templates/profile.meta";
import { meta as series } from "@elkdonis/cms-ui/offer-templates/series.meta";
import { meta as service } from "@elkdonis/cms-ui/offer-templates/service.meta";
import { shellMeta } from "@elkdonis/cms-ui/offer-templates/shell.meta";

export const shell = shellMeta;
export const CHECKED_AT = "2026-11-27";
const KIT = "packages/cms-ui/src/offer-surface";
const TPL = `${KIT}/templates`;

/** Sandbox URL of a template, app-relative (the dev app adds its base path). */
export const sandboxPath = (id: string) => `/offer-templates/t/${id}`;

// ── Templates ────────────────────────────────────────────────────────────────

/** TemplateId -> its own meta. Order follows TEMPLATES. */
const METAS: Record<string, TemplateMeta> = { announcement, artwork, document: documentMeta, essay, event, feature, gazette, note, profile, series, service };

/** `--ost-base` of each template: the design width the page scales up from (the `.ost-page[data-template]` rule at the foot of its css). */
const SCALE_BASE: Record<string, number> = { event: 700, service: 720, announcement: 560, note: 560, artwork: 860, series: 760, profile: 800, essay: 620, feature: 620, document: 620, gazette: 620 };

export interface TemplateEntry {
  info: TemplateInfo;
  meta: TemplateMeta;
  sandbox: string;
  scaleBase: number | null;
  counts: { reads: number; requiredReads: number; missing: number; actions: number; inertActions: number; patterns: number; sharedPatterns: number; adapted: number };
}

export const templateEntries: TemplateEntry[] = TEMPLATES.flatMap((info) => {
  const meta = METAS[info.id];
  if (!meta) return []; // a TEMPLATES row with no meta file: reported in `problems`, left out of the list
  return [
    {
      info,
      meta,
      sandbox: sandboxPath(info.id),
      scaleBase: SCALE_BASE[info.id] ?? null,
      counts: {
        reads: meta.reads.length,
        requiredReads: meta.reads.filter((r) => r.required).length,
        missing: meta.missing?.length ?? 0,
        actions: meta.actions.length,
        inertActions: meta.actions.filter((a) => /inert|not built/i.test(a.opens)).length,
        patterns: meta.patterns.length,
        sharedPatterns: meta.patterns.filter((p) => p.shared).length,
        adapted: meta.adapted.length,
      },
    },
  ];
});

/** Things a meta says that disagree with TEMPLATES or with the file layout. Shown, not fixed. */
export const problems: string[] = (() => {
  const out: string[] = [];
  for (const info of TEMPLATES) {
    const m = METAS[info.id];
    if (!m) {
      out.push(`${info.id}: listed in TEMPLATES but has no meta file; left out of the catalogue.`);
      continue;
    }
    if (m.id !== info.id) out.push(`${info.id}: its meta says id "${m.id}".`);
    if (m.packet !== info.packet) out.push(`${info.id}: meta.packet is "${m.packet}" but TEMPLATES says "${info.packet}".`);
    if (m.files.tsx !== `${TPL}/${info.id}.tsx`) out.push(`${info.id}: meta.files.tsx is "${m.files.tsx}".`);
    if (m.files.css !== `${TPL}/${info.id}.css`) out.push(`${info.id}: meta.files.css is "${m.files.css}".`);
    if (m.files.route !== `apps/development/src/app/offer-templates/t/${info.id}`) out.push(`${info.id}: meta.files.route is "${m.files.route}".`);
    if (!(info.id in SCALE_BASE)) out.push(`${info.id}: no --ost-base recorded in this catalogue.`);
  }
  for (const id of Object.keys(METAS)) if (!TEMPLATES.some((t) => t.id === id)) out.push(`${id}: has a meta but is not in TEMPLATES.`);
  return out;
})();

// ── Patterns ─────────────────────────────────────────────────────────────────

export interface PatternUse {
  /** Template id, or "shell". */
  source: string;
  name: string;
  use: string;
  rootClass: string;
  packet: string;
  shared: boolean;
}
export interface PatternGroup {
  id: string;
  /** Number of templates (or the shell) that draw a pattern with this id. */
  count: number;
  /** True when the same id appears in two or more places. */
  repeated: boolean;
  /** True when any entry is marked `shared: true` in its meta. */
  markedShared: boolean;
  uses: PatternUse[];
}

function collectPatterns(): PatternGroup[] {
  const by = new Map<string, PatternUse[]>();
  const add = (source: string, p: PatternMeta) => {
    const list = by.get(p.id) ?? [];
    list.push({ source, name: p.name, use: p.use, rootClass: p.rootClass, packet: p.packet, shared: Boolean(p.shared) });
    by.set(p.id, list);
  };
  for (const e of templateEntries) for (const p of e.meta.patterns) add(e.info.id, p);
  for (const p of shellMeta.patterns) add("shell", p);
  return [...by.entries()]
    .map(([id, uses]) => ({ id, count: new Set(uses.map((u) => u.source)).size, repeated: new Set(uses.map((u) => u.source)).size > 1, markedShared: uses.some((u) => u.shared), uses }))
    .sort((a, b) => Number(b.repeated) - Number(a.repeated) || b.count - a.count || a.id.localeCompare(b.id));
}
export const patternGroups: PatternGroup[] = collectPatterns();

/**
 * Patterns that look alike but carry different ids. This is this lane's reading of the names and
 * `use` texts, NOT something the meta files say: confirm against the CSS before lifting any of them.
 */
export const lookAlikes: Array<{ name: string; ids: string[]; why: string }> = [
  { name: "Pull quote", ids: ["pull-quote", "pull-quote-mark"], why: "essay centred pull quote and feature pull quote with a bronze mark: one quote block, two skins." },
  { name: "Drop cap", ids: ["drop-cap", "justified-columns"], why: "essay opens sections with a drop cap; gazette's justified columns carry one too." },
  { name: "Tag chips", ids: ["tag-chips", "mono-tags"], why: "note and service both draw small tag chips (one serif, one mono)." },
  { name: "Offer door card", ids: ["offer-card", "gateway-face"], why: "profile's lifting offer card and the shell's gateway face share the packet's card language (bronze top, kind box, + circle, hover lift)." },
  { name: "Date and time list", ids: ["running-order", "session-list"], why: "event running order and series session list are both ruled time/label rows." },
  { name: "Pulsing dot", ids: ["live-dot", "ribbon"], why: "announcement ribbon carries a pulsing dot like the event and profile live dots." },
];

// ── Layers (popups) ──────────────────────────────────────────────────────────

export type LayerStatus = "built" | "built, backend sample-only" | "built, nothing is sent";

export interface LayerEntry {
  id: OfferLayerId;
  name: string;
  /** Icon kind (gk) it draws with, which also picks its kind colour. */
  gk: string;
  forWhat: string;
  file: string;
  component: string;
  openedBy: string[];
  /** Layers it pushes on top of itself. */
  pushes: string[];
  /** Layers it swaps itself for (replace), or other stack moves. */
  replaces: string[];
  headButton: string | null;
  primary: string | null;
  quiet: string | null;
  status: LayerStatus;
  /** What is real and what is not, in one or two plain sentences. */
  statusNote: string;
  /** Flows (ids from `flows`) it belongs to. */
  flows: string[];
  /** Sample offer/profile key and flow that open it in the sandbox. */
  sandbox: { key: string; flow?: OfferFlow };
}

const L = `${KIT}/layers.tsx`;
const LF = `${KIT}/layers-flow.tsx`;
const LR = `${KIT}/layers-read.tsx`;
const LS = `${KIT}/layers-series.tsx`;
const LP = `${KIT}/layers-people.tsx`;

export const layers: LayerEntry[] = [
  {
    id: "evt-offer", name: "Event", gk: "evt", forWhat: "Explains an event (date block, venue, running order, who is coming) and offers the take-up.",
    file: L, component: "EventOffer",
    openedBy: ["Event template: I'm coming / Get a ticket", "Announcement template: Save a place", "A gateway face or a profile card of an event", "pf-owner rows, pf-guest Here cards", "A shared link ?surface=offer:evt-offer:<key>"],
    pushes: ["pay (flow evt) when takeUp is pay and it has a price", "evt-rsvp when takeUp is rsvp (button reads Full and is disabled at capacity)", "pf-owner / pf-guest (host row; the Ask the host button when neither applies)", "share (head button)"],
    replaces: [], headButton: "↗ Share", primary: "I'm coming, or Get a place · price, or Ask the host", quiet: null,
    status: "built", statusNote: "Draws from site data. The running order and who-is-coming rows come from data.extras and are empty on a live site until that data exists.",
    flows: ["event"], sandbox: { key: "thread:evt" },
  },
  {
    id: "evt-rsvp", name: "RSVP", gk: "evt", forWhat: "Asks for a name and email (when signed out) and records a free RSVP.",
    file: LF, component: "EventRsvp",
    openedBy: ["evt-offer primary (free event)", "ser-session primary (I'm coming)"], pushes: ["done (flow evt, carries `follows` when the RSVP made the visitor a follower)"], replaces: [],
    headButton: null, primary: "Yes, I'm coming", quiet: null,
    status: "built, backend sample-only", statusNote: "Calls SurfaceActions.rsvp. The sandbox's sampleActions always answers ok; the live host supplies the real one (apps/arts-collective/src/components/sites/offer-actions.ts, not checked by this lane). Decision 14 was changed on the board: an RSVP will need an account made through a quick sign-up surface; the layer today still asks a signed-out visitor for name and email.",
    flows: ["event", "series"], sandbox: { key: "thread:evt" },
  },
  {
    id: "svc-offer", name: "Service", gk: "svc", forWhat: "Explains a one-to-one service, lets the visitor pick a time slot and, for sliding-scale prices, an amount.",
    file: L, component: "ServiceOffer",
    openedBy: ["Service template (Session)", "A gateway face or a profile card of a service", "pay when it is opened without a chosen slot (OfferLayer.tsx sends the visitor here first)", "A shared link"],
    pushes: ["pay (flow svc, carries slotId and amountMinor)", "pf-owner / pf-guest (host row; Ask the host when there is no price)", "share (head button)"], replaces: [],
    headButton: "↗ Share", primary: "Book · total, or Ask the host", quiet: null,
    status: "built", statusNote: "Draws from site data (offer.slots, price, sliding).", flows: ["service"], sandbox: { key: "thread:svc" },
  },
  {
    id: "art-offer", name: "Artwork", gk: "art", forWhat: "Shows an artwork with its medium, size and edition, and offers an order.",
    file: L, component: "ArtworkOffer",
    openedBy: ["Artwork template (Work)", "A gateway face or a profile card of an artwork", "pay when it is opened without a delivery choice", "A shared link"],
    pushes: ["art-order (flow art) when the work can be ordered", "pf-owner / pf-guest (Ask about this work when it cannot)", "share (head button)"], replaces: [],
    headButton: "↗ Share", primary: "Order · price, or Ask about this work", quiet: null,
    status: "built", statusNote: "Draws from site data (offer.artwork, price, images).", flows: ["artwork"], sandbox: { key: "artwork:1" },
  },
  {
    id: "art-order", name: "Delivery", gk: "art", forWhat: "Choose ship or collect (and an address) before paying for an artwork.",
    file: L, component: "ArtworkOrder",
    openedBy: ["art-offer primary"], pushes: ["pay (flow art, carries delivery and address)"], replaces: [],
    headButton: null, primary: "Continue to pay", quiet: null,
    status: "built", statusNote: "No backend call of its own; the choice travels in memory to pay.", flows: ["artwork"], sandbox: { key: "artwork:1", flow: "art" },
  },
  {
    id: "pay", name: "Confirm and pay", gk: "(by flow: svc / evt / art / ser)", forWhat: "Summarises what is being paid for and hands the visitor to Stripe's hosted page.",
    file: LF, component: "Pay",
    openedBy: ["evt-offer (priced)", "svc-offer", "art-order", "A shared link or a checkout cancel return (OfferLayer.tsx falls back to svc-offer or art-offer when slot or delivery is missing)"],
    pushes: [], replaces: [], headButton: null, primary: "Pay · total", quiet: null,
    status: "built, backend sample-only", statusNote: "Calls SurfaceActions.checkout, then the browser leaves for Stripe and returns to ?surface=offer:done:<key>:<flow>. The sandbox's checkout answers 'The sandbox takes no payments', so it never leaves. A cancelled card page comes back to the offer layer with ?payment=cancelled and cancelled.tsx shows a one-time line.",
    flows: ["service", "event", "artwork"], sandbox: { key: "thread:svc", flow: "svc" },
  },
  {
    id: "done", name: "Done", gk: "done", forWhat: "The last step of every transaction; its title and note change with the flow.",
    file: LF, component: "Done",
    openedBy: ["pay return (from Stripe)", "evt-rsvp", "follow", "ser-sub"], pushes: ["talk (a Talk row, event flow only)"], replaces: [],
    headButton: null, primary: "Done (returns to the layer the flow started from; closes the stack when it was opened alone)", quiet: "Add to calendar (a downloaded .ics file; service and event flows)",
    status: "built", statusNote: "Reads the flow in ctx. Titles: You're booked, You're coming, Order placed, You're subscribed, You're following.", flows: ["service", "event", "artwork", "series", "profile"], sandbox: { key: "thread:evt", flow: "evt" },
  },
  {
    id: "follow", name: "Follow", gk: "fol", forWhat: "Follow a person or organisation by email with one field.",
    file: LF, component: "Follow",
    openedBy: ["Top bar + Follow (every template)", "pf-owner / pf-guest primary", "Hover profile card Follow", "PersonName in a surface"], pushes: ["done (flow fol)"], replaces: [],
    headButton: null, primary: "Follow", quiet: null,
    status: "built, backend sample-only", statusNote: "Calls SurfaceActions.follow. Sandbox answers ok.", flows: ["profile"], sandbox: { key: "owner", flow: "fol" },
  },
  {
    id: "share", name: "Share", gk: "share", forWhat: "Copy the link that reopens this offer's layer over the page, or copy an iframe embed.",
    file: LF, component: "Share",
    openedBy: ["Head button ↗ Share on evt-offer, svc-offer, art-offer, ser-offer, ser-session"], pushes: [], replaces: [],
    headButton: null, primary: "Copy link (an Embed chip copies an iframe tag)", quiet: null,
    status: "built", statusNote: "Real: uses the clipboard and the page URL; no backend.", flows: ["event"], sandbox: { key: "thread:evt" },
  },
  {
    id: "pf-owner", name: "Profile (site owner)", gk: "pf", forWhat: "The site owner's profile: bio, links, every offer and piece of writing, follow.",
    file: LF, component: "ProfileLayer",
    openedBy: ["Owner's name anywhere (PersonName, host rows, author names)", "Top bar + Follow once already following", "A shared link"],
    pushes: ["follow (primary, when not following)", "evt-offer / svc-offer / art-offer / ser-offer (the offer rows)", "wr-read (the writing rows)"], replaces: [],
    headButton: null, primary: "Follow, or ✓ Following (unfollows in place, no push)", quiet: null,
    status: "built, backend sample-only", statusNote: "Unfollow calls SurfaceActions.follow in place. Rows are drawn from data.featured and data.offers.", flows: ["profile"], sandbox: { key: "owner" },
  },
  {
    id: "pf-guest", name: "Profile (co-host)", gk: "pf", forWhat: "A co-host or guest who has a site of their own: bio, links, the offers they host here.",
    file: LF, component: "ProfileLayer (guest)",
    openedBy: ["A co-host's name (PersonName; profileLayerFor picks this when the person has a siteHref)", "A shared link"],
    pushes: ["follow (primary)", "the offer layers (the Here cards)"], replaces: [],
    headButton: "⤢ Their site (only when the person has a siteHref)", primary: "Follow, or ✓ Following", quiet: null,
    status: "built, backend sample-only", statusNote: "Same component as pf-owner with kicker Co-host. The Here cards list offers whose hostId or coHostIds name the person.", flows: ["profile"], sandbox: { key: "guest" },
  },
  {
    id: "wr-read", name: "Reading", gk: "wr", forWhat: "Reads a piece of writing in a popup, with an index and the next piece.",
    file: LR, component: "WrRead",
    openedBy: ["Writing templates: other pieces, index", "Profile writing shelf and rows", "A gateway face of a writing piece", "pf-owner writing rows"],
    pushes: ["talk (primary)", "a profile layer when a name is tapped"], replaces: ["wr-read (Next ›, and a pick from the In this series index, swap the piece in place)"],
    headButton: "Aa + / Aa − (text size)", primary: "Open the talk", quiet: "Next ›",
    status: "built", statusNote: "Draws data.pieces (TemplateData). A host that passes only SurfaceSiteData has no pieces, so the layer has nothing to read.", flows: ["writing"], sandbox: { key: "thread:w3" },
  },
  {
    id: "talk", name: "Talk", gk: "talk", forWhat: "The conversation under a piece: anyone reads, a box to reply.",
    file: LR, component: "Talk",
    openedBy: ["wr-read primary", "done (event flow) Talk row", "Event template: Talk · n"], pushes: ["a profile layer when a name is tapped"], replaces: [],
    headButton: null, primary: "Post", quiet: null,
    status: "built, nothing is sent", statusNote: "Posting adds a reply to local state only ('no action is wired', layers-read.tsx). Comments shown are the piece's replies or three seed lines. The board says lane S now keys Talk on exactly the piece or offer that opened it (an event's Talk used to show a writing piece's comments); this lane did not re-test that.",
    flows: ["writing"], sandbox: { key: "thread:w3" },
  },
  {
    id: "ser-offer", name: "Series", gk: "ser", forWhat: "Explains a recurring series: when, where, the next session and earlier ones.",
    file: LS, component: "SeriesOffer",
    openedBy: ["Series template", "A gateway face or a profile card of a series", "pf-guest Here cards"], pushes: ["ser-sub (primary)", "ser-session (the next-session card and earlier rows)", "share (head button)", "a profile layer (host names)"], replaces: [],
    headButton: "↗ Share", primary: "Subscribe", quiet: null,
    status: "built", statusNote: "Sessions come from offer.extras.sessions when given, otherwise from a weekly rhythm worked out from when.start (layers-series.tsx).", flows: ["series"], sandbox: { key: "thread:ser" },
  },
  {
    id: "ser-sub", name: "Subscribe", gk: "ser", forWhat: "Follow a series: one email before each session.",
    file: LS, component: "SeriesSub",
    openedBy: ["ser-offer primary", "Series template: Subscribe"], pushes: ["done (flow ser)"], replaces: [],
    headButton: null, primary: "Subscribe", quiet: null,
    status: "built, nothing is sent", statusNote: "SurfaceActions has no subscribe call yet: the layer checks the email and goes straight to done. Nothing is stored or sent.", flows: ["series"], sandbox: { key: "thread:ser" },
  },
  {
    id: "ser-session", name: "Session", gk: "ser", forWhat: "One session of a series: its date, host names and an I'm coming.",
    file: LS, component: "SeriesSession",
    openedBy: ["ser-offer next-session card and earlier rows", "Series template: next-session card and session rows"], pushes: ["evt-rsvp (primary, only for an upcoming session; flow evt on the series key)", "share (head button)", "a profile layer (host names)"], replaces: [],
    headButton: "↗ Share", primary: "I'm coming (upcoming sessions only)", quiet: null,
    status: "built", statusNote: "The session number travels in ctx.slotId because OfferCtx has no session field.", flows: ["series"], sandbox: { key: "thread:ser" },
  },
  {
    id: "join", name: "Account (sign up)", gk: "fol", forWhat: "The one quick sign-up RSVP, Follow, Subscribe and Talk Post need (Decision 14): name, email, password; switches to sign-in.",
    file: "packages/cms-ui/src/offer-surface/layers-join.tsx", component: "Join",
    openedBy: ["evt-rsvp primary", "follow primary", "ser-sub primary", "talk Post", "all only while signed out and the host gives join or signIn"], pushes: [], replaces: [],
    headButton: null, primary: "Create account / Sign in", quiet: "I have an account / Make an account",
    status: "built", statusNote: "On success it pops itself and the layer below completes its action. A host answer of confirm shows 'Check your email to finish'. GUEST_RSVP = true in layers-join.tsx restores the guest-by-email forms. Sandbox: email starting taken / confirm / wrong gives the other answers.", flows: ["event", "series"], sandbox: { key: "thread:evt" },
  },
  {
    id: "pf-member", name: "Profile (member)", gk: "pf", forWhat: "A member who has no page of their own: what they said on this site.",
    file: LP, component: "MemberProfile",
    openedBy: ["A member's name in the talk (profileLayerFor picks this when the person has no siteHref and is not the owner)"], pushes: [], replaces: ["Primary returns to the nearest talk layer below it (stack.tsx useBackToTalk), else pops one"],
    headButton: null, primary: "Reply in the talk (returns to the nearest talk layer below it, else pops one)", quiet: null,
    status: "built", statusNote: "Replies come from the optional field data.memberReplies[personId], which is not in SurfaceSiteData. The sample site has no member; /offer-templates/t/people adds one.", flows: ["writing"], sandbox: { key: "guest" },
  },
];

/** Surface pieces that are not layer ids. */
export const surfaceParts: Array<{ name: string; file: string; component: string; what: string; opens: string }> = [
  { name: "Docked writing stage", file: LR, component: "WritingStage", what: "wr-read docked into a page: no close button, ‹ › between pieces, a strip of piece cards; Open the talk pushes talk onto the stage. Frames 3b (desktop) and 4c (phone).", opens: "Sandbox route /offer-templates/t/stage. Not placed on any template page; not in TEMPLATES." },
  { name: "Hover profile card", file: LP, component: "ProfileHoverCard", what: "Desktop-only card (frame 5d) shown after a pause on a name; Follow and Profile → buttons. A tap on a phone opens the profile layer directly.", opens: "Drawn by PersonName; hidden by @media (hover: none)." },
  { name: "Person name", file: LP, component: "PersonName", what: "A name that opens that person's profile layer (profileLayerFor) and shows the hover card on desktop. Use it wherever a person is named.", opens: "pf-owner / pf-guest / pf-member; Follow button opens follow." },
  { name: "Payment cancelled line", file: `${KIT}/cancelled.tsx`, component: "PaymentCancelledScope / PaymentCancelledNote", what: "The line an offer layer shows when the buyer comes back from a cancelled card page (?payment=cancelled); read once, then removed from the address.", opens: "OfferLayer.tsx wraps evt-offer, svc-offer and art-offer in it; OfferFrame draws the note at the top of the body (added by lane P)." },
  { name: "Frame (head, body, foot)", file: `${KIT}/OfferFrame.tsx`, component: "OfferFrame", what: "The head (icon, kicker, title, one head button, crumb, close), scrolling body and foot (one primary, one quiet) every layer draws inside.", opens: "Props: gk, kicker, title, status, primary, quiet, headAction, picture, portrait, noThumb." },
];

// ── Flows ────────────────────────────────────────────────────────────────────

export interface FlowEntry {
  id: string;
  name: string;
  /** The main path, layer ids in order. `replace` marks a swap rather than a push. */
  steps: Array<OfferLayerId | "replace-wr-read">;
  /** Other paths through the same flow. */
  alternatives: Array<{ label: string; steps: OfferLayerId[] }>;
  /** The `OfferFlow` id the transaction layers read from ctx.flow, when there is one. */
  flowCtx: OfferFlow | null;
  source: string;
  note?: string;
}

const README_SRC = "design packet README, section A, Flows (storyboards 3c-3g, 4d-4h, 5e)";

export const flows: FlowEntry[] = [
  { id: "service", name: "Service", steps: ["svc-offer", "pay", "done"], alternatives: [], flowCtx: "svc", source: README_SRC },
  { id: "event", name: "Event", steps: ["evt-offer", "evt-rsvp", "done"], alternatives: [{ label: "or share the event", steps: ["evt-offer", "share"] }, { label: "paid event (code: layers.tsx, priced takeUp)", steps: ["evt-offer", "pay", "done"] }, { label: "after done, the Talk row (code: layers-flow.tsx)", steps: ["done", "talk"] }], flowCtx: "evt", source: `${README_SRC}; the paid and Talk paths are read from the code, not the README` },
  { id: "writing", name: "Writing", steps: ["wr-read", "replace-wr-read", "talk"], alternatives: [{ label: "a name in the talk opens a profile (README core rule 8)", steps: ["talk", "pf-member"] }], flowCtx: null, source: README_SRC, note: "wr-read to wr-read is a replace (Next ›), not a push; talk is pushed on top." },
  { id: "series", name: "Series", steps: ["ser-offer", "ser-sub", "done"], alternatives: [{ label: "or pick a session", steps: ["ser-offer", "ser-session", "evt-rsvp"] }], flowCtx: "ser", source: README_SRC },
  { id: "artwork", name: "Artwork", steps: ["art-offer", "art-order", "pay", "done"], alternatives: [], flowCtx: "art", source: README_SRC },
  { id: "profile", name: "Profile", steps: ["pf-owner", "follow", "done"], alternatives: [{ label: "a co-host's profile", steps: ["pf-guest", "follow", "done"] }], flowCtx: "fol", source: README_SRC, note: "After done the visitor is back on the profile, which now shows ✓ Following." },
];

/** What `ctx.flow` means (descriptor.ts OfferFlow, line 56). */
export const flowContext: Array<{ id: OfferFlow; meaning: string; line: number }> = [
  { id: "svc", meaning: "paying for or finishing a service booking", line: 87 },
  { id: "evt", meaning: "an event RSVP or a paid place", line: 87 },
  { id: "art", meaning: "an artwork order", line: 87 },
  { id: "ser", meaning: "a series subscription", line: 87 },
  { id: "fol", meaning: "a follow", line: 87 },
];

/** The rule for back, close and finish, written at the top of descriptor.ts ("THE STACK RULE", lane S, decision 20). */
export const stackRule: Array<{ action: string; result: string }> = [
  { action: "Crumb (‹ Previous title)", result: "pops one layer" },
  { action: "Esc", result: "pops one layer" },
  { action: "✕ and the dimmed page", result: "close the whole stack" },
  { action: "Done, on the done layer", result: "returns to the layer the flow started from (the nearest layer below that is not a step: evt-rsvp, art-order, pay, ser-sub, follow, done). A flow that began at the first layer returns to that offer (DONE_RETURNS_TO_ROOT_OFFER = true; false would close to the page). A stack of one (shared link, return from Stripe, hover-card Follow) has no origin, so Done closes." },
  { action: "Reply in the talk (member profile)", result: "returns to the nearest talk layer below it, else pops one" },
];

/** How a layer is addressed. */
export const addressing = {
  param: "?surface=offer:<layer>:<encoded key>[:<flow>]",
  example: "?surface=offer:svc-offer:thread%253Asvc",
  notes: [
    "Defined in descriptor.ts offerSurfaceValue (line 149) and parsed in packages/cms-ui/src/surface/url.ts (case \"offer\").",
    "The key holds a colon (thread:svc). A shared link carries it encoded once; typed into an address bar it needs encoding twice (thread%253Asvc), because the browser decodes the parameter once before url.ts splits on colons (board, lanes B2 and D2).",
    "Only the layer, key and flow reach the URL. Slot, amount, delivery and address live in memory (OfferCtx).",
  ],
};

// ── Tokens and type ──────────────────────────────────────────────────────────

export interface Token {
  group: string;
  name: string;
  /** Value as written in look.css. */
  value: string;
  use: string;
  /** Contrast note from look.css, when it has one. */
  contrast?: string;
}
const T = (group: string, name: string, value: string, use: string, contrast?: string): Token => ({ group, name, value, use, contrast });

/** From look.css lines 32-83; the contrast notes are its own comment (lines 15-26). */
export const tokens: Token[] = [
  T("Grounds", "--os-page", "#1b1e20", "the page"),
  T("Grounds", "--os-canvas", "#121416", "behind the page"),
  T("Grounds", "--os-surface", "#24282a", "popup and sheet panel"),
  T("Grounds", "--os-foot", "#1f2225", "popup foot, gateway strip"),
  T("Grounds", "--os-card", "#202326", "cards and rails"),
  T("Grounds", "--os-input", "#1b1e20", "fields"),
  T("Lines", "--os-line-strong", "#5a6064", "borders that matter, buttons"),
  T("Lines", "--os-line-mid", "#4a5054", "mid rules"),
  T("Lines", "--os-line-soft", "#373c3f", "page rules"),
  T("Lines", "--os-line-dotted", "#3d4246", "dotted rules, card borders"),
  T("Lines", "--os-line-faint", "#2c3033", "faintest rules"),
  T("Ink", "--os-ink-bone", "#e9e5dd", "headings and main text", "11.84 on surface, 13.34 on page (AAA)"),
  T("Ink", "--os-ink-body", "#d6d1c7", "body text", "9.78 / 11.02 (AAA)"),
  T("Ink", "--os-ink-2", "#c9c4ba", "second-level text", "8.56 / 9.65 (AAA)"),
  T("Ink", "--os-ink-muted", "#a3a09a", "secondary lines", "5.70 / 6.43 (AA)"),
  T("Ink", "--os-ink-faint", "#8f8c86", "metadata, 13px and up, on the page ground only", "4.44 on surface FAILS AA body; 5.00 on page passes"),
  T("Ink", "--os-ink-placeholder", "#6f6c67", "placeholder and disabled text only", "2.84 / 3.21: never body text"),
  T("Accents", "--os-bronze", "#c8a45b", "the accent: primary button, rules, active states", "7.12 on page, 6.32 on surface (AA)"),
  T("Accents", "--os-on-bronze", "#1b1e20", "text on bronze", "7.12 on bronze"),
  T("Accents", "--os-terracotta", "#ce8b62", "roles and event"),
  T("Accents", "--os-sage", "#8da882", "service and done"),
  T("Kind colours", "--os-kind-event", "#ce8b62", "event"),
  T("Kind colours", "--os-kind-service", "#8da882", "service"),
  T("Kind colours", "--os-kind-series", "#8ea7c2", "series"),
  T("Kind colours", "--os-kind-artwork", "#c48fa6", "artwork"),
  T("Kind colours", "--os-kind-writing", "#c8a45b", "writing"),
  T("Kind colours", "--os-kind-talk", "#7fafa8", "talk"),
  T("Kind colours", "--os-kind-profile", "#d9cfbf", "profile"),
  T("Kind colours", "--os-kind-share", "#c8a45b", "share"),
  T("Kind colours", "--os-kind-follow", "#c8a45b", "follow"),
  T("Kind colours", "--os-kind-done", "#8da882", "done"),
  T("Other", "--os-placeholder", "repeating-linear-gradient(135deg, #202427 0 7px, #262b2e 7px 8px)", "empty picture slot"),
  T("Other", "--os-shadow-popup", "0 30px 60px -24px rgba(0, 0, 0, 0.85)", "popup shadow"),
  T("Other", "--os-shadow-sheet", "0 -18px 40px -10px rgba(0, 0, 0, 0.7)", "phone sheet shadow"),
  T("Other", "--os-shadow-hover", "0 14px 24px -14px rgba(0, 0, 0, 0.8)", "card hover shadow"),
  T("Other", "--os-mono", "\"JetBrains Mono\", ui-monospace, monospace", "always the mono face (8 to 9.5px, tracked)"),
];

export interface FontTemplate {
  id: "para" | "gazette" | "quiet" | "marquee" | "ledger" | "rite";
  name: string;
  /** --fh heading, --fb body, --fq quote, --fu buttons/labels, --fk kicker */
  heading: string;
  body: string;
  quote: string;
  ui: string;
  kicker: string;
  /** --fhx heading scale, --fhw heading weight, --fhi heading style, --fht heading case */
  scale: number;
  weight: number;
  headingStyle: string;
  headingCase: string;
  note?: string;
}
/** From look.css lines 85-210 (the [data-ft] rules). */
export const fontTemplates: FontTemplate[] = [
  { id: "para", name: "Para", heading: "Fraunces", body: "Spectral", quote: "Fraunces (italic)", ui: "Spectral 600, uppercase", kicker: "Spectral", scale: 1, weight: 600, headingStyle: "normal", headingCase: "none", note: "the default" },
  { id: "gazette", name: "Gazette", heading: "Libre Caslon Display", body: "Libre Caslon Text", quote: "Libre Caslon Text (italic)", ui: "IBM Plex Sans Condensed 600, uppercase", kicker: "IBM Plex Sans Condensed", scale: 1.1, weight: 400, headingStyle: "normal", headingCase: "none" },
  { id: "quiet", name: "Quiet", heading: "Instrument Sans", body: "Instrument Sans", quote: "Instrument Serif (italic)", ui: "Instrument Sans 600", kicker: "Instrument Sans", scale: 0.95, weight: 500, headingStyle: "normal", headingCase: "none" },
  { id: "marquee", name: "Marquee", heading: "Big Shoulders Display", body: "Archivo", quote: "Archivo (italic)", ui: "Archivo 700, uppercase", kicker: "Archivo", scale: 1.3, weight: 800, headingStyle: "normal", headingCase: "uppercase", note: "the wide one: test every layout with it" },
  { id: "ledger", name: "Ledger", heading: "Newsreader", body: "IBM Plex Sans", quote: "Newsreader (italic)", ui: "IBM Plex Mono 500, uppercase", kicker: "IBM Plex Mono", scale: 1.02, weight: 500, headingStyle: "normal", headingCase: "none" },
  { id: "rite", name: "Rite", heading: "Cormorant Garamond", body: "EB Garamond", quote: "Cormorant Garamond (italic)", ui: "Marcellus 400, uppercase", kicker: "Marcellus", scale: 1.22, weight: 500, headingStyle: "italic", headingCase: "none", note: "the italic one" },
];

export interface CssRule {
  id: string;
  rule: string;
  where: string;
}
export const cssRules: CssRule[] = [
  { id: "prefixes", rule: "Two class prefixes. osf- is the surface kit: the popups, sheets and page pieces (offer.css and layers-*.css; sub-prefixes osf-rd-, osf-tk-, osf-stage-, osf-ser-, osf-pm-). ost- is the page templates: ost-page, ost-main, ost-top, ost-gate (shell.css) and ost-<id>-* in each template's css. Some templates shorten the id: ost-doc-, ost-gaz-, ost-pf-.", where: "offer.css head comment; templates/shell.css head comment" },
  { id: "scope", rule: "Everything is scoped under .osf-root (the OfferSurfaceRoot wrapper, which also carries .eac-offer and the data-ft, data-tint and data-mark switches). Surfaces opened from an offer page are dark and square; every other site's surfaces are unchanged.", where: "offer.css lines 1-40" },
  { id: "tokens-only", rule: "Colours come only from the --os-* tokens and type only from the --f* variables, so all six font templates work. Square corners; round only avatars and radio dots. Plain CSS, no Tailwind in package files.", where: "BOARD.md section 3 (the contract); look.css" },
  { id: "button-reset", rule: ":where(.osf-root) button { font: inherit; color: inherit } sits at zero specificity, so any class that sets a button's font wins. A template does not need to re-scope its button rules under .ost-page.", where: "offer.css line 40" },
  { id: "ost-base", rule: "Desktop scale-up: each template sets a unitless --ost-base (its design width in px) on .ost-page[data-template=<id>]. The shell zooms the whole page by --ost-z = clamp(1, vw * 0.9 / base, 1.8), where vw is the window width floored to a step (640 to 1920) by media queries on .osf-root. Below 640px nothing scales. Under zoom a vh or dvh length is multiplied too, so divide it by --ost-z. Popups scale separately (--osf-pz, up to 1.25) and hang from a fixed top (--osf-top).", where: "templates/shell.css, the block headed 'Desktop scale-up'; offer.css lines 53-64" },
  { id: "fonts-link", rule: "Fonts load by a <link> that OfferSurfaceRoot renders, from OFFER_FONTS_HREF (fonts.ts), never by a CSS @import: a remote @import inside an imported stylesheet is dropped silently by the bundler, so only families the host happened to load were drawn.", where: "fonts.ts head comment; OfferSurfaceRoot.tsx; look.css line 29" },
  { id: "tsx-only", rule: "Every module in templates/ must be .tsx: the export map (package.json) turns @elkdonis/cms-ui/offer-templates/<name> into templates/<name>.tsx, and <name>.css into templates/<name>.css. look.css, offer.css and the layers-*.css files are reached through offer-surface.css only.", where: "packages/cms-ui/package.json exports; BOARD.md section 3" },
  { id: "breakpoints", rule: "Phone is under 640px: popups become bottom sheets and the shell stops scaling. A template's own rules switch at its own width (several drop their rail below 900px).", where: "offer.css (max-width: 640px blocks); shell.css" },
  { id: "weights", rule: "Weights follow the packet's markup, not how a screenshot looks. The only explicit weight in the surface markup is 600 on the Total row and the service step dots.", where: "BOARD.md, [M] Round 5 and [T] job 1" },
];

// ── Data contract ────────────────────────────────────────────────────────────

export interface ContractField {
  name: string;
  type: string;
  required: boolean;
  meaning: string;
  /** 1-based line in the interface's file where the field is declared. */
  line: number;
}
export interface ContractType {
  name: string;
  file: string;
  line: number;
  what: string;
  fields: ContractField[];
}
const F = (name: string, type: string, required: boolean, meaning: string, line: number): ContractField => ({ name, type, required, meaning, line });
const TYPES_TS = `${KIT}/types.ts`;
const TYPES_TSX = `${TPL}/types.tsx`;
const DESC_TS = `${KIT}/descriptor.ts`;

export const contract: ContractType[] = [
  {
    name: "SurfaceSiteData", file: TYPES_TS, line: 91, what: "Everything one single-page site needs to draw its page and surfaces. Passed to <OfferSurfaceRoot data>.",
    fields: [
      F("site", "{ orgId, slug, name, origin }", true, "which site this is; name is the site name in the top bar, origin builds share links", 92),
      F("owner", "SurfaceProfile", true, "the site owner (a person, organisation user or associated business)", 93),
      F("featured", "SurfaceOffer | null", true, "the one offer that has the page; null draws a page with no featured offer", 94),
      F("offers", "SurfaceOffer[]", true, "the other offers (the gateway and the profile cards); layers also look the featured one up by key", 95),
      F("writing", "SurfaceWritingPiece[]", true, "the writing shelf: lead piece and rows", 96),
      F("people", "Record<string, SurfaceProfile>", true, "everyone else who is named (co-hosts, authors, members), by id", 97),
      F("viewer", "{ signedIn, name?, email? } | null", true, "who is looking; null when signed out or unknown. Pre-fills RSVP, pay and follow", 98),
      F("look", "SurfaceLook", true, "the site's look settings", 99),
    ],
  },
  {
    name: "SurfaceOffer", file: TYPES_TS, line: 30, what: "One thing a visitor can take up: an event, service, series, artwork or piece of writing.",
    fields: [
      F("key", "string", true, "content key: thread:<id> or artwork:<id>", 32),
      F("kind", "OfferKind", true, "event | service | series | artwork | writing; picks the first layer (layerFor)", 33),
      F("title", "string", true, "the name", 34),
      F("standfirst", "string | null", false, "one-line lead", 35),
      F("description", "string | null", false, "sanitised HTML or plain text", 37),
      F("poster", "string | null", false, "picture url", 38),
      F("images", "string[]", false, "more pictures; the first is the fallback poster", 39),
      F("when", "{ start, end?, timeZone? } | null", false, "ISO times and an IANA zone", 41),
      F("venue", "{ name?, address?, online? } | null", false, "where, or online", 42),
      F("price", "Money | null", false, "amount in minor units (cents) and an ISO currency; absent means free or by enquiry", 43),
      F("sliding", "{ minMinor, maxMinor, stepMinor? } | null", false, "pay-what-you-can range, minor units", 45),
      F("takeUp", "TakeUp", true, "how a visitor takes it up: rsvp | pay | order | subscribe | enquire | none; decides the primary button", 46),
      F("capacity", "{ limit: number | null, coming } | null", false, "places; the layer says Full when coming reaches limit", 47),
      F("tags", "string[]", false, "short labels", 48),
      F("slots", "Array<{ id, start, label? }>", false, "services: up to three open times to pick from", 50),
      F("durationMinutes", "number | null", false, "length of a session", 51),
      F("artwork", "{ medium?, size?, edition?, shipping?, collect? } | null", false, "artwork details; shipping is Money, collect says collection is allowed", 53),
      F("hostId", "string", true, "who hosts or made it; opens their profile layer", 55),
      F("coHostIds", "string[]", false, "others hosting; each name opens that person's profile layer and hover card", 57),
      F("href", "string | null", false, "the offer's own public page (kept in the type; nothing on the page links to it any more)", 59),
      F("featured", "boolean", false, "true for the site's one featured offer", 61),
    ],
  },
  {
    name: "SurfaceProfile", file: TYPES_TS, line: 64, what: "A public identity: the owner, a co-host, an author or a member.",
    fields: [
      F("id", "string", true, "users.id of the identity", 66),
      F("name", "string", true, "display name", 67),
      F("role", "string | null", false, "a line under the name", 68),
      F("bio", "string | null", false, "a few sentences", 69),
      F("portrait", "string | null", false, "picture url", 70),
      F("links", "Array<{ label, href }>", false, "outside links (Website, Instagram, Email); these may leave the page", 71),
      F("followers", "number | null", false, "follower count", 72),
      F("following", "boolean | null", false, "the viewer already follows; null when signed out or unknown", 74),
      F("siteHref", "string | null", false, "the identity's own site; its presence makes profileLayerFor pick pf-guest", 76),
      F("directoryHref", "string | null", false, "their ArtDirect page", 78),
    ],
  },
  {
    name: "SurfaceWritingPiece", file: TYPES_TS, line: 81, what: "A piece of writing as the shelf and the surfaces know it (TemplatePiece adds the reading fields).",
    fields: [
      F("key", "string", true, "content key", 82),
      F("title", "string", true, "the title", 83),
      F("standfirst", "string | null", false, "lead line", 84),
      F("cover", "string | null", false, "cover picture url", 85),
      F("href", "string | null", false, "public page (not used to navigate)", 86),
      F("minutes", "number | null", false, "reading time", 87),
    ],
  },
  {
    name: "SurfaceLook", file: TYPES_TS, line: 103, what: "Site-level look, chosen in the hub by owners and guides. DEFAULT_LOOK (line 119) is para, things, inline, tint on.",
    fields: [
      F("font", "para | gazette | quiet | marquee | ledger | rite", true, "the font template (becomes data-ft)", 105),
      F("icons", "things | marks | stamps | glyph", true, "the icon set", 106),
      F("mark", "inline | thumb | box", true, "the phone head mark (becomes data-mark)", 108),
      F("tint", "boolean", true, "kind colours on, or every kind bronze (becomes data-tint)", 110),
      F("sheet", "natural | level", false, "phone sheet height: natural (each sheet takes the height it needs, the packet) or level (one high, level top edge while layers change); becomes data-sheet; default natural", 116),
    ],
  },
  {
    name: "TemplateData", file: TYPES_TSX, line: 64, what: "SurfaceSiteData plus the two things templates add. This is what every template takes as `data` and what passes straight to <OfferSurfaceRoot data>.",
    fields: [
      F("extras", "OfferExtras", true, "extras of the featured offer", 66),
      F("pieces", "TemplatePiece[]", true, "the featured piece first (reading templates), then the rest of the index", 68),
    ],
  },
  {
    name: "OfferExtras", file: TYPES_TSX, line: 19, what: "What an offer may carry beyond SurfaceOffer. All optional: a template draws nothing when a field is absent.",
    fields: [
      F("category", "string", false, "kicker beside the kind, e.g. Music, One to one (the board's decision 5 drops category for now)", 21),
      F("program", "Array<{ time, label }>", false, "event running order", 23),
      F("attendees", "Array<{ name, avatar? }>", false, "who is coming (the avatar stack)", 25),
      F("photos", "string[]", false, "From the night: guest photos; an empty string draws a placeholder", 27),
      F("talkCount", "number", false, "number shown on Talk · n", 28),
      F("map", "string | null", false, "map picture or link", 29),
      F("replyNote", "string", false, "e.g. Usually replies within a day", 31),
      F("facts", "Array<{ label, value, note? }>", false, "three facts in a ruled row: When, Where, Cost (announcement, series)", 33),
      F("ribbon", "string", false, "announcement ribbon text, e.g. New date added · 2 days ago", 35),
      F("sessions", "Array<{ n, title, when, next? }>", false, "series sessions, newest first", 37),
    ],
  },
  {
    name: "TemplatePiece", file: TYPES_TSX, line: 41, what: "A piece of writing with what the reading templates need (extends SurfaceWritingPiece).",
    fields: [
      F("series", "string | null", false, "name of the series it belongs to", 42),
      F("n", "number", false, "position in the series (3 of 8)", 44),
      F("total", "number", false, "size of the series", 45),
      F("date", "string | null", false, "ISO date", 47),
      F("authorId", "string | null", false, "a profile id; the author name opens that profile", 48),
      F("bodyHtml", "string | null", false, "sanitised HTML of the whole piece", 50),
      F("sections", "Array<{ id, title, html }>", false, "the same body in sections: they become the index", 51),
      F("pullQuote", "string | null", false, "the pull quote", 52),
      F("picture", "string | null", false, "a picture inside the piece", 53),
      F("caption", "string | null", false, "its caption", 54),
      F("tags", "string[]", false, "tag chips (note)", 55),
      F("replies", "Array<{ name, ago, text }>", false, "replies shown under a note, and the talk layer's comments", 56),
      F("version", "string | null", false, "document version, e.g. v1.2", 58),
      F("footnotes", "string[]", false, "document footnotes", 59),
      F("facts", "Array<{ label, value }>", false, "a facts row (document)", 60),
    ],
  },
  {
    name: "SurfaceActions", file: TYPES_TS, line: 129, what: "What the host page gives the surfaces to act. Each is a plain fetch to a route on the host; rights come from the session or the checkout, never from these arguments. The sandbox passes sampleActions (templates/sample.tsx line 230), which never leave the browser.",
    fields: [
      F("rsvp", "(offerKey, { going, name?, email?, remind? }) => Promise<ActionResult<{ follows? }>>", true, "free RSVP; `follows` names the org the visitor now follows when the RSVP made them a follower", 131),
      F("follow", "(profileId, { follow, email? }) => Promise<ActionResult<{ following }>>", true, "follow or unfollow", 132),
      F("checkout", "(CheckoutRequest) => Promise<ActionResult<{ url }>>", true, "start checkout through the content library; returns Stripe's hosted URL; the surface navigates there", 138),
    ],
  },
  {
    name: "CheckoutRequest", file: TYPES_TS, line: 142, what: "Body of POST /api/content/checkout (content library, CONTRACT v1.4).",
    fields: [
      F("key", "string", true, "content key of the offer", 143),
      F("quantity", "number", false, "how many", 144),
      F("amountMinor", "number", false, "pay-what-you-can amount, minor units, within the offer's sliding range", 146),
      F("slotId", "string", false, "the chosen service slot", 147),
      F("delivery", "ship | collect", false, "artwork delivery", 149),
      F("address", "string", false, "shipping address", 150),
      F("email", "string", false, "for the receipt when signed out", 151),
      F("returnTo", "string", true, "absolute URL on the calling site to come back to; the server checks its host", 153),
    ],
  },
  {
    name: "OfferCtx", file: DESC_TS, line: 92, what: "State handed from layer to layer. Lives in memory; only `flow` reaches the URL.",
    fields: [
      F("flow", "svc | evt | art | ser | fol", false, "what a transaction layer is paying for or finishing", 93),
      F("slotId", "string", false, "chosen service slot, or a series session number", 94),
      F("amountMinor", "number", false, "chosen sliding amount", 95),
      F("delivery", "ship | collect", false, "artwork delivery choice", 96),
      F("address", "string", false, "shipping address", 97),
      F("featured", "boolean", false, "the featured offer opened from the profile (kept in the type; the head button is Share now)", 99),
      F("follows", "string", false, "name of an org an RSVP also made the visitor a follower of", 101),
      F("from", "number", false, "depth (1-based) of the layer a flow started from; set on the done push so Done returns there", 103),
    ],
  },
  {
    name: "OfferProps", file: DESC_TS, line: 106, what: "What an offer layer receives (the props of the `offer` custom descriptor).",
    fields: [
      F("layer", "OfferLayerId", true, "which layer to draw", 107),
      F("key", "string", false, "offer key, or a profile id for pf-* and follow", 109),
      F("ctx", "OfferCtx", false, "state from the previous layer", 110),
    ],
  },
];

/** Fields the code reads that are not in any interface above. */
export const offContract: Array<{ path: string; where: string; meaning: string }> = [
  { path: "data.memberReplies[personId]", where: `${LP} (MemberReply, WithReplies)`, meaning: "optional: replies a member left on the site, { on, ago, text }[]; pf-member lists them" },
];

// ── Mounting ─────────────────────────────────────────────────────────────────

/** A short example of mounting one template, as text (the Catalogue view and the JSON both carry it). */
export function mountExample(e: TemplateEntry): string {
  const id = e.info.id;
  return [
    `import "@elkdonis/cms-ui/offer-surface.css";`,
    `import "@elkdonis/cms-ui/offer-templates/shell.css";`,
    `import "@elkdonis/cms-ui/offer-templates/${id}.css";`,
    `import { OfferSurfaceRoot, type SurfaceActions } from "@elkdonis/cms-ui/offer-surface";`,
    `import { ${e.meta.component} } from "@elkdonis/cms-ui/offer-templates/${id}";`,
    `import type { TemplateData } from "@elkdonis/cms-ui/offer-templates/types";`,
    ``,
    `// data: TemplateData (SurfaceSiteData + extras + pieces); actions: SurfaceActions`,
    `export function Page({ data, actions }: { data: TemplateData; actions: SurfaceActions }) {`,
    `  return (`,
    `    <OfferSurfaceRoot data={data} actions={actions}>`,
    `      <${e.meta.component} data={data} />`,
    `    </OfferSurfaceRoot>`,
    `  );`,
    `}`,
  ].join("\n");
}

/** Sandbox link that opens a layer over a template page. Key is double-encoded as url.ts needs. */
export function layerSandboxPath(l: LayerEntry, host: string = "profile"): string {
  const key = encodeURIComponent(encodeURIComponent(l.sandbox.key));
  return `${sandboxPath(host)}?surface=offer:${l.id}:${key}${l.sandbox.flow ? `:${l.sandbox.flow}` : ""}`;
}

// ── The whole thing ──────────────────────────────────────────────────────────

const GENERATED_FROM = [
  ...templateEntries.map((e) => e.meta.files.tsx.replace(/\.tsx$/, ".meta.tsx")),
  `${TPL}/shell.meta.tsx`,
  `${TPL}/types.tsx`,
  `${TPL}/meta.tsx`,
  `${TPL}/sample.tsx`,
  `${TPL}/shell.css`,
  TYPES_TS,
  DESC_TS,
  `${KIT}/OfferLayer.tsx`,
  `${KIT}/OfferSurfaceRoot.tsx`,
  `${KIT}/OfferFrame.tsx`,
  `${KIT}/stack.tsx`,
  `${KIT}/cancelled.tsx`,
  L,
  LF,
  LR,
  LS,
  LP,
  `${KIT}/look.css`,
  `${KIT}/offer.css`,
  `${KIT}/fonts.ts`,
  "packages/cms-ui/src/surface/url.ts",
  "packages/cms-ui/package.json",
  "docs/open/OFFER_SURFACES_2026-11-27/BOARD.md",
  "docs/open/OFFER_SURFACES_2026-11-27/DECISIONS.md",
  "apps/development/designs/publication-surfaces-2026-11-27/README.md",
];

export function buildCatalogue() {
  const repeated = patternGroups.filter((g) => g.repeated);
  return {
    schema: "offer-catalogue/1",
    checkedAt: CHECKED_AT,
    about:
      "Catalogue of the free-tier single-offer site: eleven page templates, the surface layers (popups and sheets), the flows between them, the design tokens and the data contract. Templates and patterns are read from each template's own meta file; layers, flows, tokens and the contract are hand-written from the code on checkedAt and point at file and line.",
    generatedFrom: GENERATED_FROM,
    readme: `${KIT}/README.md`,
    summary: {
      templates: templateEntries.length,
      patterns: patternGroups.reduce((n, g) => n + g.uses.length, 0),
      distinctPatternIds: patternGroups.length,
      repeatedPatternIds: repeated.length,
      layers: layers.length,
      flows: flows.length,
      tokens: tokens.length,
      fontTemplates: fontTemplates.length,
      contractTypes: contract.length,
      contractFields: contract.reduce((n, t) => n + t.fields.length, 0),
    },
    problems,
    howToOpen: {
      sandboxTemplate: "/development/offer-templates/t/<template id>?ft=para|gazette|quiet|marquee|ledger|rite&icons=things|marks|stamps|glyph&tint=off&mark=inline|thumb|box",
      sandboxLayer: "/development/offer-templates/t/profile?surface=offer:<layer id>:<key encoded twice>[:<flow>]",
      gallery: "/development/offer-templates",
      catalogueView: "/development/offer-templates/catalogue",
    },
    templates: templateEntries.map((e) => ({
      id: e.info.id,
      name: e.info.name,
      kinds: e.info.kinds,
      blurb: e.info.blurb,
      packet: e.info.packet,
      status: e.meta.status,
      component: e.meta.component,
      files: e.meta.files,
      sandbox: `/development${e.sandbox}`,
      scaleBase: e.scaleBase,
      phoneHeight: e.meta.phoneHeight ?? null,
      counts: e.counts,
      reads: e.meta.reads,
      missing: e.meta.missing ?? [],
      actions: e.meta.actions,
      patterns: e.meta.patterns,
      adapted: e.meta.adapted,
      mount: mountExample(e),
    })),
    shell: { ...shellMeta, sandbox: "/development/offer-templates/t/probe" },
    patterns: patternGroups,
    lookAlikes,
    layers: layers.map((l) => ({ ...l, sandbox: { ...l.sandbox, path: `/development${layerSandboxPath(l)}` } })),
    surfaceParts,
    flows,
    flowContext,
    addressing,
    stackRule,
    tokens,
    fontTemplates,
    cssRules,
    contract,
    offContract,
  };
}

export type Catalogue = ReturnType<typeof buildCatalogue>;
