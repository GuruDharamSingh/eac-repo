import type { ReactNode } from "react";
import Link from "next/link";
import type { AuctionSeries, SeriesLot } from "@elkdonis/commerce/queries";
import type { WeekBoard, WeekItemThread } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";
import { Countdown } from "./countdown";

// The series page template (2026-10-28), after the developer's "Series page"
// board (docs/open/collect-art-mockups-2026-10-28/pages/Series.html). Pure
// components: the page and the workspace's Page & look preview both use them.

export type SeriesHero = { kind: "image" | "video" | "embed"; url: string; poster?: string };
export type SeriesCurator = { name?: string; role?: string; portraitUrl?: string };
export type JournalEntry = { date: string; text: string };

export interface SeriesTheme {
  hero?: SeriesHero | null;
  curator?: SeriesCurator | null;
  proceedsNote?: string | null;
  beneficiaryName?: string | null;
  journal?: JournalEntry[] | null;
}

export function themeOf(series: AuctionSeries): SeriesTheme {
  return (series.theme ?? {}) as SeriesTheme;
}

/** A stored media address: our media proxy or an https URL. Anything else is dropped. */
export function safeSrc(u: string | undefined | null): string | null {
  if (!u) return null;
  return u.startsWith("/") && !u.startsWith("//") ? u : /^https:\/\//i.test(u) ? u : null;
}

/** YouTube and Vimeo links become their embed players (muted, looping, no controls for a background). */
export function embedSrc(u: string, background = false): string | null {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "");
    let yt: string | null = null;
    if (host === "youtube.com" || host === "m.youtube.com") yt = url.searchParams.get("v");
    if (host === "youtu.be") yt = url.pathname.slice(1);
    if (yt && /^[\w-]{6,20}$/.test(yt)) {
      const q = background ? `?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&modestbranding=1&playsinline=1` : "";
      return `https://www.youtube-nocookie.com/embed/${yt}${q}`;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}${background ? "?background=1" : ""}`;
    }
  } catch {
    // not a URL
  }
  return null;
}

// Kept free of server imports: the workspace's client preview renders these components.
const FORUM_URL = (process.env.NEXT_PUBLIC_FORUM_URL ?? "https://forum.arts-collective.com").replace(/\/$/, "");

export function threadHref(t: WeekItemThread): string {
  if (t.kind === "writing" && t.authorSlug) return `${siteConfig.network.artdirectUrl}/${t.authorSlug}/writing/${t.slug}`;
  if (t.kind === "post" && t.orgId === siteConfig.marketplaceOrgId) return `/read/${t.slug}`;
  return `${FORUM_URL}/t/${t.id}/${t.slug}`;
}

const longDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-CA", { month: "long", day: "numeric" }) : null);
const shortDate = (d: string) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const money = (minor: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);

/** Which week the series is in now (1-based), spreading announce/silent → live evenly; null outside. */
export function currentWeek(series: AuctionSeries, now = Date.now()): number | null {
  const start = series.announceAt ?? series.silentOpensAt;
  if (!start || !series.liveAt) return null;
  const a = new Date(start).getTime();
  const b = new Date(series.liveAt).getTime();
  if (now < a || b <= a) return null;
  if (now >= b) return series.weekCount;
  return Math.min(series.weekCount, Math.floor(((now - a) / (b - a)) * series.weekCount) + 1);
}

export function SrsNav({ signedIn, current = "series" }: { signedIn: boolean; current?: "series" | "about" }) {
  return (
    <nav className="srs-nav srs-wrap" aria-label="Site">
      <Link href="/" className="srs-brand">{siteConfig.name}</Link>
      <div className="srs-links">
        <Link href="/" aria-current={current === "series" ? "page" : undefined}>Auction series</Link>
        <Link href="/artworks">Market</Link>
        <Link href="/artists">Artists</Link>
        <Link href="/about" aria-current={current === "about" ? "page" : undefined}>About</Link>
        {signedIn ? <Link href="/studio">My art</Link> : <Link href="/login">Sign in</Link>}
      </div>
    </nav>
  );
}

export function SrsHero({ series, hero, curator, editControls, compact }: {
  series: AuctionSeries;
  hero: SeriesHero | null;
  curator: SeriesCurator | null;
  editControls?: ReactNode;
  compact?: boolean;
}) {
  const imageSrc = hero?.kind === "image" ? safeSrc(hero.url) : null;
  const videoSrc = hero?.kind === "video" ? safeSrc(hero.url) : null;
  const embed = hero?.kind === "embed" && hero.url ? embedSrc(hero.url, true) : null;
  const opens = longDate(series.silentOpensAt);
  const live = longDate(series.liveAt);
  const eyebrow = [series.presenterName, series.card.eyebrow || "Auction series"].filter(Boolean).join(" · ");
  return (
    <section aria-label="Series introduction" className={`srs-hero${compact ? " is-compact" : ""}`}>
      {imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" className="srs-hero-media" />
      )}
      {videoSrc && (
        <video src={videoSrc} poster={safeSrc(hero?.poster) ?? undefined} className="srs-hero-media" autoPlay muted loop playsInline />
      )}
      {embed && <iframe src={embed} title="Series video" className="srs-hero-embed" allow="autoplay; encrypted-media" tabIndex={-1} />}
      <div className="srs-hero-shade" />
      {editControls && <div className="srs-hero-edit">{editControls}</div>}
      <div className="srs-hero-body srs-wrap">
        <span className="srs-eyebrow">{eyebrow}</span>
        <h1 className="srs-title">{series.title}</h1>
        {curator?.name ? (
          <p className="srs-curated">Curated by {curator.name}</p>
        ) : series.subtitle ? (
          <p className="srs-curated">{series.subtitle}</p>
        ) : null}
        {(opens || live) && (
          <p className="srs-dates">
            {opens && live ? `Silent bidding ${opens} to ${live} · Live online auction ${live}` : opens ? `Silent bidding opens ${opens}` : `Live online auction ${live}`}
          </p>
        )}
        <div className="srs-actions">
          <Link href="/about" className="srs-btn is-light">Read more about the site</Link>
          <a href="#lots" className="srs-btn is-accent">See the lots</a>
        </div>
      </div>
    </section>
  );
}

export function SrsBar({ series, lots, artistCount }: { series: AuctionSeries; lots: SeriesLot[]; artistCount: number }) {
  const bids = lots.reduce((n, l) => n + l.bidCount, 0);
  const week = currentWeek(series);
  return (
    <div className="srs-bar">
      <div className="srs-bar-inner srs-wrap">
        {series.liveAt ? (
          <span>
            {series.phase === "closed" ? "Closed" : "Live auction in "}
            {series.phase !== "closed" && <Countdown to={series.liveAt} className="srs-count" />}
          </span>
        ) : (
          <span>Dates to be announced</span>
        )}
        <span className="srs-facts">
          <span>{lots.length} lot{lots.length === 1 ? "" : "s"}</span>
          <span>{artistCount} artist{artistCount === 1 ? "" : "s"}</span>
          <span>{bids} bid{bids === 1 ? "" : "s"}</span>
          {week && <span>Week {week} of {series.weekCount}</span>}
        </span>
        <a href="#follow" style={{ color: "#ffffff", borderBottom: "1px solid #f3e9ec", paddingBottom: 1 }}>Follow this series</a>
      </div>
    </div>
  );
}

export function SrsCurator({ series, theme, commissionPercent, editControl }: {
  series: AuctionSeries;
  theme: SeriesTheme;
  commissionPercent: number;
  editControl?: ReactNode;
}) {
  const curator = theme.curator ?? null;
  const portrait = safeSrc(curator?.portraitUrl);
  const opens = longDate(series.silentOpensAt);
  const live = longDate(series.liveAt);
  return (
    <section className="srs-split">
      <div className="srs-col-main">
        <h2 className="srs-h2">{curator?.name ? "From the curator" : "About this series"}</h2>
        {editControl}
        <div className="srs-curator">
          {curator?.name && (portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt={curator.name} className="srs-portrait" />
          ) : (
            <span role="img" aria-label={curator.name} className="srs-portrait">{curator.name.slice(0, 1)}</span>
          ))}
          <div className="srs-prose">
            {series.descriptionHtml ? (
              <div className="srs-prose" dangerouslySetInnerHTML={{ __html: series.descriptionHtml }} />
            ) : (
              <p>{series.subtitle ?? "The write-up for this series is on its way."}</p>
            )}
            {curator?.name && <p className="srs-sign">— {curator.name}{curator.role ? `, ${curator.role}` : ""}</p>}
          </div>
        </div>
      </div>
      <aside className="srs-col-side">
        <div className="srs-money">
          <h2 className="srs-label">Where the money goes</h2>
          {theme.proceedsNote && <p style={{ margin: "0 0 14px", fontSize: 15, color: "#f3e9ec" }}>{theme.proceedsNote}</p>}
          <dl className="srs-dl">
            <dt>Artist</dt><dd>{100 - commissionPercent}%</dd>
            <dt>Commission{series.presenterName ? `, supporting ${series.presenterName}` : ""}</dt><dd>{commissionPercent}%</dd>
            {theme.beneficiaryName && (<><dt>Beneficiary: {theme.beneficiaryName}</dt><dd>see lot</dd></>)}
          </dl>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#d6dbe6" }}>Donated pieces give their whole price to {series.presenterName ?? "the presenter"}; each lot page says which.</p>
        </div>
        <div className="srs-panel">
          <h2 className="srs-label">How this series runs</h2>
          <ol className="srs-steps">
            <li>{series.weekCount > 1 ? `New lots and writing are added over ${series.weekCount} weeks${live ? ` until ${live}` : ""}.` : "Lots are shown before bidding opens."}</li>
            <li>{opens ? `Silent bidding opens ${opens}.` : "Silent bidding opens on a date to be announced."} {live ? `Bids close on ${live}; a bid in the final ${series.softCloseMinutes} minutes extends the clock.` : ""}</li>
            <li>{series.closeMode === "staggered" ? "Lots close one after another in lot order during the live close." : "All lots close together at the live close."}</li>
            <li>Winners pay within {series.paymentWindowHours} hours, by card or e-transfer.</li>
          </ol>
        </div>
      </aside>
    </section>
  );
}

export function SrsWeeks({ series, weeks }: { series: AuctionSeries; weeks: WeekBoard[] }) {
  const shown = weeks.filter((w) => w.focus || w.question || (w.title && !/^Week \d+$/.test(w.title)));
  if (shown.length === 0) return null;
  const now = currentWeek(series);
  return (
    <section aria-labelledby="srs-weeks">
      <div className="srs-sechead"><h2 id="srs-weeks" className="srs-h2">The weeks</h2></div>
      <ol className="srs-weeks" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {weeks.map((w) => (
          <li key={w.weekNo} className={`srs-week${now === w.weekNo ? " is-now" : ""}`} style={w.color ? { borderTopColor: w.color } : undefined}>
            <p className="srs-week-no" style={{ margin: 0 }}>Week {w.weekNo}{now === w.weekNo ? " · this week" : ""}</p>
            <p className="srs-week-title" style={{ margin: "4px 0" }}>{w.title}</p>
            {w.focus && <p style={{ margin: "0 0 6px", color: "#d6dbe6", fontSize: 15 }}>{w.focus}</p>}
            {w.question && <p className="srs-week-q" style={{ margin: 0 }}>{w.question}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SrsLots({ series, lots, show, editControl }: { series: AuctionSeries; lots: SeriesLot[]; show: boolean; editControl?: ReactNode }) {
  const now = Date.now();
  return (
    <section id="lots">
      <div className="srs-sechead">
        <h2 className="srs-h2">The lots</h2>
        <span style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          {editControl}
          {lots.length > 0 && show && <a href="/lots" className="srs-more">All {lots.length} lots →</a>}
        </span>
      </div>
      {!show ? (
        <p className="srs-empty">The lots are revealed when bidding opens{series.silentOpensAt ? `, ${longDate(series.silentOpensAt)}` : ""}.</p>
      ) : lots.length === 0 ? (
        <p className="srs-empty">No lots yet.</p>
      ) : (
        <div className="srs-lots">
          {lots.map((l) => {
            const left = new Date(l.endAt).getTime() - now;
            const closing = l.status === "live" && left > 0 && left < 3600_000;
            const days = Math.max(0, Math.round(left / 86_400_000));
            const img = safeSrc(l.imageUrl);
            return (
              <Link key={l.id} href={`/lots/${l.id}`} className="srs-lot">
                <span className="srs-lot-frame">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="srs-lot-img" loading="lazy" />
                  ) : (
                    <span className="srs-lot-blank" />
                  )}
                </span>
                <span className="srs-lot-meta">
                  <span className="srs-lot-kicker">Lot {l.lotNumber ?? "–"}{l.artistName ? ` · ${l.artistName}` : ""}</span>
                  <span className="srs-lot-title">{l.title}</span>
                  <span className="srs-lot-price">
                    <strong>{money(l.currentBidMinor ?? l.startingBidMinor, l.currency)}</strong>{" "}
                    {l.status === "sold" ? (
                      <span style={{ color: "#aab3c7" }}>· sold</span>
                    ) : closing ? (
                      <span className="srs-closing">· closes in {Math.ceil(left / 60_000)}m</span>
                    ) : (
                      <span style={{ color: "#aab3c7" }}>· {l.bidCount} bid{l.bidCount === 1 ? "" : "s"}{l.status === "live" && left > 0 ? ` · ${days}d` : ""}</span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SrsJournal({ entries }: { entries: Array<{ date: string; text: string }> }) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2 className="srs-h2">Series journal</h2>
      <ol className="srs-journal">
        {entries.map((e, i) => (
          <li key={i}><span className="srs-journal-date">{shortDate(e.date)}</span><span>{e.text}</span></li>
        ))}
      </ol>
    </section>
  );
}

export function SrsArticles({ weeks, editControl }: { weeks: WeekBoard[]; editControl?: ReactNode }) {
  const items = weeks.flatMap((w) => w.items).filter((i) => i.thread || i.media || i.link);
  if (items.length === 0 && !editControl) return null;
  return (
    <section>
      <div className="srs-sechead" style={{ marginBottom: 26 }}>
        <h2 className="srs-h2">Articles</h2>
        {editControl}
      </div>
      {items.length === 0 ? (
        <p className="srs-empty">No writing in this series yet.</p>
      ) : (
        <div className="srs-articles">
          {items.map((i) => {
            if (i.thread) {
              const cover = safeSrc(i.thread.coverUrl);
              return (
                <a key={i.id} href={threadHref(i.thread)} className="srs-article">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="srs-article-cover" loading="lazy" />
                  ) : (
                    <span className="srs-article-cover" />
                  )}
                  <span className="srs-article-kicker">
                    {i.label || (i.thread.kind === "writing" ? "Essay" : "Article")}
                    {i.thread.publishedAt ? ` · ${shortDate(i.thread.publishedAt)}` : ""}
                    {` · Week ${i.weekNo}`}
                  </span>
                  <span className="srs-article-title">{i.title}</span>
                  {(i.thread.excerpt || i.thread.authorName) && (
                    <span className="srs-article-excerpt">{i.thread.excerpt ?? `By ${i.thread.authorName}`}</span>
                  )}
                </a>
              );
            }
            const src = safeSrc(i.media?.url);
            const body = (
              <>
                {src && i.media?.kind === "video" ? (
                  <video src={src} className="srs-video" controls preload="metadata" />
                ) : src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="srs-article-cover" loading="lazy" />
                ) : (
                  <span className="srs-article-cover" />
                )}
                <span className="srs-article-kicker">{i.label || (i.media?.kind === "video" ? "Video" : "News")}{i.publishAt ? ` · ${shortDate(i.publishAt)}` : ""} · Week {i.weekNo}</span>
                <span className="srs-article-title">{i.title}</span>
                {i.text && <span className="srs-article-excerpt">{i.text}</span>}
              </>
            );
            const href = i.link && (i.link.startsWith("/") || /^https:\/\//i.test(i.link)) ? i.link : null;
            return href ? (
              <a key={i.id} href={href} className="srs-article">{body}</a>
            ) : (
              <div key={i.id} className="srs-article">{body}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SrsFooter({ series, partners = [] }: { series: AuctionSeries; partners?: string[] }) {
  return (
    <footer className="srs-foot">
      <Link href="/about">About {siteConfig.name}</Link>
      {series.presenterName ? ` · Auction series presented by ${series.presenterName}` : ""}
      {partners.length > 0 ? ` with ${partners.join(", ")}` : ""}
      {series.hostName ? ` · Hosted by ${series.hostName}` : ""} on the Arts-Collective Platform
    </footer>
  );
}
