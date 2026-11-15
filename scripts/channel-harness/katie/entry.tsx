// Harness: katie-the-potter's Channel tabs (Queue, Board, Out; 2026-11-14) on a hand-written
// sample model. No server, no database: the site Channel door and next/* are stubbed.
// Build and shoot: scripts/channel-harness/katie/README.md.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MATRIX_COLUMNS, COVERAGE_COLUMNS, type Cell, type ChannelModel, type DayView, type Piece, type Suggestion, type TimelineEntry } from "@elkdonis/channel/model";
import { BoardTab, OutTab, PieceSummary, QueueTab } from "/repo/packages/channel/src/site/tabs";
import { channelNextMoves } from "/repo/packages/channel/src/next";
import { ChannelDoor } from "/repo/packages/channel/src/site/runs";
import { ChannelHome } from "/repo/packages/channel/src/site/home";
import type { SiteLinks } from "/repo/packages/channel/src/site/view";

const TZ = "America/Toronto";
const at = (d: string, t = "15:00") => new Date(`${d}T${t}:00Z`).toISOString();
const ORG = "org:katie-the-potter";
const empty = (): Cell => ({ state: "empty", at: null, label: null, href: null, suggestion: null });

function piece(p: Partial<Piece> & { key: string; title: string; kind: Piece["kind"]; timeline: TimelineEntry[] }): Piece {
  const row = Object.fromEntries(MATRIX_COLUMNS.map((c) => [c, empty()])) as Piece["row"];
  const coverage: Piece["coverage"] = { [ORG]: Object.fromEntries(COVERAGE_COLUMNS.map((c) => [c, empty()])) as Piece["coverage"][string] };
  return {
    subject: { kind: p.key.startsWith("artwork") ? "artwork" : "thread", id: p.key.split(":")[1] },
    meta: "",
    excerpt: "",
    imageUrl: null,
    status: "published",
    ownerIdentityId: ORG,
    presentedById: null,
    siteIdentityId: ORG,
    siteName: "Katie the Potter",
    siteHost: "pottery.arts-collective.com",
    href: "https://pottery.arts-collective.com/pieces/x",
    studioHref: null,
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
}
const tl = (id: string, d: string, outlet: TimelineEntry["outlet"], label: string, sub: string, state: TimelineEntry["state"] = "published", deliveryId: string | null = null): TimelineEntry => ({
  id,
  at: at(d),
  outlet,
  identityId: ORG,
  label,
  sub,
  state,
  href: state === "published" ? "https://example.invalid/" : null,
  deliveryId,
});
const sug = (pieceKey: string, outlet: Suggestion["outlet"], text: string, reason: string, when: string | null, routineId: string | null = null): Suggestion => ({
  id: `${pieceKey}|${outlet}|${ORG}`,
  pieceKey,
  outlet,
  identityId: ORG,
  chip: "+ Share",
  text,
  reason,
  at: when ? at(when) : null,
  routineId,
});

const bud = piece({
  key: "artwork:bud",
  title: "Bud vase, black",
  kind: "artwork",
  meta: "Stoneware · 14 × 8 cm · $85.00",
  status: "available",
  timeline: [
    tl("b1", "2026-11-06", "market", "Listed for sale · $85.00", "collect-art.com"),
    tl("b2", "2026-11-06", "site", "On Katie the Potter", "pottery.arts-collective.com/pieces/bud-vase-black"),
    tl("b3", "2026-11-18", "instagram", "Two pictures and the price", "Instagram · not published", "draft", "d1"),
  ],
  suggestions: [
    sug("artwork:bud", "facebook", "Post Bud vase, black to Facebook", "Not on Facebook yet", "2026-11-19"),
    sug("artwork:bud", "newsletter", "Put it in the December letter", "46 followers", null),
  ],
});
const ash = piece({
  key: "artwork:ash",
  title: "Ash bowl, 3 of 5",
  kind: "artwork",
  meta: "Stoneware, wood-ash glaze · 18 cm",
  status: "draft",
  timeline: [tl("a1", "2026-11-13", "market", "Draft listing", "Market · not listed", "draft")],
  suggestions: [sug("artwork:ash", "instagram", "Post it: two pictures and the price", "Fills your Thursday Instagram slot", "2026-11-20", "r2")],
});
const lab = piece({
  key: "thread:lab",
  title: "Glaze lab · December",
  kind: "meeting",
  plan: {
    id: "pl1",
    bodyMd: "## Goal\nFill the December lab, twelve places.\n\n## Steps\n- [x] Book the kiln <!-- on 2026-11-20 -->\n- [ ] Poster for the window\n- [ ] Announce on Instagram, 3 weeks before <!-- board --> <!-- on 2026-11-16 -->\n",
    createdAt: "2026-11-10T15:00:00Z",
    updatedAt: "2026-11-14T15:00:00Z",
    updatedByActor: "user",
    updatedByViewer: true,
  },
  eventAt: at("2026-12-03", "23:30"),
  status: "published",
  timeline: [
    tl("l1", "2026-11-10", "site", "Published in Calendar", "pottery.arts-collective.com/glaze-lab-december"),
    tl("l2", "2026-11-25", "newsletter", "December letter", "Letter · scheduled for Tue 10 AM", "scheduled", "d2"),
    tl("l3", "2026-11-14", "instagram", "Did not post to @katiethepotter", "token expired", "failed"),
  ],
  suggestions: [
    sug("thread:lab", "instagram", "Announce on Instagram, 3 weeks before", "From the rule “announce gatherings”", "2026-11-16"),
    sug("thread:lab", "facebook", "Reminder post, 2 days before", "From the rule “remind before gatherings”", "2026-12-01"),
  ],
});
const essay = piece({
  key: "thread:firing",
  title: "The second firing",
  kind: "writing",
  status: "published",
  timeline: [
    tl("e1", "2026-11-03", "site", "Published in Journal", "pottery.arts-collective.com/the-second-firing"),
    tl("e2", "2026-11-04", "facebook", "Shared to Facebook", "Facebook · 12 reactions"),
    tl("e3", "2026-11-06", "newsletter", "Emailed", "Email · 46 people"),
  ],
});
const prints = piece({
  key: "artwork:prints",
  title: "Second firing, prints",
  kind: "product",
  meta: "Giclée · 3 for sale",
  status: "available",
  timeline: [tl("p1", "2026-10-21", "market", "Listed for sale · $40.00", "collect-art.com"), tl("p2", "2026-10-21", "page", "On Katie's ArtDirect page", "directory.arts-collective.com/katie")],
});

function days(from: string, n: number): DayView[] {
  const out: DayView[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    out.push({ date, label: date.slice(8), isToday: i === 0, isTomorrow: i === 1, items: [] });
  }
  return out;
}
const week = days("2026-11-14", 7);
week[0].items.push({ type: "slot", id: "sl1", routineId: "r1", routineName: "Weekly clip", cadence: "Saturdays", outlet: "video", at: at("2026-11-14", "18:00"), suggestion: null });
// Items across the week, for the Queue's week view (2026-11-15).
week[1].items.push({ type: "post", id: "p1", pieceKey: bud.key, pieceTitle: bud.title, title: "Bud vase on Instagram", outlets: ["instagram"], at: at("2026-11-15", "10:00"), state: "scheduled", stage: "Scheduled", routineName: "Instagram", deliveryId: "d1", href: null });
week[2].items.push({ type: "event", id: "e1", pieceKey: "thread:lab", title: "Glaze lab, open evening", at: at("2026-11-16", "19:00") });
if (bud.suggestions[0]) week[3].items.push({ type: "suggestion", id: "s1", text: bud.suggestions[0].text, suggestion: bud.suggestions[0] });
week[4].items.push({ type: "todo", id: "t1", text: "Photograph the new mugs", done: false });
week[4].items.push({ type: "slot", id: "sl3", routineId: "r2", routineName: "Instagram", cadence: "Thursdays and Saturdays", outlet: "instagram", at: at("2026-11-18", "20:00"), suggestion: null });
week[0].items.push({ type: "slot", id: "sl2", routineId: "r2", routineName: "Instagram", cadence: "Thursdays and Saturdays", outlet: "instagram", at: at("2026-11-14", "20:00"), suggestion: bud.suggestions[0] ? { ...bud.suggestions[0], outlet: "instagram", text: "Post Bud vase, black to Instagram" } : null });

const L = "https://arts-collective.com";
const model: ChannelModel = {
  ready: true,
  viewer: { userId: "u1", name: "Katie", initials: "K", slug: "katie", isAdmin: false },
  scope: { kind: "org", orgId: "katie-the-potter", name: "Katie the Potter", slug: "katie-the-potter" },
  orgs: [{ orgId: "katie-the-potter", name: "Katie the Potter", slug: "katie-the-potter", role: "owner" }],
  identities: [{ id: ORG, kind: "org", name: "Katie the Potter", shortName: "Katie the Potter", initials: "KP", avatarUrl: null, orgId: "katie-the-potter", siteName: "Katie the Potter", siteHost: "pottery.arts-collective.com", siteUrl: "https://pottery.arts-collective.com" }],
  links: { hub: L, studio: L, site: null, newsletter: null, connections: L, people: null, pages: null, template: null, store: null, identity: null, writing: L, video: L, meeting: L, series: null, artwork: L, live: L },
  counts: { writing: 1, video: 0, artwork: 3, series: 0, meeting: 1, queue: 5, people: null },
  outlets: [
    { id: "site", label: "Website", connected: true, left: null, total: null, identityIds: [ORG], accounts: [] },
    { id: "instagram", label: "Instagram", connected: true, left: 24, total: 25, identityIds: [ORG], accounts: ["@katiethepotter"] },
    { id: "facebook", label: "Facebook", connected: false, left: null, total: null, identityIds: [], accounts: [] },
  ],
  nextLive: null,
  pieces: [lab, bud, ash, essay, prints],
  routines: [
    { id: "r1", name: "Weekly clip", outlet: "video", cadence: "Saturdays", status: "1 open", tone: "open", source: "channel", rule: { weekdays: ["sat"], time: "13:00" } },
    { id: "r2", name: "Instagram", outlet: "instagram", cadence: "Thursdays and Saturdays", status: "2 open", tone: "open", source: "channel", rule: { weekdays: ["thu", "sat"], time: "15:00" } },
  ],
  week: { from: "2026-11-14", to: "2026-11-20", label: "This week", days: week, prev: "2026-11-07", next: "2026-11-21" },
  tray: [],
  timeZone: TZ,
  today: "2026-11-14",
  now: at("2026-11-14", "20:00"),
  notice: null,
};

const links: SiteLinks = {
  tab: (t, extra = {}) => {
    const q = new URLSearchParams();
    if (t !== "home") q.set("tab", t);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    return `#/channel?${q.toString()}`;
  },
  studio: () => "#studio",
  makeInto: (f, t) => `#make-${f}-${t}`,
  network: (p) => `#net${p}`,
};

const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const tab = page.startsWith("home") ? "home" : page.startsWith("board") ? "board" : page.startsWith("out") ? "out" : page === "library" ? "library" : "queue";

function Clicker({ sel }: { sel: string }) {
  React.useEffect(() => {
    const t = setTimeout(() => (document.querySelector(sel) as HTMLElement | null)?.click(), 300);
    return () => clearTimeout(t);
  }, [sel]);
  return null;
}

const rowLinks = {
  manageHref: (p: { key: string }) => `#piece=${p.key}`,
  editHref: (p: { key: string }) => `#edit=${p.key}`,
  makeIntoHref: (p: { key: string }, to: string) => `#make=${p.key}:${to}`,
  networkHref: () => "#net",
};

/** The Library's cover cards, as page.tsx draws them (the page itself is a server component). */
function LibraryCards() {
  return (
    <ul className="kch-cards">
      {model.pieces.map((p) => (
        <li key={p.key}>
          <a className="kch-card-link" href={`#piece=${p.key}`}>
            {p.imageUrl ? <img className="kch-card-cover" src={p.imageUrl} alt="" /> : <span className="kch-card-band" data-type={p.kind} aria-hidden="true" />}
            <span className="kch-card-body">
              <span className="kch-eb">{p.kind}</span>
              <span className="kch-card-title">{p.title}</span>
              <span className="kch-fine">{p.status}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function App() {
  // Pages: board, board-cell (a cell's quick form open), board-summary, board-edit, queue (by week, routines
  // shown), queue-cell (an open routine slot's form), queue-piece, out, out-failed.
  const selected = page === "board-summary" || page === "board-edit" ? lab : null;
  const side = selected ? (
    <PieceSummary
      piece={selected}
      model={model}
      links={links}
      closeHref="#"
      editHref="#edit"
      closeEditHref="#"
      planHref="#plan"
      moves={channelNextMoves(model, { pieceKey: selected.key, limit: 4 }).map((m) => ({ id: m.id, kicker: m.kicker, title: m.title, reason: m.reason, run: m.run ?? null, openHref: m.href ? "#open" : null, openLabel: "Open in Channel" }))}
      editing={page === "board-edit"}
      edit={page === "board-edit" ? <div className="kch-card">[the site&rsquo;s quick form for this kind]</div> : null}
    />
  ) : null;
  return (
    <div className="kch kch--wide">
      <header className="kch-head">
        <h1 className="kch-title">Channel</h1>
        <div className="kch-actions">
          <details className="kch-menu kch-new" open={page === "queue-new"}>
            <summary className="kch-btn kch-btn--ghost">＋ New ▾</summary>
            <div className="kch-menu-list">
              <a href="#">Artwork, here</a>
              <a href="#">Post ↗</a>
              <a href="#">Gathering ↗</a>
              <a href="#">Video ↗</a>
              <a href="#">Writing ↗</a>
            </div>
          </details>
          <a className="kch-btn kch-btn--ghost" href="#">Open Studio ↗</a>
        </div>
      </header>
      <nav className="kch-tabs" aria-label="Channel">
        {["Home", "Board", "Queue", "Out", "Library"].map((t) => (
          <a key={t} className="kch-tab" href="#" aria-current={t.toLowerCase() === tab ? "page" : undefined}>
            {t}
            {t === "Queue" ? <span className="kch-n">5</span> : t === "Out" ? <span className="kch-n">1</span> : null}
          </a>
        ))}
      </nav>
      <div className="kch-body">
        {page.startsWith("home") ? (
          <ChannelHome
            model={model}
            links={links}
            moves={channelNextMoves(model, { limit: 8 }).map((m) => ({ id: m.id, kicker: m.kicker, title: m.title, reason: m.reason, run: m.run ?? null, openHref: m.href ? "#open" : null, openLabel: "Open in Channel" }))}
            movePieces={Object.fromEntries(channelNextMoves(model, { limit: 8 }).map((m) => [m.id, m.pieceKey ?? null]))}
            kind={null}
            piecesMode={page === "home-list" ? "list" : "covers"}
            boardMode={page === "home-week" ? "week" : "outlets"}
            rowLinks={rowLinks}
            routinesHref="#routines"
            orgQ="katie-the-potter"
          />
        ) : page === "library" ? (
          <LibraryCards />
        ) : tab === "out" ? (
          <OutTab model={model} links={links} outlet={null} failedOnly={page === "out-failed"} orgQ="katie-the-potter" />
        ) : (
          <div className="kch-split">
            {tab === "queue" ? (
              <QueueTab model={model} links={links} kind={null} view={page === "queue-piece" ? "piece" : "week"} focus={page === "queue-piece" ? "artwork:bud" : null} rowLinks={rowLinks} routinesHref="#routines" />
            ) : (
              <BoardTab model={model} links={links} kind={null} rowLinks={rowLinks} />
            )}
            {side}
          </div>
        )}
      </div>
      {page === "board-cell" ? <Clicker sel="tbody tr:nth-child(2) td:nth-child(5) .kch-cell" /> : null}
      {page === "queue-cell" ? <Clicker sel="td[data-routines] .kch-cell:not(:disabled)" /> : null}
      {page === "queue-kind" ? <Clicker sel="tbody tr:nth-child(4) td:nth-child(4) .kch-cell" /> : null}
    </div>
  );
}

const stubRun = async () => ({ ok: true as const });
createRoot(document.getElementById("root")!).render(
  <ChannelDoor run={stubRun}>
    <App />
  </ChannelDoor>,
);
