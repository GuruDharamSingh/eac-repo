// Harness: the Content hub card, round 2 (face, dark popup list in both scopes, the piece frame, an edit frame holding a
// stub form, and the suggestions dropdown) on hand-written sample data. No server: window.fetch answers /search and /suggest.
// Build and shoot: scripts/channel-harness/hub-content/README.md.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { HubCardMount } from "@elkdonis/hub/mount";
import { contentCard } from "/repo/packages/content/src/hub";
import type { ContentFaceData } from "/repo/packages/content/src/hub";
import type { ContentListItem } from "/repo/packages/content/src/model";

const art = (c: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="${c}"/><circle cx="120" cy="140" r="58" fill="rgba(255,255,255,.28)"/></svg>`)}`;

const mk = (id: string, title: string, tone: string, store: string, owner: string, sale: "for_sale" | "in_auction" | "sold" | "not_for_sale" | null, extra: Partial<ContentListItem> = {}): ContentListItem => ({
  key: `artwork:${id}`, type: "artwork", title, meta: "Oil on linen · 60 x 90 cm", excerpt: "", cover: art(tone), status: "published",
  siteIdentityId: "s1", siteName: store, siteHost: null, ownerIdentityId: "o1", ownerName: owner, series: null, createdAt: "2026-09-08", date: null,
  marks: [], note: { text: "Listed on Collect Art on Sep 8, then entered in an auction series.", motion: false }, timeline: [],
  links: { public: "https://example.org/art/" + id, studio: "#studio?id=" + id },
  sale: sale ? { state: sale, price: sale === "for_sale" ? "$2,400" : null } : null,
  storefront: { id: store, name: store }, images: [art(tone), art("#1d2026"), art("#262a31")],
  can: { edit: true, hide: true, publish: true, archive: false, pick: true }, ...extra,
});

const SITE = [
  mk("1", "Alien Goddess Moonstone Necklace", "#3b4252", "Dana McCool", "Dana McCool", "in_auction"),
  mk("2", "Alien Goddess Jade Necklace", "#24302a", "Dana McCool", "Dana McCool", "for_sale"),
  mk("3", "Alien Goddess Lapis Lazuli Necklace", "#1f2433", "Dana McCool", "Dana McCool", "for_sale"),
  mk("4", "Healing Coral Uranium Glass Necklace", "#5a3c2c", "Dana McCool", "Dana McCool", "for_sale"),
  mk("5", "Breaking Through", "#8f98ab", "Eric Brummel", "Eric Brummel", "in_auction"),
  mk("6", "Celadon Bowl", "#c9c1ae", "Katie the Potter", "Katie", "for_sale"),
  mk("7", "Ash Glaze Vase", "#a89f8c", "Katie the Potter", "Katie", "for_sale"),
  mk("8", "Study in Ochre", "#6b5640", "Guru Dharam Singh", "Guru Dharam Singh", null, { hidden: true }),
];
const NET = [
  mk("n1", "Mask of the Door", "#3d3348", "Paratheater", "Maya", null),
  SITE[4]!,
  mk("n2", "Winter Gathering", "#2c3a3f", "Inner Gathering", "Ro", null),
  SITE[0]!,
  mk("n3", "Nine Faces", "#3f2f2a", "Hidden Enneagram", "Ario", null),
  SITE[5]!,
  mk("n4", "Maple Leaf Study", "#5a4630", "Amrit Canada", "Jas", null),
  mk("n5", "Frame 3", "#2f3540", "IFAC", "Ivo", null),
].map((i) => ({ ...i, hidden: undefined }));

const facets = (items: ContentListItem[]) => ({
  types: { artwork: items.length },
  statuses: { published: items.length },
  stores: [...items.reduce((m, i) => m.set(i.storefront!.name, (m.get(i.storefront!.name) ?? 0) + 1), new Map<string, number>())].map(([name, count]) => ({ id: name, name, count })),
  sale: {},
});

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://x");
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (url.pathname.endsWith("/suggest")) {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const pieces = SITE.filter((i) => !q || i.title.toLowerCase().includes(q)).slice(0, q ? 5 : 6).map((i) => ({ key: i.key, title: i.title, type: "artwork", cover: i.cover }));
    return json({
      pieces,
      people: q ? [{ id: "u1", name: "Dana McCool", avatar: null }, { id: "u2", name: "Alma Reyes", avatar: null }].filter((p) => p.name.toLowerCase().includes(q)) : [],
      orgs: q ? [{ id: "g1", name: "Alien Arts Guild", logo: null }].filter((o) => o.name.toLowerCase().includes(q)) : [],
    });
  }
  if (url.pathname.endsWith("/search")) {
    const scope = url.searchParams.get("scope");
    let items = scope === "network" ? NET : scope === "site" ? SITE : SITE.slice(0, 3);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    if (q) items = items.filter((i) => i.title.toLowerCase().includes(q));
    return json({ items, nextCursor: null, facets: facets(items), missing: [] });
  }
  return realFetch(input);
}) as typeof window.fetch;

const data: ContentFaceData = {
  preset: {
    id: "artworks", title: "Artworks", scope: { kind: "site" }, view: "published", groupBy: "none", types: ["artwork"], includeHidden: true,
    scopes: { site: "Collect Art", network: "The collective" },
  },
  allowed: true,
  endpoints: { search: "/api/content/search", folders: null },
  sources: [], identities: [], timeZone: "UTC", siteName: "Collect Art",
  total: 14, byType: { artwork: 14 }, latest: SITE, actions: ["artwork-hide", "artwork-show"],
};

const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const log: string[] = [];
(window as unknown as { __log: string[] }).__log = log;

function Stub({ id, done, cancel }: { id: string; done: () => void; cancel: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); done(); }} style={{ display: "grid", gap: 14, maxWidth: 520 }} aria-label="Artwork form">
      <label style={{ display: "grid", gap: 6, fontSize: 15 }}>Title<input defaultValue={`Artwork ${id}`} style={{ height: 44, borderRadius: 6, border: "1px solid #474d57", background: "#23262c", color: "#f1ece2", padding: "0 12px", font: "15px Inter, sans-serif" }} /></label>
      <label style={{ display: "grid", gap: 6, fontSize: 15 }}>Price<input defaultValue="$2,400" style={{ height: 44, borderRadius: 6, border: "1px solid #474d57", background: "#23262c", color: "#f1ece2", padding: "0 12px", font: "15px Inter, sans-serif" }} /></label>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="hp-btn hp-primary">Save</button>
        <button type="button" className="hp-btn" onClick={cancel}>Cancel</button>
      </div>
    </form>
  );
}

function Driver() {
  React.useEffect(() => {
    const q = <T extends HTMLElement>(s: string) => document.querySelector(s) as T | null;
    const t: number[] = [];
    const at = (ms: number, fn: () => void) => t.push(window.setTimeout(fn, ms));
    if (page === "list-network") at(500, () => q(".hp-seg button:nth-child(2)")?.click());
    if (page === "piece" || page === "edit") at(500, () => q<HTMLElement>(".hp-tile")?.click());
    if (page === "edit") at(1100, () => q<HTMLElement>(".hp-foot-end button")?.click());
    if (page === "suggest") {
      at(500, () => {
        const i = q<HTMLInputElement>(".hp-search input")!;
        i.focus();
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        set.call(i, "al");
        i.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    return () => t.forEach(clearTimeout);
  }, []);
  return null;
}

function App() {
  return (
    <>
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto", background: "#23262c", minHeight: "100vh", color: "#f1ece2" }}>
        <h1 style={{ margin: "0 0 16px", fontFamily: "Georgia, serif", fontSize: 40 }}>Hub</h1>
        <div style={{ maxWidth: 760 }}>
          <HubCardMount
            card={contentCard}
            data={data}
            initialView={page === "face" ? "card" : "popup"}
            act={async (id, input) => { log.push(`act ${id} ${JSON.stringify(input)}`); return { ok: true } as never; }}
            refresh={() => log.push("refresh")}
            navigate={(h) => log.push(`navigate ${h}`)}
            host={{
              renderEdit: ({ key, onDone, onCancel }) => <Stub id={key} done={() => { log.push("edit done"); onDone(); }} cancel={onCancel} />,
            }}
          />
        </div>
      </main>
      <Driver />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
