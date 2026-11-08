// Harness: the real Channel components on a hand-written sample model (no
// database, no server). Sample names follow the design handoff's illustrative data.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ChannelFrame, useChannel } from "@/components/channel/ChannelFrame";
import { ChannelHome } from "@/components/channel/Home";
import { Queue } from "@/components/channel/Queue";
import { PieceBoard } from "@/components/channel/PieceBoard";
import { NewPost } from "@/components/channel/NewPost";
import { Outlets } from "@/components/channel/Outlets";
import { Routines } from "@/components/channel/Routines";
import { specFromSuggestion } from "@/components/channel/QuickSheet";
import { MATRIX_COLUMNS, COVERAGE_COLUMNS, type Cell, type ChannelModel, type Piece, type TimelineEntry, type DayView, type Suggestion } from "@/lib/channel/model";

const TZ = "America/Toronto";
const at = (d: string, t = "15:00") => new Date(`${d}T${t}:00Z`).toISOString();
const ME = "user:u1";
const EA = "org:elkdonis";
const empty = (): Cell => ({ state: "empty", at: null, label: null, href: null, suggestion: null });

function piece(p: Partial<Piece> & { key: string; title: string; kind: Piece["kind"]; timeline: TimelineEntry[] }): Piece {
  const row = Object.fromEntries(MATRIX_COLUMNS.map((c) => [c, empty()])) as Piece["row"];
  const map: Record<string, keyof Piece["row"]> = { site: "site", page: "site", market: "site", instagram: "instagram", facebook: "facebook", video: "video", writing: "writing", live: "live", newsletter: "newsletter" };
  for (const e of p.timeline) {
    const c = map[e.outlet];
    if (c) row[c] = { state: e.state, at: e.at, label: e.label, href: null, suggestion: null };
  }
  const coverage: Piece["coverage"] = {};
  for (const id of [ME, EA]) {
    coverage[id] = Object.fromEntries(COVERAGE_COLUMNS.map((c) => [c, empty()])) as Piece["coverage"][string];
    for (const e of p.timeline.filter((x) => x.identityId === id)) {
      const c = e.outlet === "page" ? "site" : e.outlet;
      if ((COVERAGE_COLUMNS as readonly string[]).includes(c)) coverage[id][c as "site"] = { state: e.state, at: e.at, label: e.label, href: null, suggestion: null };
    }
  }
  const out: Piece = {
    subject: { kind: p.key.startsWith("artwork") ? "artwork" : "thread", id: p.key.split(":")[1] },
    meta: "",
    excerpt: "",
    imageUrl: null,
    status: "published",
    ownerIdentityId: ME,
    presentedById: null,
    siteIdentityId: ME,
    siteName: "Your page",
    siteHost: "directory.arts-collective.com/guru-dharam",
    href: "https://directory.arts-collective.com/guru-dharam",
    studioHref: "/studio",
    createdAt: at("2026-10-20"),
    eventAt: null,
    row,
    coverage,
    suggestions: [],
    inMotion: null,
    plan: null,
    openTodos: 0,
    ...p,
  } as Piece;
  for (const s of out.suggestions) {
    const c = (s.outlet === "threads" ? "facebook" : s.outlet) as keyof Piece["row"];
    if (out.row[c] && out.row[c].state === "empty") out.row[c].suggestion = s;
    const cv = out.coverage[s.identityId]?.[s.outlet as "site"];
    if (cv && cv.state === "empty") cv.suggestion = s;
  }
  return out;
}
const tl = (id: string, d: string, outlet: TimelineEntry["outlet"], identityId: string, label: string, sub: string, state: TimelineEntry["state"] = "published"): TimelineEntry => ({ id, at: at(d), outlet, identityId, label, sub, state, href: null, deliveryId: null });
const sug = (pieceKey: string, outlet: Suggestion["outlet"], identityId: string, chip: string, text: string, reason: string, when: string | null, routineId: string | null = null): Suggestion => ({ id: `${pieceKey}|${outlet}|${identityId}`, pieceKey, outlet, identityId, chip, text, reason, at: when ? at(when, "15:00") : null, routineId });

const salt = piece({
  key: "artwork:salt",
  title: "Salt Marsh, Low Tide",
  kind: "artwork",
  meta: "Oil on linen · 60 × 90 cm · $2,400",
  excerpt: "Painted over three mornings at the edge of the marsh, when the water pulls back far enough to walk out.",
  presentedById: EA,
  timeline: [
    tl("s1", "2026-10-28", "page", ME, "Added to your page", "directory.arts-collective.com/guru-dharam"),
    tl("s2", "2026-10-28", "instagram", ME, "Posted to Instagram", "Instagram · @guru.dharam"),
    tl("s3", "2026-10-28", "market", ME, "Listed for sale · $2,400", "market.arts-collective.com"),
    tl("s4", "2026-10-28", "site", EA, "On Elkdonis Arts Collective", "elkdonis-arts.org/pieces/salt-marsh"),
    tl("s5", "2026-10-29", "facebook", EA, "Shared to Facebook", "Facebook · Elkdonis Arts Collective"),
    tl("s6", "2026-11-05", "video", ME, "Studio walk-through", "Video · not published", "draft"),
    tl("s7", "2026-11-12", "writing", ME, "On painting the marsh", "Writing · scheduled for Thu 9 AM", "scheduled"),
  ],
  suggestions: [
    sug("artwork:salt", "instagram", EA, "+ Share", "Post Salt Marsh, Low Tide to Instagram as Elkdonis Arts", "Fills your Friday Instagram slot", "2026-11-13", "r1"),
    sug("artwork:salt", "newsletter", EA, "+ Add", "Include Salt Marsh, Low Tide in the next letter", "Your letter routine", "2026-12-01"),
  ],
  inMotion: { reason: "Writing scheduled for Nov 12", at: at("2026-11-12") },
  plan: {
    id: "pl1",
    bodyMd: "## Goal\nFind a buyer before the open studio on Nov 21.\n\n## Dates\n- Nov 12 · On painting the marsh, on your page\n- Nov 21 · Open studio, the painting on the east wall\n\n## Steps\n- [x] Publish on your page, Instagram and the market <!-- on 2026-10-28 -->\n- [ ] Finish the walk-through video\n\n## Notes\nThe detail from the second morning photographs better than the whole painting.\n",
    createdAt: at("2026-11-05"),
    updatedAt: at("2026-11-06"),
    updatedByActor: "user",
    updatedByViewer: true,
  },
});
const field = piece({
  key: "artwork:field",
  title: "Field Notes, riso edition",
  kind: "product",
  meta: "Risograph · edition of 40 · $35",
  timeline: [tl("f1", "2026-10-14", "market", ME, "Listed for sale · $35", "market.arts-collective.com"), tl("f2", "2026-10-15", "instagram", ME, "Posted to Instagram", "Instagram"), { ...tl("f3", "2026-11-08", "live", ME, "Print pull, live", "Live · Sun 2 PM", "live") }],
  suggestions: [sug("artwork:field", "facebook", ME, "+ Share", "Share Field Notes, riso edition to Facebook", "Not on Facebook yet", null)],
  inMotion: { reason: "Goes live Sun 2 PM", at: at("2026-11-08", "19:00") },
});
const open = piece({
  key: "thread:open",
  title: "Open studio, November",
  kind: "meeting",
  meta: "Meeting · Sat Nov 21",
  ownerIdentityId: EA,
  siteIdentityId: EA,
  siteName: "Elkdonis Arts Collective",
  siteHost: "elkdonis-arts.org",
  eventAt: at("2026-11-21", "18:00"),
  timeline: [tl("o1", "2026-11-02", "site", EA, "Published in Gatherings", "elkdonis-arts.org/open-studio"), tl("o2", "2026-11-02", "facebook", EA, "Shared to Facebook", "Facebook"), { ...tl("o3", "2026-11-10", "instagram", EA, "Poster and caption", "Instagram · scheduled for Tue 10 AM", "scheduled") }],
  inMotion: { reason: "Instagram scheduled for Nov 10", at: at("2026-11-10") },
});
const circle = piece({
  key: "thread:circle",
  title: "Winter Reading Circle",
  kind: "series",
  meta: "Series · next Nov 12",
  excerpt: "Four Thursday evenings, one book, and time to talk about it. We start on Nov 12 at 7 PM.",
  ownerIdentityId: EA,
  siteIdentityId: EA,
  siteName: "Elkdonis Arts Collective",
  siteHost: "elkdonis-arts.org",
  eventAt: at("2026-11-13", "00:00"),
  timeline: [tl("c1", "2026-10-30", "site", EA, "Published in Series", "elkdonis-arts.org/winter-reading-circle"), tl("c2", "2026-11-03", "facebook", EA, "Shared to Facebook", "Facebook"), tl("c3", "2026-11-01", "newsletter", EA, "Emailed", "Email · 412 people")],
  suggestions: [sug("thread:circle", "instagram", EA, "+ Quote card", "Post Winter Reading Circle to Instagram as Elkdonis Arts", "Three days before Nov 12", "2026-11-09")],
  inMotion: { reason: "Starts Thu 7 PM", at: at("2026-11-13", "00:00") },
});
const letter = piece({
  key: "thread:letter",
  title: "Letter from the studio, No. 7",
  kind: "writing",
  meta: "Writing",
  timeline: [tl("l1", "2026-11-01", "page", ME, "Added to your page", "directory.arts-collective.com/guru-dharam/writing/letter-7"), tl("l2", "2026-11-01", "facebook", ME, "Shared to Facebook", "Facebook")],
  suggestions: [sug("thread:letter", "instagram", ME, "+ Quote card", "Post Letter from the studio, No. 7 to Instagram", "Not on Instagram yet", null)],
  inMotion: { reason: "Added to your page Nov 1", at: at("2026-11-01") },
});
const quiet = piece({ key: "artwork:tide", title: "Tidewater studies", kind: "series", meta: "Series · 6 works", timeline: [tl("t1", "2026-09-30", "page", ME, "Added to your page", "directory.arts-collective.com")] });

function days(from: string, n: number): DayView[] {
  const out: DayView[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(d).replace(/(\d+) (\w+)/, "$2 $1");
    out.push({ date, label, isToday: date === "2026-11-07", isTomorrow: date === "2026-11-08", items: [] });
  }
  return out;
}
const week = days("2026-11-07", 7);
const put = (date: string, item: DayView["items"][number]) => week.find((d) => d.date === date)?.items.push(item);
put("2026-11-08", { type: "post", id: "p1", pieceKey: "artwork:field", pieceTitle: "Field Notes", title: "Print pull, live", outlets: ["live"], at: at("2026-11-08", "19:00"), state: "live", stage: "Going live", routineName: "Go live", deliveryId: "d1", href: null });
put("2026-11-08", { type: "todo", id: "td1", text: "Set up the camera in the print room", done: false });
put("2026-11-09", { type: "todo", id: "td2", text: "Photograph the second Field Notes run", done: false });
put("2026-11-09", { type: "suggestion", id: "sg1", text: circle.suggestions[0]!.text, suggestion: circle.suggestions[0]! });
put("2026-11-10", { type: "post", id: "p2", pieceKey: "thread:open", pieceTitle: "Open studio", title: "Poster and caption", outlets: ["instagram"], at: at("2026-11-10"), state: "scheduled", stage: "Scheduled", routineName: "Instagram", deliveryId: "d2", href: null });
put("2026-11-12", { type: "event", id: "e1", pieceKey: "thread:circle", title: "Winter Reading Circle · 7 PM", at: at("2026-11-13", "00:00") });
put("2026-11-12", { type: "post", id: "p3", pieceKey: "artwork:salt", pieceTitle: "Salt Marsh", title: "On painting the marsh", outlets: ["site", "facebook"], at: at("2026-11-12", "14:00"), state: "draft", stage: "Draft", routineName: "Studio note", deliveryId: "d3", href: null });
put("2026-11-13", { type: "slot", id: "sl1", routineId: "r1", routineName: "Instagram", cadence: "Tuesdays and Fridays", outlet: "instagram", at: at("2026-11-13"), suggestion: salt.suggestions[0]! });

const base: ChannelModel = {
  ready: true,
  viewer: { userId: "u1", name: "Guru Dharam", initials: "GD", slug: "guru-dharam", isAdmin: false },
  scope: { kind: "artist" },
  orgs: [{ orgId: "elkdonis", name: "Elkdonis Arts Collective", slug: "elkdonis", role: "owner" }],
  identities: [
    { id: ME, kind: "user", name: "Guru Dharam", shortName: "You", initials: "GD", avatarUrl: null, orgId: null, siteName: "Your page", siteHost: "directory.arts-collective.com/guru-dharam", siteUrl: "https://directory.arts-collective.com/guru-dharam" },
    { id: EA, kind: "org", name: "Elkdonis Arts Collective", shortName: "Elkdonis Arts", initials: "EA", avatarUrl: null, orgId: "elkdonis", siteName: "Elkdonis Arts Collective", siteHost: "elkdonis-arts.org", siteUrl: "https://elkdonis-arts.org" },
  ],
  links: { hub: "/hub", studio: "/studio", site: "https://directory.arts-collective.com/guru-dharam", newsletter: "/email?org=elkdonis", connections: "/center?surface=me:connections", people: null, pages: null, template: null, identity: "/center?surface=me", writing: "/studio", video: "/studio?kind=video", meeting: "/studio?kind=meeting", series: null, artwork: "https://market.arts-collective.com/studio", live: "/studio/broadcast" },
  counts: { writing: 23, video: 6, artwork: 41, series: 3, meeting: 8, queue: 4, people: null },
  outlets: [
    { id: "site", label: "Website", connected: true, left: null, total: null, identityIds: [ME, EA], accounts: ["directory.arts-collective.com/guru-dharam"] },
    { id: "instagram", label: "Instagram", connected: true, left: 18, total: 25, identityIds: [ME, EA], accounts: ["@elkdonis.arts"] },
    { id: "facebook", label: "Facebook", connected: true, left: null, total: null, identityIds: [ME, EA], accounts: ["Elkdonis Arts Collective"] },
    { id: "threads", label: "Threads", connected: false, left: null, total: null, identityIds: [], accounts: [] },
    { id: "youtube", label: "YouTube", connected: false, left: null, total: null, identityIds: [], accounts: [] },
  ],
  nextLive: { at: at("2026-11-08", "19:00"), title: "Print pull" },
  pieces: [salt, field, open, circle, letter, quiet],
  routines: [
    { id: "r1", name: "Instagram", outlet: "instagram", cadence: "Tuesdays and Fridays", status: "1 of 2 this week · Friday open", tone: "open", source: "channel", rule: { weekdays: ["tue", "fri"], time: "10:00" } },
    { id: "r2", name: "Studio note", outlet: "writing", cadence: "Thursdays", status: "1 of 1 this week · booked", tone: "booked", source: "channel", rule: { weekdays: ["thu"], time: "09:00" } },
    { id: "r3", name: "Letter from the studio", outlet: "newsletter", cadence: "1st of the month", status: "Next Dec 1 · not started", tone: "quiet", source: "channel", rule: { monthDay: 1, time: "09:00" } },
    { id: "r4", name: "Go live", outlet: "live", cadence: "Second Sunday", status: "1 of 1 this week · booked", tone: "booked", source: "channel", rule: { nthWeekday: { n: 2, weekday: "sun" }, time: "14:00" } },
  ],
  week: { from: "2026-11-07", to: "2026-11-13", label: "Nov 7 – 13", days: week, prev: "2026-10-31", next: "2026-11-14" },
  tray: [
    { type: "draft", id: "tr1", label: "Draft · Video", title: "Studio walk-through", sub: "Salt Marsh, Low Tide", pieceKey: "artwork:salt", deliveryId: "d9", outlet: "video", chip: "Place it" },
    { type: "gap", id: "tr2", label: "Gap", title: "Field Notes is not on Facebook", sub: "In the shop since Oct 14", pieceKey: "artwork:field", suggestion: field.suggestions[0]!, chip: "Share" },
    { type: "gap", id: "tr3", label: "Gap", title: "Letter No. 7 is not on Instagram", sub: "Added Nov 1", pieceKey: "thread:letter", suggestion: letter.suggestions[0]!, chip: "Quote card" },
    { type: "note", id: "tr4", label: "Your note", title: "Write about how Field Notes was made", sub: "Added Oct 20", todoId: "t9", chip: "Start it in Studio" },
  ],
  timeZone: TZ,
  today: "2026-11-07",
  now: at("2026-11-07", "17:00"),
  notice: null,
};

function PickDriver() {
  React.useEffect(() => {
    const click = (sel: string, text?: string) => {
      const els = [...document.querySelectorAll(sel)] as HTMLElement[];
      const el = text ? els.find((e) => e.textContent?.includes(text)) : els[0];
      el?.click();
      return Boolean(el);
    };
    const log = (window as unknown as { __pick: string[] }).__pick = [];
    setTimeout(() => log.push("change:" + click("button", "Change")), 300);
    setTimeout(() => log.push("brick:" + click(".chn-brick", "Winter Reading Circle")), 900);
    setTimeout(() => log.push("use:" + click("button", "Use this piece")), 1400);
  }, []);
  return null;
}

function PublishDriver({ post }: { post: boolean }) {
  React.useEffect(() => {
    const click = (text: string) => ([...document.querySelectorAll("button")] as HTMLButtonElement[]).find((b) => b.textContent?.includes(text))?.click();
    setTimeout(() => click("Publish to"), 300);
    if (post) setTimeout(() => click("Post now"), 1000);
  }, [post]);
  return null;
}

function Opener({ what }: { what: string }) {
  const ch = useChannel();
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (what === "library" || what === "lightbox") ch.openLibrary("artwork:salt");
      if (what === "lightbox") setTimeout(() => (document.querySelector(".chn-brick") as HTMLButtonElement | null)?.click(), 300);
      if (what === "quick") ch.openQuick(specFromSuggestion(circle.suggestions[0]!, circle, "Instagram"));
      if (what === "adjust") ch.openAdjust(salt.suggestions[0]!);
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const page = (window as unknown as { __PAGE__: string }).__PAGE__;
if (page === "piece") history.replaceState(null, "", "?piece=artwork:salt");
if (page === "plan") history.replaceState(null, "", "?piece=artwork:salt&tab=plan");
const katie: ChannelModel = {
  ...base,
  scope: { kind: "org", orgId: "katie-the-potter", name: "Katie the Potter", slug: "katie-the-potter" },
  identities: [{ id: "org:katie-the-potter", kind: "org", name: "Katie the Potter", shortName: "Katie the Potter", initials: "KP", avatarUrl: null, orgId: "katie-the-potter", siteName: "Katie the Potter", siteHost: "pottery.arts-collective.com", siteUrl: "https://pottery.arts-collective.com" }],
  links: { ...base.links, site: "https://pottery.arts-collective.com", pages: "https://pottery.arts-collective.com/manage/site", people: "https://pottery.arts-collective.com/manage/people", template: null, store: "https://pottery.arts-collective.com/manage/pieces", identity: "/hub/organization?org=katie-the-potter", newsletter: "/email?org=katie-the-potter" },
  outlets: base.outlets.map((o) => (o.id === "site" ? { ...o, identityIds: ["org:katie-the-potter"], accounts: ["pottery.arts-collective.com"] } : { ...o, connected: false, left: null, identityIds: [], accounts: [] })),
  pieces: [
    piece({ key: "artwork:bowl", title: "Tenmoku tea bowl", kind: "artwork", meta: "Stoneware, tenmoku glaze · $85", ownerIdentityId: "org:katie-the-potter", siteIdentityId: "org:katie-the-potter", siteName: "Katie the Potter", siteHost: "pottery.arts-collective.com", href: "https://pottery.arts-collective.com/pieces/tenmoku-tea-bowl", timeline: [tl("k1", "2026-11-05", "market", "org:katie-the-potter", "Listed for sale · $85", "market.arts-collective.com"), tl("k2", "2026-11-05", "site", "org:katie-the-potter", "On Katie the Potter", "pottery.arts-collective.com/pieces/tenmoku-tea-bowl")] }),
    piece({ key: "artwork:jug", title: "Ash-glazed jug", kind: "artwork", meta: "Stoneware · $120", ownerIdentityId: "org:katie-the-potter", siteIdentityId: "org:katie-the-potter", siteName: "Katie the Potter", siteHost: "pottery.arts-collective.com", href: "https://pottery.arts-collective.com/pieces/ash-glazed-jug", timeline: [tl("k3", "2026-11-06", "market", "org:katie-the-potter", "Listed for sale · $120", "market.arts-collective.com")] }),
  ],
  routines: [],
  tray: [],
  week: { ...base.week, days: days("2026-11-07", 7) },
  counts: { ...base.counts, writing: 0, video: 0, artwork: 2, series: 0, meeting: 0, queue: 0, people: 3 },
  nextLive: null,
  orgs: [{ orgId: "katie-the-potter", name: "Katie the Potter", slug: "katie-the-potter", role: "owner" }],
};
const model: ChannelModel =
  page === "katie" ? katie : page === "empty"
    ? { ...base, ready: false, pieces: [], routines: [], tray: [], week: { ...base.week, days: days("2026-11-07", 7) }, counts: { ...base.counts, writing: 0, video: 0, artwork: 0, series: 0, meeting: 0, queue: 0 }, nextLive: null }
    : page === "month"
      ? { ...base, week: { ...base.week, from: "2026-11-01", to: "2026-12-05", label: "Nov 1 – Dec 5", days: (() => { const m = days("2026-11-01", 35); for (const d of week) { const x = m.find((y) => y.date === d.date); if (x) x.items = d.items; } return m; })() } }
      : base;

const body =
  page === "queue" || page === "month" ? (
    <Queue view={page === "month" ? "month" : "week"} editRoutines={false} />
  ) : page === "board" ? (
    <PieceBoard piece={salt} />
  ) : page === "newpost" || page === "newpost-pick" || page === "newpost-confirm" || page === "newpost-posted" ? (
    <>
      <NewPost about="artwork:salt" />
      {page === "newpost-pick" && <PickDriver />}
      {(page === "newpost-confirm" || page === "newpost-posted") && <PublishDriver post={page === "newpost-posted"} />}
    </>
  ) : page === "routines" ? (
    <Routines />
  ) : page === "outlets" || page === "outlets-live" ? (
    <Outlets tab={page === "outlets" ? "instagram" : "live"} />
  ) : (
    <>
      <ChannelHome view={page === "matrix" ? "matrix" : "list"} />
      {(page === "library" || page === "quick" || page === "lightbox" || page === "adjust") && <Opener what={page} />}
    </>
  );

createRoot(document.getElementById("root")!).render(
  <div className="chn">
    <ChannelFrame model={model} outletTab={page === "outlets" ? "instagram" : page === "outlets-live" ? "live" : null} active={page === "routines" ? "routines" : page === "outlets" || page === "outlets-live" ? "outlets" : page === "queue" || page === "month" ? "queue" : page === "newpost" || page === "newpost-pick" || page === "newpost-confirm" || page === "newpost-posted" ? "new" : page === "board" ? "piece" : page === "matrix" ? "matrix" : "home"}>
      {body}
    </ChannelFrame>
  </div>
);
