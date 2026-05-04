import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrgBySlug, getOrgFeed, isOrgOwner, canEditOrgSite } from "@/lib/org";
import { getCurrentUser } from "@/lib/session";
import { renderSilexHtmlWithEmbeds } from "@/components/silex-embeds";
import { SubdomainEditorBar } from "@/components/SubdomainEditorBar";
import { getCommunityFeed, type CommunityFeedItem } from "@/lib/community-feed";
import type { OrgFeedItem } from "@/lib/org";

export const dynamic = "force-dynamic";

// ─── CSS ──────────────────────────────────────────────────────────────────────

const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=VT323&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --ink:       #111111;
  --ink-2:     #333333;
  --ink-3:     #666666;
  --ink-4:     #999999;
  --cream:     #f5f0e8;
  --paper:     #fdfaf4;
  --newsprint: #e6e0d2;
  --rule:      #c8c0b0;
  --rule-dark: #888070;
  --navy:  #1a2744;
  --red:   #8b1a1a;
  --gold:  #a07010;
  --green: #1a5c2a;
  --col-l: 195px;
  --col-r: 175px;
  --max-w: 1200px;
  --serif: 'EB Garamond', Georgia, serif;
  --sans:  Arial, Helvetica, sans-serif;
  --mono:  'VT323', 'Courier New', monospace;
}

html { background: #c8c0b0; }
body { background: var(--cream); font-family: var(--sans); color: var(--ink); }
a { color: var(--navy); text-decoration: none; }
a:hover { text-decoration: underline; color: var(--red); }

/* ── Root ─────────────────────────────────────────────────────── */
#ep-root {
  max-width: var(--max-w);
  margin: 0 auto;
  background: var(--paper);
  border-left: 1px solid var(--rule);
  border-right: 1px solid var(--rule);
  box-shadow: 0 0 40px rgba(0,0,0,0.2);
}

/* ── Ticker ───────────────────────────────────────────────────── */
.ep-ticker {
  background: var(--navy);
  color: #fff;
  height: 22px;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-bottom: 2px solid var(--red);
  font-size: 11px;
}
.ep-ticker__label {
  flex-shrink: 0;
  background: var(--red);
  padding: 0 10px;
  height: 100%;
  display: flex;
  align-items: center;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 10px;
}
.ep-ticker__scroll {
  padding-left: 20px;
  white-space: nowrap;
  animation: ep-scroll 50s linear infinite;
  opacity: 0.85;
}
@keyframes ep-scroll { from{transform:translateX(100vw)} to{transform:translateX(-100%)} }

/* ── Masthead 3-col ───────────────────────────────────────────── */
.ep-masthead {
  display: grid;
  grid-template-columns: var(--col-l) 1fr var(--col-r);
  border-bottom: 4px double var(--rule-dark);
}
.ep-mast-side {
  background: var(--newsprint);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: var(--sans);
  font-size: 11px;
}
.ep-mast-side--r { border-left: 1px solid var(--rule); }
.ep-mast-side--l { border-right: 1px solid var(--rule); }
.ep-mast-side__eyebrow {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-4);
  border-bottom: 1px solid var(--rule);
  padding-bottom: 4px;
  margin-bottom: 6px;
}
.ep-mast-side__name { font-family: var(--serif); font-size: 1rem; font-weight: 700; color: var(--ink); line-height: 1.2; margin-bottom: 2px; }
.ep-mast-side__sub  { font-size: 10px; color: var(--ink-3); line-height: 1.4; }
.ep-mast-btn {
  display: block;
  text-align: center;
  padding: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-bottom: 3px;
  cursor: pointer;
  border: 1px solid;
  text-decoration: none;
}
.ep-mast-btn--p { background: var(--navy); color: #fff; border-color: var(--navy); }
.ep-mast-btn--g { background: transparent; color: var(--navy); border-color: var(--navy); }
.ep-mast-btn:hover { opacity: 0.8; text-decoration: none; }
.ep-mast-link { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--navy); border: 1px solid var(--navy); padding: 2px 7px; margin-top: 5px; }
.ep-mast-link:hover { background: var(--navy); color: #fff; text-decoration: none; }

.ep-mast-center {
  text-align: center;
  padding: 10px 14px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ep-mast-top {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--ink-4);
  border-bottom: 1px solid var(--rule);
  padding-bottom: 4px;
  margin-bottom: 6px;
}
.ep-mast-title   { font-family: var(--serif); font-size: clamp(1.8rem,3.5vw,3rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: var(--ink); }
.ep-mast-tagline { font-family: var(--serif); font-style: italic; font-size: 0.8rem; color: var(--ink-3); margin: 4px 0 6px; }
.ep-mast-rule    { width: 100%; height: 1px; background: var(--rule); }

/* ── Nav ──────────────────────────────────────────────────────── */
.ep-nav {
  background: var(--navy);
  display: flex;
  flex-wrap: wrap;
  border-bottom: 2px solid var(--rule-dark);
}
.ep-nav a {
  display: inline-block;
  padding: 7px 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  border-right: 1px solid rgba(255,255,255,0.1);
  text-decoration: none;
}
.ep-nav a:first-child { border-left: 1px solid rgba(255,255,255,0.1); }
.ep-nav a:hover { background: rgba(255,255,255,0.1); color: #fff; text-decoration: none; }

/* ── Body: strict 3-col, NO eac-embeds inside ─────────────────── */
.ep-body {
  display: grid;
  grid-template-columns: var(--col-l) 1fr var(--col-r);
  align-items: start;
  border-top: 1px solid var(--rule);
}
.ep-col-l { border-right: 1px solid var(--rule); background: var(--newsprint); }
.ep-col-c { background: var(--paper); }
.ep-col-r { border-left: 1px solid var(--rule); background: var(--newsprint); }

/* ── Block (used in all 3 columns) ────────────────────────────── */
.ep-blk { border-bottom: 1px solid var(--rule); }
.ep-blk__h {
  background: var(--navy);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--sans);
}
.ep-blk__h a { color: rgba(255,255,255,0.65); font-size: 9px; font-weight: 400; letter-spacing: 0.04em; text-transform: none; }
.ep-blk__h a:hover { color: #fff; text-decoration: none; }
.ep-blk__h--red    { background: var(--red); }
.ep-blk__h--gold   { background: var(--gold); }
.ep-blk__h--green  { background: var(--green); }
.ep-blk__h--dark   { background: #1a1a1a; }
.ep-blk__b { padding: 7px 8px; font-size: 11px; color: var(--ink-2); line-height: 1.5; }

/* Sidebar mini list */
.ep-list { list-style: none; }
.ep-list li { padding: 5px 0; border-bottom: 1px dotted var(--rule); font-size: 11px; line-height: 1.4; color: var(--ink-2); }
.ep-list li:last-child { border-bottom: none; }
.ep-list__tag  { display: block; font-size: 9px; color: var(--red); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.ep-list__date { display: block; font-size: 9px; color: var(--ink-4); letter-spacing: 0.04em; text-transform: uppercase; }

/* Event list */
.ep-ev { list-style: none; }
.ep-ev__i {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px dotted var(--rule);
  align-items: start;
}
.ep-ev__i:last-child { border-bottom: none; }
.ep-ev__date { background: var(--navy); color: #fff; text-align: center; padding: 2px 0; }
.ep-ev__day  { display: block; font-size: 15px; font-weight: 700; font-family: var(--serif); line-height: 1; }
.ep-ev__mon  { display: block; font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.65; }
.ep-ev__name { font-size: 11px; font-weight: 700; color: var(--ink); line-height: 1.3; margin-bottom: 1px; }
.ep-ev__meta { font-size: 10px; color: var(--ink-3); }

/* Live dot */
.ep-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ff4444; margin-right: 4px; vertical-align: middle; animation: pulse 1.2s ease infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.ep-live-btn {
  display: block;
  background: var(--red);
  color: #fff;
  text-align: center;
  padding: 7px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
}
.ep-live-btn:hover { opacity: 0.85; color: #fff; text-decoration: none; }

/* Spotlight box */
.ep-spot { background: var(--paper); border: 1px solid var(--rule); padding: 7px; text-align: center; margin: 4px 0; }
.ep-spot__n { font-family: var(--serif); font-size: 1rem; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
.ep-spot__m { font-size: 10px; color: var(--ink-3); margin-bottom: 4px; }
.ep-spot__b { font-family: var(--serif); font-style: italic; font-size: 0.85rem; color: var(--ink-2); line-height: 1.5; margin-bottom: 5px; }

/* ── Center: featured article ──────────────────────────────────── */
.ep-feat { border-bottom: 1px solid var(--rule); padding: 12px 14px; }
.ep-feat__section {
  font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--red); display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.ep-feat__section::after { content:''; flex:1; height:1px; background:var(--rule); }
.ep-feat__img {
  width: 100%; height: 190px; background: var(--newsprint);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--ink-4); margin-bottom: 10px;
  border: 1px solid var(--rule); object-fit: cover;
}
.ep-feat__h { font-family: var(--serif); font-size: 1.55rem; font-weight: 700; line-height: 1.2; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.01em; }
.ep-feat__h a { color: var(--ink); }
.ep-feat__h a:hover { color: var(--navy); }
.ep-feat__p { font-family: var(--serif); font-size: 0.88rem; line-height: 1.65; color: var(--ink-2); margin-bottom: 8px; }
.ep-feat__by { font-size: 11px; color: var(--ink-4); margin-bottom: 6px; border-top: 1px solid var(--rule); padding-top: 5px; }
.ep-feat__more { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--navy); }
.ep-feat__more:hover { color: var(--red); }

/* Center: join / member */
.ep-join { background: var(--navy); padding: 11px 14px; text-align: center; border-bottom: 1px solid var(--rule); }
.ep-join__t { font-family: var(--serif); font-size: 1rem; color: #fff; margin-bottom: 4px; }
.ep-join__s { font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.5; margin-bottom: 8px; }
.ep-join__r { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.ep-join__b {
  display: inline-block; padding: 5px 14px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase;
  text-decoration: none; border: 1px solid;
}
.ep-join__b--p { background: #fff; color: var(--navy); border-color: #fff; }
.ep-join__b--g { background: transparent; color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.3); }
.ep-join__b:hover { opacity: 0.82; text-decoration: none; }

.ep-member-bar {
  background: #f0ede3; border-bottom: 1px solid var(--rule);
  padding: 6px 14px; display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; border-left: 3px solid var(--gold); color: var(--ink-3);
}
.ep-member-bar strong { color: var(--ink); }
.ep-ok { color: var(--green); font-weight: 700; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }

/* Network feed grid in center col */
.ep-feed { display: grid; grid-template-columns: 1fr 1fr; }
.ep-feed__i {
  padding: 8px 10px;
  border-bottom: 1px solid var(--rule);
  border-right: 1px solid var(--rule);
  font-size: 11px;
}
.ep-feed__i:nth-child(even) { border-right: none; }
.ep-feed__kind { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-4); margin-bottom: 3px; }
.ep-feed__kind em { color: var(--navy); font-style: normal; margin-left: 4px; }
.ep-feed__title { font-family: var(--serif); font-size: 0.88rem; font-weight: 600; color: var(--ink); line-height: 1.3; margin-bottom: 3px; }
.ep-feed__exc { font-size: 10px; color: var(--ink-3); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ── Gallery strip ─────────────────────────────────────────────── */
.ep-gal { background: #181818; border-top: 3px solid #111; border-bottom: 2px solid var(--rule-dark); }
.ep-gal__h { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-bottom: 1px solid #2a2a2a; }
.ep-gal__title { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #888; font-family: var(--sans); }
.ep-gal__upload { background: var(--gold); color: #fff; border: none; padding: 4px 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; font-family: var(--sans); }
.ep-gal__upload:hover { opacity: 0.85; }
.ep-gal__row { display: flex; gap: 3px; padding: 8px 10px; overflow-x: auto; }
.ep-gal__item { flex-shrink: 0; width: 115px; height: 82px; border: 1px solid #2a2a2a; position: relative; overflow: hidden; cursor: pointer; }
.ep-gal__item:hover { border-color: var(--gold); }
.ep-gal__item > div { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ep-gal__ov { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent,rgba(0,0,0,0.75)); padding: 14px 5px 4px; font-size: 9px; color: rgba(255,255,255,0.8); opacity: 0; transition: opacity 0.12s; font-family: var(--sans); }
.ep-gal__item:hover .ep-gal__ov { opacity: 1; }
.ep-gal__add { flex-shrink: 0; width: 115px; height: 82px; border: 1px dashed #444; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #444; cursor: pointer; }
.ep-gal__add:hover { border-color: var(--gold); color: var(--gold); }

/* ── Article 2: classic traditional layout ─────────────────────── */
.ep-art2 { background: var(--paper); border-bottom: 3px double var(--rule-dark); }
.ep-art2__bar {
  background: var(--newsprint); border-top: 3px solid var(--navy); border-bottom: 1px solid var(--rule);
  padding: 5px 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--navy); display: flex; align-items: center; gap: 10px;
}
.ep-art2__bar span { color: var(--ink-4); font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 10px; }
.ep-art2__body { display: grid; grid-template-columns: 2fr 3fr; gap: 0; padding: 14px; }
.ep-art2__imgw { padding-right: 14px; border-right: 1px solid var(--rule); }
.ep-art2__img  { width: 100%; aspect-ratio: 4/3; background: var(--newsprint); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--ink-4); object-fit: cover; }
.ep-art2__cap  { font-size: 10px; color: var(--ink-4); font-style: italic; margin-top: 5px; line-height: 1.4; }
.ep-art2__txt  { padding-left: 14px; }
.ep-art2__kick { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--red); margin-bottom: 6px; }
.ep-art2__h    { font-family: var(--serif); font-size: 1.45rem; font-weight: 700; line-height: 1.2; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.01em; }
.ep-art2__p    { font-family: var(--serif); font-size: 0.86rem; line-height: 1.65; color: var(--ink-2); margin-bottom: 10px; border-left: 3px solid var(--rule); padding-left: 10px; }
.ep-art2__by   { font-size: 11px; color: var(--ink-4); margin-bottom: 8px; border-top: 1px solid var(--rule); padding-top: 6px; }
.ep-art2__more {
  display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #fff; background: var(--navy); padding: 5px 12px;
}
.ep-art2__more:hover { background: var(--red); color: #fff; text-decoration: none; }

/* ── Footer ────────────────────────────────────────────────────── */
.ep-foot {
  background: var(--navy); color: rgba(255,255,255,0.45);
  padding: 8px 14px; display: flex; justify-content: space-between;
  font-size: 10px; letter-spacing: 0.04em; font-family: var(--sans);
}
.ep-foot a { color: rgba(255,255,255,0.45); }
.ep-foot a:hover { color: #fff; text-decoration: none; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 820px) {
  .ep-masthead,.ep-body { grid-template-columns: 1fr; }
  .ep-mast-side { display: none; }
  .ep-col-l,.ep-col-r { border: none; border-top: 1px solid var(--rule); }
  .ep-art2__body { grid-template-columns: 1fr; }
  .ep-art2__imgw { padding-right: 0; border-right: none; border-bottom: 1px solid var(--rule); padding-bottom: 12px; margin-bottom: 12px; }
  .ep-art2__txt  { padding-left: 0; }
}
@media (max-width: 540px) {
  .ep-feed { grid-template-columns: 1fr; }
  .ep-feed__i { border-right: none; }
}
`;

// ─── HTML builder ─────────────────────────────────────────────────────────────

type BuildOpts = {
  orgName: string;
  orgSlug: string;
  discipline: string | null;
  bio: string | null;
  displayName: string | null;
  city: string | null;
  isUserLoggedIn: boolean;
  userDisplayName: string | null;
  loginUrl: string;
  signupUrl: string;
  talkToken: string | null;
  nextcloudUrl: string;
  isLive: boolean;
  orgFeed: OrgFeedItem[];
  networkFeed: CommunityFeedItem[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildPortalHtml(opts: BuildOpts): string {
  const {
    orgName, orgSlug, discipline, bio, displayName, city,
    isUserLoggedIn, userDisplayName, loginUrl, signupUrl,
    talkToken, nextcloudUrl, isLive,
    orgFeed, networkFeed,
  } = opts;

  const artistLabel = displayName ?? orgName;
  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const talkUrl = talkToken
    ? `${nextcloudUrl.replace(/\/$/, "")}/call/${talkToken}`
    : null;

  // ── Upcoming events from org feed ──────────────────────────────
  const events = orgFeed
    .filter((t) => t.scheduled_at && new Date(t.scheduled_at).getTime() > Date.now())
    .slice(0, 4);

  const eventsHtml = events.length
    ? `<ul class="ep-ev">${events.map((e) => {
        const d = new Date(e.scheduled_at!);
        return `<li class="ep-ev__i">
          <div class="ep-ev__date">
            <span class="ep-ev__day">${d.getDate()}</span>
            <span class="ep-ev__mon">${d.toLocaleString("default",{month:"short"})}</span>
          </div>
          <div>
            <div class="ep-ev__name">${esc(e.title)}</div>
            <div class="ep-ev__meta">${e.format ?? "Event"} &middot; ${esc(orgName)}</div>
          </div>
        </li>`;
      }).join("")}</ul>`
    : `<p style="font-size:11px;color:var(--ink-4);font-style:italic">No upcoming events yet. Check back soon.</p>`;

  // ── Live room block ─────────────────────────────────────────────
  const liveHtml = talkUrl
    ? `<div class="ep-blk">
        <div class="ep-blk__h ep-blk__h--red">
          <span><span class="ep-dot"></span>${isLive ? "Live now" : "Talk room"}</span>
          <span>${isLive ? "on air" : "open"}</span>
        </div>
        <div class="ep-blk__b" style="padding:0">
          <a href="${isUserLoggedIn ? `/api/talk/join?token=${talkToken}` : talkUrl}"
             target="${isUserLoggedIn ? "_self" : "_blank"}" rel="noopener"
             class="ep-live-btn">${isLive ? "&#9679; Join live session" : "&#9656; Enter room"}</a>
        </div>
      </div>`
    : "";

  // ── Network feed (center col) ───────────────────────────────────
  const feedItems = networkFeed.slice(0, 6);
  const feedHtml = feedItems.length
    ? `<div class="ep-feed">${feedItems.map((i) =>
        `<div class="ep-feed__i">
          <div class="ep-feed__kind">${esc(i.kind)}<em>${esc(i.orgName)}</em></div>
          <div class="ep-feed__title">${esc(i.title)}</div>
          ${i.excerpt ? `<div class="ep-feed__exc">${esc(i.excerpt)}</div>` : ""}
        </div>`
      ).join("")}</div>`
    : `<div style="padding:10px;font-size:11px;color:var(--ink-4);font-style:italic">The network feed is quiet right now. As artists publish, it will appear here.</div>`;

  // ── Join / member block ─────────────────────────────────────────
  const joinHtml = isUserLoggedIn
    ? `<div class="ep-member-bar">
        <span>Signed in as <strong>${esc(userDisplayName ?? "member")}</strong> &mdash; <a href="/hub">your hub</a> &middot; <a href="/">artist page</a></span>
        <span class="ep-ok">&#10003; Network member</span>
      </div>`
    : `<div class="ep-join">
        <p class="ep-join__t">Join the Elkdonis Collective</p>
        <p class="ep-join__s">One account. Every collective site.</p>
        <div class="ep-join__r">
          <a href="${signupUrl}" class="ep-join__b ep-join__b--p">Create account</a>
          <a href="${loginUrl}"  class="ep-join__b ep-join__b--g">Sign in</a>
        </div>
      </div>`;

  // ── Gallery tiles ───────────────────────────────────────────────
  const galColors = ["#2d3a2e","#3a2d2d","#2d2d3a","#3a362d","#2d3a37","#362d3a","#3a2d35","#2d3535"];
  const galTiles = galColors.map((bg,i) =>
    `<div class="ep-gal__item">
      <div style="background:${bg}"><span style="font-size:20px;opacity:0.2;color:#fff">&#9632;</span></div>
      <div class="ep-gal__ov">Member artwork ${i+1}</div>
    </div>`
  ).join("");

  return `<div id="ep-root">

<!-- Ticker -->
<div class="ep-ticker">
  <div class="ep-ticker__label">&#9679; Live</div>
  <div class="ep-ticker__scroll">
    Arts collective network &bull; Workshops, residencies &amp; community gatherings &bull;
    Open calls this season &bull; Connect with artists in your region &bull;
    Local exhibitions and open studios &bull; The collective grows one artist at a time &bull;
    Create &bull; Share &bull; Gather &bull; ${esc(orgName)} is part of this network &bull;
  </div>
</div>

<!-- Masthead: 3-col mirrors body below -->
<div class="ep-masthead">

  <div class="ep-mast-side ep-mast-side--l">
    <div>
      <div class="ep-mast-side__eyebrow">Artist spotlight</div>
      <div class="ep-mast-side__name">${esc(artistLabel)}</div>
      <div class="ep-mast-side__sub">${esc(discipline ?? "Arts Collective")}${city ? ` &bull; ${esc(city)}` : ""}</div>
      ${bio ? `<div class="ep-mast-side__sub" style="margin-top:4px;font-style:italic">${esc(bio.slice(0,70))}${bio.length>70?"&hellip;":""}</div>` : ""}
    </div>
    <a class="ep-mast-link" href="/">Visit page &rarr;</a>
  </div>

  <div class="ep-mast-center">
    <div class="ep-mast-top">
      <span>${today}</span>
      <span>Community Edition</span>
    </div>
    <h1 class="ep-mast-title">The Collective</h1>
    <p class="ep-mast-tagline">Arts &bull; Community &bull; Region &bull; Network</p>
    <div class="ep-mast-rule"></div>
  </div>

  <div class="ep-mast-side ep-mast-side--r">
    ${isUserLoggedIn
      ? `<div>
          <div class="ep-mast-side__eyebrow">Signed in</div>
          <div class="ep-mast-side__name">${esc(userDisplayName ?? "member")}</div>
          <div class="ep-mast-side__sub">Elkdonis Arts Collective</div>
        </div>
        <a class="ep-mast-link" href="/hub">Your hub &rarr;</a>`
      : `<div>
          <div class="ep-mast-side__eyebrow">Join the network</div>
          <div class="ep-mast-side__sub" style="margin-bottom:8px">One account, every collective site.</div>
          <a class="ep-mast-btn ep-mast-btn--p" href="${signupUrl}">Create account</a>
          <a class="ep-mast-btn ep-mast-btn--g" href="${loginUrl}">Sign in</a>
        </div>`}
  </div>

</div>

<!-- Nav -->
<nav class="ep-nav">
  <a href="/">Artist</a>
  <a href="/community">Community</a>
  <a href="#events">Events</a>
  <a href="#gallery">Gallery</a>
  <a href="#workshops">Workshops</a>
  <a href="#resources">Resources</a>
</nav>

<!-- ── 3-col body: NO eac-embeds inside ── -->
<div class="ep-body">

  <!-- LEFT COLUMN -->
  <aside class="ep-col-l">

    ${liveHtml}

    <div class="ep-blk">
      <div class="ep-blk__h ep-blk__h--gold">&#9728; Local Weather</div>
      <div class="ep-blk__b">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-family:var(--serif);font-size:1.8rem;line-height:1;color:var(--ink)">&mdash;&deg;</span>
          <div style="font-size:10px;color:var(--ink-2)">
            <div>${city ? esc(city) : "Your city"}</div>
            <div style="font-size:9px;color:var(--ink-4)">Weather loading&hellip;</div>
          </div>
        </div>
      </div>
    </div>

    <div class="ep-blk" id="events">
      <div class="ep-blk__h ep-blk__h--green">&#9654; Events This Week</div>
      <div class="ep-blk__b">${eventsHtml}</div>
    </div>

    <div class="ep-blk">
      <div class="ep-blk__h ep-blk__h--dark">&#9733; ${esc(artistLabel)}</div>
      <div class="ep-blk__b">
        <div class="ep-spot">
          <div class="ep-spot__n">${esc(artistLabel)}</div>
          <div class="ep-spot__m">${esc(discipline ?? "Arts Collective")}${city ? ` &bull; ${esc(city)}` : ""}</div>
          ${bio ? `<div class="ep-spot__b">${esc(bio.slice(0,110))}${bio.length>110?"&hellip;":""}</div>` : ""}
        </div>
        <a class="ep-mast-link" href="/" style="display:block;text-align:center;margin-top:2px">Visit studio &rarr;</a>
      </div>
    </div>

    <div class="ep-blk">
      <div class="ep-blk__h">Regional Arts</div>
      <div class="ep-blk__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">News</span><a href="#">Open calls — spring 2026</a></li>
          <li><span class="ep-list__tag">Resource</span><a href="#">Grant deadlines this quarter</a></li>
          <li><span class="ep-list__tag">Event</span><a href="#">Arts council funding rounds</a></li>
          <li><span class="ep-list__tag">News</span><a href="#">Regional residency programs open</a></li>
        </ul>
      </div>
    </div>

  </aside>

  <!-- CENTER COLUMN -->
  <main class="ep-col-c">

    <div class="ep-feat">
      <div class="ep-feat__section">In the community</div>
      <div class="ep-feat__img" role="img">
        <span style="font-family:var(--mono);font-size:13px;letter-spacing:0.06em;opacity:0.4">[COMMUNITY PHOTO]</span>
      </div>
      <h2 class="ep-feat__h">
        <a href="#">Artists, makers &amp; community members gather across the collective</a>
      </h2>
      <p class="ep-feat__p">
        The Elkdonis Arts Collective brings together independent artists, community builders,
        and creative practitioners from across the region. From open studios to collaborative
        workshops, new voices are joining a growing, grassroots arts network every month.
      </p>
      <div class="ep-feat__by">
        <strong>Elkdonis Arts Collective</strong> &bull; Community desk &bull; ${today}
      </div>
      <a class="ep-feat__more" href="#workshops">Read more &rarr;</a>
    </div>

    ${joinHtml}

    <div class="ep-blk" style="border-top:3px solid var(--navy)">
      <div class="ep-blk__h">
        Latest from the network
        <a href="/artists">All artists &rarr;</a>
      </div>
      ${feedHtml}
    </div>

    <div class="ep-blk" id="workshops" style="border-top:2px solid var(--green)">
      <div class="ep-blk__h ep-blk__h--green">
        Upcoming workshops &amp; sessions
        <span style="font-weight:400;letter-spacing:0;text-transform:none;font-size:9px">open registration</span>
      </div>
      <div class="ep-blk__b">
        ${orgFeed.filter(t=>t.kind==="workshop"||t.kind==="event").slice(0,3).map(t=>
          `<div style="padding:5px 0;border-bottom:1px dotted var(--rule)">
            <div style="font-size:9px;color:var(--ink-4);text-transform:uppercase;letter-spacing:0.06em">${esc(t.kind)}${t.scheduled_at?" &bull; "+shortDate(t.scheduled_at):""}</div>
            <div style="font-family:var(--serif);font-size:0.9rem;font-weight:600;color:var(--ink)">${esc(t.title)}</div>
          </div>`
        ).join("") || `<p style="font-size:11px;color:var(--ink-4);font-style:italic">No workshops scheduled yet.</p>`}
      </div>
    </div>

  </main>

  <!-- RIGHT COLUMN -->
  <aside class="ep-col-r">

    <div class="ep-blk">
      <div class="ep-blk__h">&#128240; Art News</div>
      <div class="ep-blk__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">Collective</span>New works from emerging members</li>
          <li><span class="ep-list__tag">Open call</span>Community residency applications open</li>
          <li><span class="ep-list__tag">Grant</span>Regional arts funding deadlines near</li>
          <li><span class="ep-list__tag">Event</span>Open studio days announced</li>
          <li><span class="ep-list__tag">Feature</span>Artist talks this season</li>
        </ul>
      </div>
    </div>

    <div class="ep-blk">
      <div class="ep-blk__h ep-blk__h--gold">Community Pulse</div>
      <div class="ep-blk__b">
        <div style="font-family:var(--serif);font-size:0.88rem;font-weight:600;color:var(--ink);margin-bottom:6px">What should grow next?</div>
        ${["More workshops","Open studio days","Artist talks","Community residency"].map((o,i)=>
          `<div style="display:flex;border:1px solid var(--rule);margin-bottom:3px;font-size:11px;cursor:pointer;background:var(--paper)">
            <span style="background:var(--newsprint);padding:4px 6px;font-weight:700;color:var(--ink-3);font-size:10px;border-right:1px solid var(--rule)">${i+1}</span>
            <span style="padding:4px 7px;color:var(--ink)">${o}</span>
          </div>`
        ).join("")}
      </div>
    </div>

    <div class="ep-blk" id="resources">
      <div class="ep-blk__h">Resources</div>
      <div class="ep-blk__b">
        <ul class="ep-list">
          <li><span class="ep-list__tag">Resource</span><a href="#">Open calls — spring 2026</a></li>
          <li><span class="ep-list__tag">Resource</span><a href="#">Grant deadlines this quarter</a></li>
          <li><span class="ep-list__tag">Resource</span><a href="#">Shared studio spaces</a></li>
          <li><span class="ep-list__tag">Resource</span><a href="#">Community documentation</a></li>
        </ul>
      </div>
    </div>

    <div class="ep-blk">
      <div class="ep-blk__h ep-blk__h--dark">Reserve a place</div>
      <div class="ep-blk__b">
        ${events.slice(0,2).map(e=>
          `<div style="padding:4px 0;border-bottom:1px dotted var(--rule);font-size:11px">
            <div style="font-weight:700;color:var(--ink);line-height:1.3">${esc(e.title)}</div>
            <div style="font-size:10px;color:var(--ink-3)">${shortDate(e.scheduled_at)}</div>
            <a href="${signupUrl}" style="font-size:10px;font-weight:700;color:var(--red)">RSVP &rarr;</a>
          </div>`
        ).join("") || `<p style="font-size:11px;color:var(--ink-4);font-style:italic">No upcoming events.</p>`}
      </div>
    </div>

    <div class="ep-blk">
      <div class="ep-blk__h ep-blk__h--green">&#10022; Get Involved</div>
      <div class="ep-blk__b">
        <ul class="ep-list">
          <li><a href="${signupUrl}">&#8594; Join this community</a></li>
          <li><a href="/">&#8594; Visit artist page</a></li>
          <li><a href="/artists">&#8594; Discover artists</a></li>
          ${talkUrl ? `<li><a href="${talkUrl}" target="_blank" rel="noopener">&#8594; Open Talk room</a></li>` : ""}
          <li><a href="/hub">&#8594; Member hub</a></li>
        </ul>
      </div>
    </div>

  </aside>

</div><!-- /ep-body -->

<!-- ── Gallery strip ── -->
<div class="ep-gal" id="gallery">
  <div class="ep-gal__h">
    <span class="ep-gal__title">&#9632; Community Gallery &mdash; member work</span>
    <button class="ep-gal__upload" onclick="alert('Image upload coming soon — post to your hub to contribute.')">+ Upload image</button>
  </div>
  <div class="ep-gal__row">
    ${galTiles}
    <div class="ep-gal__add" title="Add your work">+</div>
  </div>
</div>

<!-- ── Article 2: classic traditional layout ── -->
<div class="ep-art2">
  <div class="ep-art2__bar">
    From the collective
    <span>&bull; Features &bull; ${today}</span>
  </div>
  <div class="ep-art2__body">
    <div class="ep-art2__imgw">
      <div class="ep-art2__img">
        <span style="font-family:var(--mono);font-size:12px;letter-spacing:0.06em;opacity:0.4">[COMMUNITY ART]</span>
      </div>
      <p class="ep-art2__cap">Community gathering &mdash; ${esc(orgName)} &mdash; artists connecting across the region.</p>
    </div>
    <div class="ep-art2__txt">
      <div class="ep-art2__kick">Community &bull; Arts &bull; Region</div>
      <h2 class="ep-art2__h">Growing a grassroots arts network, one community at a time</h2>
      <p class="ep-art2__p">
        From neighbourhood studios to online gatherings, the Elkdonis Arts Collective has been building
        connections between independent artists across the region. This isn&rsquo;t a gallery or an institution
        &mdash; it&rsquo;s a living, growing network of people making things and making space for each other.
      </p>
      <div class="ep-art2__by">By <strong>Elkdonis Arts Collective</strong> &bull; Community desk &bull; ${today}</div>
      <a class="ep-art2__more" href="/community">Read full story &rarr;</a>
    </div>
  </div>
</div>

<!-- Footer -->
<div class="ep-foot">
  <span>Elkdonis Arts Collective &bull; Community Edition &bull; ${esc(orgName)}</span>
  <span>&copy; ${new Date().getFullYear()} &bull; <a href="/">Home</a> &bull; <a href="/hub">Hub</a></span>
</div>

</div>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const rootBase = `${proto}://${rootHost}`;

  const user = await getCurrentUser();
  const owner = user ? await isOrgOwner(user.id, org.id) : false;
  const canEdit = user ? owner || (await canEditOrgSite(user.id, org.id)) : false;

  const [orgFeed, networkFeed] = await Promise.all([
    getOrgFeed(org.id, 20),
    getCommunityFeed(8),
  ]);

  const nextcloudUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL || "http://localhost:8080";
  const now = Date.now();
  const liveItem = orgFeed.find((t) => {
    if (!t.nextcloud_talk_token || !t.scheduled_at || !t.duration_minutes) return false;
    const start = new Date(t.scheduled_at).getTime();
    return now >= start && now <= start + t.duration_minutes * 60_000;
  });
  const upcomingItem = orgFeed.find(
    (t) => t.nextcloud_talk_token && t.scheduled_at && new Date(t.scheduled_at).getTime() > now
  );
  const talkItem = liveItem ?? upcomingItem ?? null;
  const profile = org.profile;

  const html = buildPortalHtml({
    orgName: org.name,
    orgSlug: slug,
    discipline: profile?.disciplines?.[0] ?? null,
    bio: profile?.bio ?? org.description ?? null,
    displayName: profile?.display_name ?? null,
    city: profile?.city ?? null,
    isUserLoggedIn: Boolean(user),
    userDisplayName: user?.email.split("@")[0] ?? null,
    loginUrl: `/login?org=${encodeURIComponent(slug)}`,
    signupUrl: `/login?mode=signup&org=${encodeURIComponent(slug)}`,
    talkToken: talkItem?.nextcloud_talk_token ?? null,
    nextcloudUrl,
    isLive: Boolean(liveItem),
    orgFeed,
    networkFeed,
  });

  const content = await renderSilexHtmlWithEmbeds(html, org);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      {content}
      {canEdit && (
        <SubdomainEditorBar
          orgSlug={slug}
          workshopsUrl={`${rootBase}/hub/workshops/${slug}`}
          isOwner={owner}
        />
      )}
    </>
  );
}
