// Harness: Studio Create (canvas A) and the piece summary (canvas C), 2026-11-14, on hand-written
// sample data. No server: Create's loader is a promise of the sample, the frame is a stub of
// StudioFrameApi, and the summary is fed its view directly. Build and shoot: README.md.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { StudioFrameContext, type StudioFrameApi } from "/repo/packages/studio/src/frame";
import { CreateKind } from "/repo/packages/studio/src/create/CreateKind";
import type { StudioCreateData } from "/repo/packages/studio/src/create/types";
import { PieceSummary } from "/repo/packages/content/src/summary/PieceSummary";
import type { PieceSummaryView } from "/repo/packages/content/src/summary/types";
import { makeIntoFor, makeIntoHref } from "/repo/packages/content/src/summary/make-into";

const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const dark = page.endsWith("-dark");

/** A flat picture as a data URI (harness only). */
const pic = (fill: string, mark = "#ffffff55") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${fill}"/><circle cx="200" cy="170" r="70" fill="${mark}"/></svg>`,
  )}`;

const ORGS = [
  { orgId: "larkspur", name: "Larkspur Ceramics", slug: "larkspur" },
  { orgId: "glaze-circle", name: "Glaze circle", slug: "glaze-circle" },
];

function frame(orgId: string): StudioFrameApi {
  return {
    orgId,
    orgs: ORGS,
    viewer: { userId: "u1", displayName: "Noa", slug: "noa" },
    setError: () => {},
    drawer: true,
    settings: true,
    sheet: null,
    setSheet: () => {},
    actionsSlot: null,
    statusSlot: null,
    newRequest: 0,
    colTab: "list",
    setColTab: () => {},
    kindIndex: [
      { id: "writing", label: "Writing", current: false },
      { id: "create", label: "Create", current: true },
      { id: "video", label: "Video", current: false },
      { id: "post", label: "Posts", current: false },
      { id: "meeting", label: "Meetings", current: false },
    ],
    switchKind: (k) => console.log("switchKind", k),
    setHasColumn: () => {},
    dark,
    query: "",
  };
}

const CREATE: StudioCreateData = {
  library: [
    { key: "thread:t1", type: "writing", typeLabel: "Writing", title: "The second firing", meta: "4 pictures", cover: pic("#d9c6ae"), status: "published", date: "2026-11-03T15:00:00Z" },
    { key: "thread:t2", type: "meeting", typeLabel: "Meeting", title: "Glaze lab · November", meta: "8 coming", cover: pic("#9fb7a4"), status: "published", date: "2026-11-19T23:30:00Z" },
    { key: "thread:t3", type: "meeting", typeLabel: "Meeting", title: "Glaze lab · December", meta: "", cover: null, status: "draft", date: "2026-12-03T23:30:00Z" },
    { key: "thread:t4", type: "video", typeLabel: "Video", title: "Inside the kiln", meta: "0:48", cover: pic("#3a3f4b", "#ffffff22"), status: "published", date: "2026-11-01T15:00:00Z" },
    { key: "artwork:a1", type: "artwork", typeLabel: "Artwork", title: "Ash bowl, 3 of 5", meta: "Stoneware, wood-ash glaze · $140", cover: pic("#c2562f"), status: "published", date: "2026-11-10T15:00:00Z" },
    { key: "artwork:a2", type: "artwork", typeLabel: "Artwork", title: "Bud vase, black", meta: "Stoneware · $60", cover: pic("#2b2b2b", "#ffffff22"), status: "draft", date: null },
    { key: "thread:t5", type: "writing", typeLabel: "Writing", title: "Notes on a celadon that went wrong, and what the test tiles said afterwards", meta: "", cover: null, status: "draft", date: null },
    { key: "thread:t6", type: "meeting", typeLabel: "Meeting", title: "Open studio night", meta: "14 coming", cover: pic("#bfa98d"), status: "published", date: "2026-10-28T23:00:00Z" },
  ],
  next: { kicker: "Fri · Instagram slot", title: "Weekly clip, day 4: record today’s clip", reason: "From the routine “Weekly clip”", href: "#", label: "Record" },
  nextMore: 3,
  material: [
    { id: "m1", kind: "file", title: "3 pictures", updatedAt: "2026-11-11T15:00:00Z" },
    { id: "m2", kind: "recording", title: "Talk recording, 2 Oct", updatedAt: "2026-10-02T15:00:00Z" },
  ],
  materialMore: 10,
  kit: { colors: ["#2e8a57", "#f1e7d6", "#3a2d20", "#c2562f"], fonts: ["Fraunces", "Work Sans"], editHref: "#" },
};

const EMPTY: StudioCreateData = { library: [], next: null, nextMore: 0, material: [], materialMore: 0, kit: { colors: [], fonts: [], editHref: null } };

const SUMMARY: PieceSummaryView = {
  key: "thread:t2",
  type: "meeting",
  typeLabel: "Meeting",
  byline: "Larkspur Ceramics · credited to Noa",
  title: "Glaze lab · November",
  excerpt: "An evening with the ash glazes: mixing, dipping, and loading the kiln for the second firing.",
  meta: "8 coming",
  pictures: [pic("#d9c6ae"), pic("#bfa98d"), pic("#a88e70")],
  pictureCount: 4,
  facts: [
    { label: "When", value: "Wed 19 Nov · 18:30" },
    { label: "Places", value: "8 of 12 · closes when it starts" },
    { label: "Hosts", value: "Noa" },
  ],
  status: { label: "published", at: "2026-11-03T15:00:00Z" },
  out: [
    { id: "o1", label: "Reminder the day before", sub: null, at: "2026-11-18T14:00:00Z", state: "scheduled", href: null },
    { id: "o2", label: "Letter to 46 followers", sub: "22 opened", at: "2026-11-06T15:00:00Z", state: "published", href: "#" },
    { id: "o3", label: "Instagram · @larkspur", sub: "41 likes", at: "2026-11-05T15:00:00Z", state: "published", href: "#" },
    { id: "o4", label: "Larkspur calendar and site", sub: null, at: "2026-11-03T15:00:00Z", state: "published", href: "#" },
  ],
  next: [
    { id: "n1", title: "Post a reminder on Instagram, 2 days before", reason: "Channel suggests · 17 Nov", label: "Plan it", href: "#" },
    { id: "n2", title: "The evening will be recorded: make a clip after", reason: "Make into · Clip", label: "Open", href: "#" },
  ],
  links: { view: "#", channel: "#", plan: "#" },
};

const BARE: PieceSummaryView = { ...SUMMARY, key: "artwork:a2", type: "artwork", typeLabel: "Artwork", title: "Bud vase, black", excerpt: null, pictures: [], pictureCount: 0, facts: [], meta: "Stoneware · $60", out: [], next: [], links: { view: null, channel: "#", plan: "#" } };

function StudioRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio" data-theme={dark ? "dark" : "light"}>
      <header className="studio-top">
        <span className="studio-wordmark">Studio</span>
      </header>
      {children}
    </div>
  );
}

const MARKS: NonNullable<PieceSummaryView["marks"]> = [
  { outlet: "site", state: "published", label: "Site" },
  { outlet: "instagram", state: "published", label: "Instagram" },
  { outlet: "facebook", state: "empty", label: "Facebook" },
  { outlet: "newsletter", state: "scheduled", label: "Letter" },
];

function makeInto(view: PieceSummaryView, org: string) {
  return makeIntoFor(view.type).map((t) => ({ ...t, href: makeIntoHref("/studio/make", view.key, t.to, org) }));
}

function App() {
  const base = page.replace(/-dark$/, "");
  if (base === "create" || base === "create-personal" || base === "create-loading") {
    const org = base === "create" ? "larkspur" : "oad";
    const load = base === "create-loading" ? () => new Promise<StudioCreateData | null>(() => {}) : async () => (base === "create" ? CREATE : EMPTY);
    return (
      <StudioRoot>
        <StudioFrameContext.Provider value={frame(org)}>
          <CreateKind load={load} makeBase="/studio/make" channelBase="/channel" liveHref="/studio/broadcast" nextcloudHref="https://cloud.example" />
        </StudioFrameContext.Provider>
      </StudioRoot>
    );
  }
  if (base === "summary" || base === "summary-bare") {
    const view = base === "summary" ? SUMMARY : BARE;
    return (
      <StudioRoot>
        <div className="ps-page">
          <PieceSummary view={view} onEdit={() => console.log("edit")} makeInto={makeInto(view, "larkspur")} channelLabel="Open in Larkspur Ceramics’s Channel" />
        </div>
      </StudioRoot>
    );
  }
  if (base.startsWith("popup")) {
    // The manage-piece pop-up over a site page (sunjay-like dark palette set on .ps, as a site would).
    const view = base === "popup-bare" ? BARE : { ...SUMMARY, marks: MARKS };
    const editing = base === "popup-edit";
    const btn = (label: string, primary = false) => (
      <button type="button" className={`ps-btn ps-btn--small${primary ? " ps-btn--primary" : ""}`}>
        {label}
      </button>
    );
    return (
      <div className="site-dark" style={{ background: "#1b1e20", color: "#e9e5dd", minHeight: "100vh", padding: 32, fontFamily: "Georgia, serif" }}>
        <h1 style={{ margin: 0, fontStyle: "italic" }}>Channel</h1>
        <p style={{ color: "#a3a09a" }}>The grid sits here; the pop-up opens over it.</p>
        <PieceSummary
          view={view}
          layout="popup"
          closeHref="#"
          editHref="#edit"
          editing={editing}
          closeEditHref="#"
          edit={
            <div style={{ background: "#fdfcf9", color: "#1c2128", borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
              <strong>Edit here · meeting, quick form</strong>
              <div style={{ background: "#eceae4", height: 34 }} />
              <div style={{ background: "#eceae4", height: 34 }} />
              <div style={{ background: "#eceae4", height: 70 }} />
              <a href="#">More options in Studio ↗</a>
            </div>
          }
          makeInto={makeInto(view, "sunjay")}
          studioHref="#studio"
          timeZone="America/Toronto"
          nextRows={[
            { id: "n1", title: "Post a reminder on Instagram, 2 days before", reason: "Mon 17 Nov · from the rule “remind before gatherings”", actions: <>{btn("Accept", true)}{btn("Plan it")}{btn("✕")}</> },
            { id: "n2", title: "Put it in the December letter", reason: "Not placed yet · 46 followers", actions: <>{btn("Accept", true)}{btn("✕")}</> },
          ]}
          outActions={{ o1: btn("Unplan") }}
          plan={
            base === "popup-bare"
              ? { state: "none", steps: [], actions: <>{btn("Start the plan", true)}{btn("Propose steps")}</> }
              : {
                  state: "started",
                  goal: "Fill the December lab: 12 places by the 1st.",
                  steps: [
                    { id: "s1", label: "Announce on the site and in the letter", done: true, due: "2026-11-03T15:00:00Z", control: <input type="checkbox" defaultChecked aria-label="Done" /> },
                    { id: "s2", label: "Instagram reminder, 2 days before", done: false, due: "2026-11-17T15:00:00Z", control: <input type="checkbox" aria-label="Done" /> },
                    { id: "s3", label: "Clip from the evening, the week after", done: false, control: <input type="checkbox" aria-label="Done" /> },
                  ],
                  actions: <>{btn("Add a step")}{btn("Propose steps")}</>,
                }
          }
        />
      </div>
    );
  }
  // A site's Board sheet: the site sets --ps-* on .ps in its own scope (katie-like palette).
  return (
    <div className="site" style={{ background: "#f6f0e6", minHeight: "100vh", padding: 24, display: "flex", justifyContent: "flex-end" }}>
      <aside className="site-sheet" style={{ width: "100%", maxWidth: 400, background: "#fffdf9", border: "1px solid #e6dccd", borderRadius: 16, overflow: "hidden" }}>
        <PieceSummary
          view={page === "sheet-bare" ? BARE : SUMMARY}
          layout="sheet"
          closeHref="#"
          actions={
            <>
              <button type="button" className="ps-btn">Edit here</button>
              <button type="button" className="ps-btn">Plan it</button>
              <a className="ps-btn" href="#">Open in Studio ↗</a>
            </>
          }
        >
          <p className="ps-mut" style={{ margin: "0 16px 16px" }}>The same summary as C, narrower and in the site’s look.</p>
        </PieceSummary>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
