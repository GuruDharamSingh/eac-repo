// Harness: the publish primitives of @elkdonis/content/ui on sample data (no
// server, no Channel frame). Pages: kinds, popup, popup-lightbox, popup-empty,
// popup-phone, popup-plain, popup-dark, face, content, content-list,
// content-lightbox, content-phone, content-empty.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { ContentLibrary, KindStrip, PieceLightbox, PublishCardFace, PublishPopup } from "@elkdonis/content/ui";
import type { ContentEvent, ContentIdentity, ContentListItem, ContentMark, ContentOutlet, ContentState, ContentStatus, ContentType } from "@elkdonis/content/model";

const TZ = "America/Toronto";
const NOW = "2026-11-08T15:00:00Z";
const d = (day: string, t = "15:00") => new Date(`${day}T${t}:00Z`).toISOString();
const ME: ContentIdentity = { id: "user:u1", kind: "user", name: "Guru Dharam", shortName: "You", initials: "GD" };
const EA: ContentIdentity = { id: "org:elkdonis", kind: "org", name: "Elkdonis Arts Collective", shortName: "Elkdonis Arts", initials: "EA" };
const IDS = [ME, EA];

const OUTLETS: Array<[ContentOutlet, string]> = [["site", "Website"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["video", "Video"], ["writing", "Writing"], ["live", "Live"], ["newsletter", "Letter"]];
const marks = (m: Partial<Record<ContentOutlet, ContentState>>): ContentMark[] => OUTLETS.map(([o, label]) => ({ outlet: o, label, state: m[o] ?? "empty" }));
const ev = (id: string, day: string, outlet: ContentOutlet, state: ContentState, label: string, sub: string): ContentEvent => ({ id, at: d(day), lane: "site", source: "thread", verb: state, outlet, label, sub, state, identityId: null, href: null });

interface Seed { key: string; type: ContentType; title: string; meta?: string; excerpt?: string; status: ContentStatus; site?: ContentIdentity; date: string; created: string; m?: Partial<Record<ContentOutlet, ContentState>>; note?: string; motion?: boolean; series?: string; tl?: ContentEvent[]; cover?: boolean; statusNote?: string }

function mk(s: Seed): ContentListItem {
  const site = s.site ?? ME;
  return {
    key: s.key, type: s.type, title: s.title, meta: s.meta ?? "", excerpt: s.excerpt ?? "", cover: s.cover ? art(s.title) : null, status: s.status, statusNote: s.statusNote,
    siteIdentityId: site.id, siteName: site.kind === "user" ? "Your page" : site.name, siteHost: site.kind === "user" ? "directory.arts-collective.com/guru-dharam" : "elkdonis-arts.org",
    ownerIdentityId: ME.id, series: s.series ? { id: s.series.toLowerCase().replace(/\W+/g, "-"), name: s.series } : null,
    createdAt: d(s.created), date: d(s.date), marks: marks(s.m ?? {}), note: { text: s.note ?? (s.status === "draft" ? "Draft" : "Quiet since Sep 30"), motion: Boolean(s.motion) },
    timeline: s.tl ?? [], links: { public: s.status === "draft" ? null : "https://elkdonis-arts.org/p", studio: "/studio?id=1" },
  };
}

// A small inline "painting" so thumbnails and covers are not all empty.
function art(seed: string): string {
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><rect width="320" height="220" fill="hsl(${h} 18% 78%)"/><rect y="120" width="320" height="100" fill="hsl(${(h + 30) % 360} 22% 52%)"/><circle cx="220" cy="70" r="30" fill="hsl(${(h + 160) % 360} 30% 90%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SALT = mk({
  key: "artwork:salt", type: "artwork", title: "Salt Marsh, Low Tide", meta: "Oil on linen · 60 × 90 cm · $2,400", cover: true, status: "scheduled", date: "2026-11-12", created: "2026-10-28",
  excerpt: "Painted over three mornings at the edge of the marsh, when the water pulls back far enough to walk out.", m: { site: "published", instagram: "published", facebook: "published", video: "draft", writing: "scheduled" },
  note: "In motion · Writing scheduled for Nov 12", motion: true,
  tl: [ev("t1", "2026-10-28", "site", "published", "On Elkdonis Arts Collective", "elkdonis-arts.org/pieces/salt-marsh"), ev("t2", "2026-10-29", "facebook", "published", "Shared to Facebook", "Facebook · Elkdonis Arts Collective"), ev("t3", "2026-11-05", "video", "draft", "Studio walk-through", "Video · not published"), ev("t4", "2026-11-12", "writing", "scheduled", "On painting the marsh", "Writing · scheduled for Thu 9 AM")],
});

const RECENT: ContentListItem[] = [
  SALT,
  mk({ key: "thread:circle", type: "series", title: "Winter Reading Circle", status: "scheduled", site: EA, date: "2026-11-13", created: "2026-11-01", m: { site: "published", newsletter: "published" }, note: "In motion · First session Nov 13", motion: true, meta: "Six Thursdays · 7 PM" }),
  mk({ key: "thread:letter", type: "writing", title: "Letter from the studio, No. 7", status: "draft", date: "2026-11-07", created: "2026-11-06", meta: "Draft · 640 words" }),
  mk({ key: "artwork:field", type: "product", title: "Field Notes, riso edition", status: "live", date: "2026-11-09", created: "2026-10-14", cover: true, m: { site: "published", instagram: "published", live: "live" }, note: "In motion · Goes live Sun 2 PM", motion: true, meta: "Riso print · edition of 40 · $48" }),
  mk({ key: "thread:open", type: "meeting", title: "Open studio, November", status: "published", site: EA, date: "2026-11-20", created: "2026-10-30", m: { site: "published", instagram: "scheduled", facebook: "published" }, meta: "Nov 20, 6 PM · The print room" }),
  mk({ key: "thread:tide", type: "series", title: "Tidewater studies", status: "published", date: "2026-09-30", created: "2026-09-02", m: { site: "published", instagram: "published", newsletter: "published" } }),
  mk({ key: "thread:poll", type: "poll", title: "Which print next?", status: "draft", site: EA, date: "2026-11-02", created: "2026-11-02" }),
];

const TITLES = ["Marsh grass", "Low tide, evening", "Studio notes", "Harbour light", "Print day", "Winter palette", "Kiln log", "Open call", "Reading list", "Salt flats", "Field sketch", "Letter", "Tidal pool", "Charcoal study", "Reed beds", "Fog bank"];
const TYPES: ContentType[] = ["artwork", "writing", "meeting", "product", "writing", "series", "artwork", "video"];
const STAT: ContentStatus[] = ["published", "published", "published", "draft", "scheduled", "published", "live", "published"];
const SERIES = ["Tidewater studies", "Winter Reading Circle", "Print club"];
function big(n: number): ContentListItem[] {
  const out = [...RECENT];
  for (let i = out.length; i < n; i++) {
    const day = new Date(Date.UTC(2026, 10, 7) - i * 86400000 * 1.3).toISOString().slice(0, 10);
    out.push(mk({
      key: `thread:g${i}`, type: TYPES[i % TYPES.length]!, title: `${TITLES[i % TITLES.length]} ${Math.floor(i / TITLES.length) + 1}`, status: STAT[i % STAT.length]!, site: i % 3 === 0 ? EA : ME, date: day, created: day,
      cover: i % 4 === 1, m: { site: "published", ...(i % 2 ? { instagram: "published" as const } : {}), ...(i % 5 === 0 ? { newsletter: "scheduled" as const } : {}) }, series: i % 6 === 0 ? SERIES[i % 3] : undefined,
      meta: i % 4 === 1 ? "Oil on panel · 30 × 40 cm" : "",
    }));
  }
  return out;
}

const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const manage = () => ({ label: "Manage this piece", onClick: () => undefined });

function Dialog({ title, kicker, children, narrow }: { title: string; kicker: string; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="hx-scrim">
      <div className="hx-panel" style={{ width: narrow ? "100%" : "min(760px,100%)" }}>
        <header className="hx-head">
          <span className="hx-mark">◉</span>
          <div>
            <p className="chn-kicker">{kicker}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="chn-iconbtn" aria-label="Close">✕</button>
        </header>
        {children}
        <footer className="hx-foot chn-mono">Esc closes</footer>
      </div>
    </div>
  );
}

function Click({ sel, text, ms = 400 }: { sel: string; text?: string; ms?: number }) {
  React.useEffect(() => {
    const t = setTimeout(() => {
      const els = [...document.querySelectorAll(sel)] as HTMLElement[];
      (text ? els.find((e) => e.textContent?.includes(text)) : els[0])?.click();
    }, ms);
    return () => clearTimeout(t);
  }, [sel, text, ms]);
  return null;
}

const popup = (items: ContentListItem[], total = items.length) => (
  <PublishPopup recent={items} total={total} identities={IDS} timeZone={TZ} primaryAction={manage} />
);

function Kinds() {
  const widths = [["Full-bleed", "100%"], ["Pop-up, 460", "460px"], ["Compact, 320", "320px"], ["Tiny, 220", "220px"]] as const;
  return (
    <div className="hx-page">
      <h1>Kind strip</h1>
      <h2 className="chn-kicker">icons</h2>
      <KindStrip variant="icons" />
      <h2 className="chn-kicker">words</h2>
      <KindStrip variant="words" />
      <h2 className="chn-kicker">words, all kinds live (Studio ready)</h2>
      <KindStrip variant="words" ready={{ series: true, artwork: true, questionnaire: true, poll: true }} />
      {widths.map(([label, w]) => (
        <section key={label} style={{ width: w, maxWidth: "100%" }}>
          <h2 className="chn-kicker">tiles, {label}</h2>
          <KindStrip variant="tiles" ready={{ series: true, artwork: true }} />
        </section>
      ))}
    </div>
  );
}

function ContentPage({ items, view, open, empty }: { items: ContentListItem[]; view?: "list"; open?: boolean; empty?: boolean }) {
  return (
    <div className="hx-page hx-content">
      <header className="hx-ch">
        <div>
          <p className="chn-kicker">Content</p>
          <h1>Everything you publish</h1>
        </div>
      </header>
      <section aria-label="New">
        <h2 className="chn-kicker">New</h2>
        <KindStrip variant="tiles" ready={{ series: true, artwork: true }} />
      </section>
      <ContentLibrary
        items={items}
        identities={IDS}
        timeZone={TZ}
        now={NOW}
        initial={view ? { view } : undefined}
        primaryAction={manage}
        empty={
          empty ? (
            <div className="eac-c-pub-empty">
              <h3>Publish your first post</h3>
              <p>Everything you make shows up here: posts, meetings, series and artworks. Start with Post above.</p>
            </div>
          ) : undefined
        }
      />
      {open && <Click sel=".chn-brick" text="Field Notes" />}
    </div>
  );
}

function Face() {
  return (
    <div className="hx-page">
      <h1>Publish card, collapsed</h1>
      <div className="eac-face-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 280px))" }}>
        <PublishCardFace counts={{ drafts: 3, scheduled: 2 }} next={{ title: "Winter Reading Circle", at: d("2026-11-13") }} timeZone={TZ} />
        <PublishCardFace counts={{ drafts: 1, scheduled: 0 }} timeZone={TZ} />
        <PublishCardFace counts={{ drafts: 0, scheduled: 0 }} timeZone={TZ} />
      </div>
    </div>
  );
}

let body: React.ReactNode;
let wrapperClass = "chn";
switch (page) {
  case "kinds":
    body = <Kinds />;
    break;
  case "face":
    body = <Face />;
    break;
  case "popup":
  case "popup-phone":
  case "popup-plain":
  case "popup-dark":
    body = (
      <Dialog title="Publish" kicker="Publish" narrow={page === "popup-phone"}>
        {popup(RECENT, 214)}
      </Dialog>
    );
    if (page === "popup-plain") wrapperClass = "plain";
    break;
  case "popup-lightbox":
    body = (
      <Dialog title="Publish" kicker="Publish">
        {popup(RECENT, 214)}
        <Click sel=".eac-c-row" text="Salt Marsh" />
      </Dialog>
    );
    break;
  case "popup-empty":
    body = (
      <Dialog title="Publish" kicker="Publish">
        {popup([], 0)}
      </Dialog>
    );
    break;
  case "content-empty":
    body = <ContentPage items={[]} empty />;
    break;
  case "content-list":
    body = <ContentPage items={big(200)} view="list" />;
    break;
  case "content-lightbox":
    body = <ContentPage items={big(200)} open />;
    break;
  case "lightbox":
    body = (
      <div className="hx-page" style={{ position: "relative", minHeight: 560 }}>
        <PieceLightbox item={SALT} timeZone={TZ} onClose={() => undefined} primary={{ label: "Manage this piece" }} />
      </div>
    );
    break;
  default:
    body = <ContentPage items={big(200)} />;
}

createRoot(document.getElementById("root")!).render(<div className={`${wrapperClass} hx`}>{body}</div>);
