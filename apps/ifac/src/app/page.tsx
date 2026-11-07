import { getServerSession } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { listSeriesForPage, type MeetingSeries, type SeriesSession } from "@elkdonis/services";
import { nextPublicSession } from "@/lib/series";
import { PublicBanner, PublicFooter, PublicHeader, PublicShell } from "@/components/site/chrome";
import { EventStage, type StageSlide } from "@elkdonis/series-site/components/event-stage";
import { seriesStageSlide } from "@elkdonis/series-site/stage";
import { JoinFrame } from "@elkdonis/series-site/components/join-frame";
import { ArtGallery, type GalleryArt } from "@/components/site/art-gallery";
import { listDirectory } from "@/lib/directory";

/**
 * The IFAC landing page (reshaped 2026-10-08, revised the same evening):
 * three things:
 *   1. the event stage: whole events, one at a time, rotating, at a fixed
 *      height (a cover image is cropped to it)
 *   2. IFAC: who we are, swept across the page, in a bordered block
 *   3. the network's Baroque sign-up frame on its own, dark, centred
 *      (2026-10-10: no block or heading; a platform account, not an IFAC one)
 *   4. under it, a sliding strip of the artists' and dealers' artworks,
 *      shuffled per request (2026-10-11; galleryArt below)
 * Artists and dealers are on /about; the blog, writing and videos on
 * /publications.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, entries, session, art] = await Promise.all([getSiteContent(), landingSeries(), getServerSession(), galleryArt()]);
  const signedIn = Boolean(session.user);
  // Every listed series that has not ended, featured first (2026-10-18;
  // /hub/series sets the order). The first one names the sign-up frame.
  const series = entries[0]?.series ?? null;
  const seriesHref = series ? "/series" : null;

  const slides: StageSlide[] = [];
  /** One slide for a series: its next published week, else the series itself. */
  const slideFor = (s: MeetingSeries, week: SeriesSession | null, label: string): StageSlide =>
    seriesStageSlide(s, { week, label, many: entries.length > 1, onlineLabel: "Online" });
  entries.forEach((e, i) => {
    const next = nextPublicSession(e.series);
    slides.push(slideFor(e.series, next, next ? (next.isNext ? "This week" : "Next session") : ""));
    // The auction keeps second place after the lead series.
    if (i === 0) slides.push(AUCTION_SLIDE);
  });
  if (entries.length === 0) slides.push(AUCTION_SLIDE);
  // With a single series, its following week takes a slide too (as before 2026-10-18).
  if (entries.length === 1) {
    const s = entries[0].series;
    const next = nextPublicSession(s);
    const after = s.sessions.filter((w) => !w.isPast && w.isPublished && w !== next)[0] ?? null;
    if (after) slides.push(slideFor(s, after, "Coming up"));
  }
  if (!series) {
    slides.unshift({
      kind: "IFAC",
      title: siteConfig.orgName,
      lede: siteConfig.tagline,
      facts: [],
      actions: [{ label: "Meet the artists and dealers", href: "/about", primary: true }],
      imageUrl: content.hero.imageUrl,
    });
  }

  return (
    <PublicShell>
      <PublicHeader active="home" seriesHref={seriesHref} seriesLabel={series?.title ?? null} />
      <PublicBanner imageUrl={content.hero.imageUrl} />

      {/* The current series first, then who we are (developer, 2026-10-13;
          was the other way round from 2026-10-10). */}
      <div className="ifs-wrap ifs-stage-wrap">
        <EventStage slides={slides} blankMark={{ src: "/ifac-lettering.png", alt: "IFAC" }} />
      </div>

      <div className="ifs-wrap">
        {/* Left: heading and prose. Right (developer, 2026-10-10, round 4):
            the cities (wide only), the two buttons on one line, then "Read
            more". The social icons are not here: they sit in the footer and,
            on phones, in the header's menu sheet (chrome.tsx). */}
        {/* The large heading, no seal box; the first sentence starts after
            the org name, which the heading already says (developer, 2026-10-11). */}
        <section className="ifs-block ifs-block--split ifs-about" aria-labelledby="about-h">
          <div>
            <div className="ifs-block__head">
              <h2 className="ifs-block__h" id="about-h">{siteConfig.orgName}</h2>
            </div>
            <div className="ifs-prose">
              <p className="ifs-about__lead">{aboutLead(content.about.body)}</p>
              <p>We are unabashedly enthusiastic about our selections, and we don&apos;t take ourselves too seriously, just our mission.</p>
            </div>
          </div>
          <div className="ifs-block__aside ifs-about__aside">
            <div className="ifs-cities">New York · Paris · Vancouver · San Francisco · Buenos Aires</div>
            <div className="ifs-about__buttons">
              <a className="ifs-btn ifs-btn--blue" href="/about">Meet the artists and dealers</a>
              <a className="ifs-btn ifs-btn--blue" href="/publications">Writing and videos</a>
            </div>
          </div>
        </section>
      </div>

      <div className="ifs-wrap">
        {/* The sign-up frame on its own (2026-10-10): no block, seal or
            heading; the frame carries its own title. The account is a
            network (platform) account, not an IFAC one. */}
        <section className="ifs-joinzone" id="join" aria-label="Join the Arts Collective platform">
          {signedIn ? (
            <div className="ifs-join__signed">
              <p className="ifs-eyebrow">You&apos;re signed in</p>
              <h2 className="ifs-join__signed-h">Welcome back.</h2>
              <p className="ifs-muted">Your hub has the calendar, the series planner and your profile.</p>
              <a className="ifs-btn ifs-btn--primary" href="/hub">Go to your hub</a>
            </div>
          ) : (
            <JoinFrame seriesTitle={series?.title ?? null} next={seriesHref ?? "/hub"} />
          )}
        </section>
      </div>

      {/* Art from the artist and dealer pages, shuffled per request
          (developer, 2026-10-11). Nothing renders without artworks. */}
      {art.length > 0 && (
        <div className="ifs-wrap">
          <ArtGallery items={art} />
        </div>
      )}

      <PublicFooter seriesHref={seriesHref} seriesLabel={series?.title ?? null} />
    </PublicShell>
  );
}

const AUCTION_SLIDE: StageSlide = {
  kind: "Auction",
  title: "IFAC Art Auction",
  lede: "Work by IFAC artists goes under the hammer on the network's marketplace. Silent bidding opens before each live sale.",
  facts: [{ icon: "globe", text: "market.arts-collective.com" }],
  actions: [{ label: "Visit the market", href: siteConfig.marketplaceUrl, primary: true, external: true }],
  imageUrl: null,
  tag: "Seasonal",
  caption: { title: "The Collective Market", sub: "market.arts-collective.com" },
};

/** The series the landing shows: listed, not ended, in the Series page's order. */
async function landingSeries() {
  const entries = await listSeriesForPage(siteConfig.orgId, { count: 8 }).catch(() => []);
  return entries.filter((e) => e.inLanding && !e.ended);
}

const GALLERY_MAX = 24;
/** Thumbnail width asked of /api/media (snapped to the 128/256/512/1024
 * ladder in @elkdonis/services media-thumbnail.ts): 512 covers a 300px card
 * at 1.7x. A 7 MB master came back as 35 KB webp (2026-10-11). */
const GALLERY_W = 512;
const NOT_IMAGE = /\.(mp4|m4v|mov|webm|ogg|mp3|wav|m4a|pdf)$/i;

/**
 * The artworks shown on the public artist and dealer pages (the same
 * `listDirectory` rows /artists/<slug> and /dealers/<slug> render), shuffled
 * per request (the page is force-dynamic) and capped. Paths under a Private/
 * folder are skipped: anonymous visitors would get a broken image. A failed
 * read hides the strip rather than the landing.
 */
async function galleryArt(): Promise<GalleryArt[]> {
  const [artists, dealers] = await Promise.all([
    listDirectory("artist").catch((err) => { console.error("[ifac] gallery artists:", err); return []; }),
    listDirectory("dealer").catch((err) => { console.error("[ifac] gallery dealers:", err); return []; }),
  ]);
  const seen = new Set<string>();
  const all: GalleryArt[] = [];
  for (const p of [...artists, ...dealers]) {
    if (!p.slug) continue;
    const href = `/${p.kind === "dealer" ? "dealers" : "artists"}/${p.slug}`;
    for (const w of p.artworks) {
      const url = w.filename;
      if (!url || seen.has(url) || /(^|\/)Private\//.test(url) || NOT_IMAGE.test(url.split("?")[0]!)) continue;
      seen.add(url);
      const sized = url.startsWith("/api/media/") && !url.includes("?") ? `${url}?w=${GALLERY_W}` : url;
      all.push({ src: sized, title: w.title.trim(), artist: p.name, href });
    }
  }
  // Fisher-Yates.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, GALLERY_MAX);
}

/** "International Fine Art Collectors is an online gallery…" → "An online gallery…". */
function aboutLead(body: string): string {
  const rest = body.replace(/^International Fine Art Collectors\s*(is\s+)?/i, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
