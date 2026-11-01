import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getSeriesPageSettings, getSeriesRsvps, listSeriesForPage, type SeriesPageEntry } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { hostCards, nextPublicSession } from "@/lib/series";
import { dateParts, seriesZones, timeIn, timeInZones, weekdayPlural, zoneLabel } from "@/lib/series-time";
import { coverStill, shareMetadata } from "@/lib/series-share";
import { PublicFooter, PublicHeader, PublicShell } from "@/components/site/chrome";
import { CoverMedia, weekCover } from "@/components/site/cover-media";
import { SessionRows, type SessionRowItem } from "@/components/site/session-rows";
import { SeriesCarousel } from "@/components/site/series-carousel";
import { SeriesSessionsView, type CalendarItem } from "@/components/site/series-sessions-view";
import "@/components/site/series-index.css";

/**
 * Every series IFAC runs (2026-10-18; developer's choice from
 * docs/open/series-index-mockups-2026-10-18/: B's cards as a carousel, A's
 * larger type and dated rows, a List | Calendar switch, an "Earlier series"
 * shelf, share previews).
 *
 *   - the intro: eyebrow, heading, text, edited in the hub (/hub/series,
 *     `site_config.series_page`);
 *   - one card per listed series that has not ended (featured first, then
 *     the hub's order), each linking to its own page;
 *   - every listed series' published coming sessions, merged by date, as
 *     rows or a month calendar, each in its series' colour;
 *   - ended series on a shelf at the foot.
 * Only `kind = 'series'` threads are listed (series-page.ts).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSeriesPageSettings(siteConfig.orgId).catch(() => null);
  const entries = settings ? await listSeriesForPage(siteConfig.orgId, { count: 1, settings }).catch(() => []) : [];
  const lead = entries.find((e) => e.listed && !e.ended) ?? null;
  return shareMetadata({
    title: settings?.heading || `Series from ${siteConfig.shortName}`,
    description: settings?.introHtml ? plainOf(settings.introHtml).slice(0, 200) : siteConfig.tagline,
    path: "/series",
    image: lead ? coverStill(lead.series.cover) : null,
  });
}

export default async function SeriesIndexPage() {
  const settings = await getSeriesPageSettings(siteConfig.orgId);
  const all = await listSeriesForPage(siteConfig.orgId, { count: 10, settings });
  const shown = all.filter((e) => e.listed);
  const current = shown.filter((e) => !e.ended);
  const ended = shown.filter((e) => e.ended);

  const viewer = await getViewer();
  const userId = viewer?.userId ?? null;
  const signedIn = Boolean(userId);
  const [hostsBySeries, rsvpsBySeries] = await Promise.all([
    Promise.all(current.map((e) => hostCards(e.series).catch(() => ({}) as Awaited<ReturnType<typeof hostCards>>))),
    Promise.all(
      current.map((e) => (userId ? getSeriesRsvps(e.series, userId).catch(() => ({})) : Promise.resolve({}))) as Array<
        Promise<Record<string, "yes" | "maybe" | "no">>
      >
    ),
  ]);

  const rows: SessionRowItem[] = [];
  const calendar: CalendarItem[] = [];
  current.forEach((e, i) => {
    const { zone, zones } = seriesZones(e.series);
    const hosts = hostsBySeries[i] ?? {};
    const rsvps = rsvpsBySeries[i] ?? {};
    for (const s of e.series.sessions) {
      if (!s.isPublished || s.isPast) continue;
      const h = s.host?.userId ? hosts[s.host.userId] ?? null : null;
      const hostName = h?.name ?? s.host?.displayName ?? null;
      const d = dateParts(s.at, zone);
      const href = `/series/${e.series.slug}/${s.number}`;
      rows.push({
        seriesId: e.series.id,
        at: s.at,
        number: s.number,
        href,
        title: s.title,
        subtitle: s.subtitle,
        isPast: false,
        date: { weekday: d.weekday, day: d.day, month: d.month },
        timeLine: timeInZones(s.at, zones),
        host: hostName ? { name: hostName, avatarUrl: h?.avatarUrl ?? null } : null,
        cover: weekCover(s.coverImageUrl, s.coverFrame, s.coverKind, s.coverPosterUrl),
        viewerStatus: rsvps[s.at] ?? null,
        rsvpCount: s.rsvpCount,
        seriesName: shortName(e.series.title),
        accent: { mark: e.accent.mark, text: e.accent.text },
      });
      calendar.push({
        key: `${e.series.id}-${s.at}`,
        day: dayKey(s.at, zone),
        title: s.title ?? `Session ${s.number}`,
        time: `${timeIn(s.at, zone)} ${zoneLabel(zone)}`,
        href,
        seriesName: shortName(e.series.title),
        accent: { mark: e.accent.mark, text: e.accent.text },
        hostName,
      });
    }
  });
  rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const homeZone = current[0] ? seriesZones(current[0].series).zone : "America/Los_Angeles";
  const groups = groupByWeek(rows, homeZone);

  return (
    <PublicShell>
      <PublicHeader active="series" seriesHref="/series" />

      <section className="isx-intro">
        <div className="ifs-wrap">
          <p className="ifs-eyebrow">{settings.eyebrow}</p>
          <h1>{settings.heading || `Series from ${siteConfig.shortName}`}</h1>
          {settings.introHtml && <div className="ifs-rich isx-intro__text" dangerouslySetInnerHTML={{ __html: settings.introHtml }} />}
        </div>
      </section>

      <section className="isx-cards" aria-label="Series">
        <div className="ifs-wrap">
          {current.length === 0 ? (
            <p className="ifs-muted">New series will be announced here.</p>
          ) : (
            <SeriesCarousel count={current.length}>
              {current.map((e) => (
                <SeriesCard key={e.series.id} entry={e} />
              ))}
            </SeriesCarousel>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="isx-sessions" aria-labelledby="isx-sessions-h">
          <div className="ifs-wrap">
            <div className="ifs-section__head isx-sessions__head">
              <div>
                <p className="ifs-eyebrow">Sessions</p>
                <h2 id="isx-sessions-h">Coming up</h2>
              </div>
            </div>
            <SeriesSessionsView
              today={dayKey(new Date().toISOString(), homeZone)}
              items={calendar}
              list={
                <>
                  {groups.map((g) => (
                    <div key={g.label} className="isx-week">
                      <p className="isx-week__h">{g.label}</p>
                      <SessionRows rows={g.rows} signedIn={signedIn} />
                    </div>
                  ))}
                </>
              }
            />
            <p className="ifs-faint isx-note">Open a session for the host&apos;s notes and materials. Later sessions appear as hosts post them.</p>
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="isx-earlier" aria-labelledby="isx-earlier-h">
          <div className="ifs-wrap">
            <div className="ifs-section__head">
              <div>
                <p className="ifs-eyebrow">Archive</p>
                <h2 id="isx-earlier-h">Earlier series</h2>
              </div>
            </div>
            <ul className="isx-shelf">
              {ended.map((e) => {
                const still = coverStill(e.series.cover);
                const span = seriesSpan(e);
                return (
                  <li key={e.series.id} style={{ "--acc": e.accent.mark } as CSSProperties}>
                    <a href={`/series/${e.series.slug}`}>
                      {still ? (
                        <CoverMedia cover={{ url: still, kind: "image", frame: e.series.cover?.kind === "image" ? e.series.cover.frame : null }} className="isx-shelf__cover" controls={false} />
                      ) : (
                        <span className="isx-shelf__cover is-empty" aria-hidden="true" />
                      )}
                      <b>{e.series.title}</b>
                      {span && <span className="ifs-muted">{span}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <PublicFooter seriesHref="/series" />
    </PublicShell>
  );
}

/** One series' general card (mockup B, with A's type sizes). */
function SeriesCard({ entry }: { entry: SeriesPageEntry }) {
  const s = entry.series;
  const href = `/series/${s.slug}`;
  const { zone, zones } = seriesZones(s);
  const next = nextPublicSession(s);
  const firstComing = s.sessions.find((w) => !w.isPast)?.at ?? s.scheduledAt;
  const status = entry.upcoming && s.scheduledAt ? `Starts ${dateParts(s.scheduledAt, zone).day} ${dateParts(s.scheduledAt, zone).month}` : "Running";
  const lede = s.presentation.lede ?? s.excerpt ?? "";
  const nd = next ? dateParts(next.at, zone) : null;
  return (
    <article className="isx-card" role="listitem" style={{ "--acc": entry.accent.mark, "--acc-text": entry.accent.text } as CSSProperties}>
      <a className="isx-card__cover" href={href} tabIndex={-1} aria-hidden="true">
        {s.cover ? (
          <CoverMedia cover={s.cover} className="isx-card__media" controls={false} />
        ) : (
          <span className="isx-card__media isx-card__blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ifac-lettering.png" alt="" />
          </span>
        )}
        {entry.showStatus && <span className="isx-card__tag">{status}</span>}
      </a>
      <div className="isx-card__body">
        <p className="isx-card__rhythm">
          <i aria-hidden="true" />
          {entry.rhythm ?? `${rhythm(s.recurrencePattern, s.schedule?.intervalWeeks ?? 1)}${firstComing ? ` · ${weekdayPlural(firstComing, zone)}` : ""}`}
          {entry.featured ? " · Featured" : ""}
        </p>
        <h2 className="isx-card__t">
          <a href={href}>{s.title}</a>
        </h2>
        {lede && <p className="isx-card__lede">{lede}</p>}
        {firstComing && <p className="isx-card__time">{timeInZones(firstComing, zones)} · Online · free</p>}
        {next && nd ? (
          <a className="isx-next" href={`${href}/${next.number}`}>
            <span className="isx-next__date" aria-hidden="true">
              <small>{nd.weekday}</small>
              <b>{nd.day}</b>
              <small>{nd.month}</small>
            </span>
            <span>
              <span className="isx-next__k">{next.isNext ? "This week" : "Next session"}</span>
              <span className="isx-next__t">{next.title ?? `Session ${next.number}`}</span>
              {next.host?.displayName && <span className="isx-next__h">with {next.host.displayName}</span>}
            </span>
          </a>
        ) : (
          <p className="isx-next isx-next--empty">The first session will be announced here.</p>
        )}
        <div className="isx-card__acts">
          <a className="ifs-btn ifs-btn--primary" href={href}>Open the series</a>
          <a className="ifs-btn" href={`${href}#follow`}>Subscribe</a>
        </div>
      </div>
    </article>
  );
}

function rhythm(pattern: string | null, every = 1): string {
  if (pattern === "WEEKLY") return every > 1 ? `Every ${every} weeks` : "Weekly";
  if (pattern === "MONTHLY") return "Monthly";
  if (pattern === "DAILY") return "Daily";
  return "Series";
}

/** "Explorations in Art Forms by Non Professionals" → "Explorations in Art Forms" for row labels. */
function shortName(title: string): string {
  const cut = title.split(/\s+(?:by|for|with)\s+/i)[0];
  return cut.length >= 6 ? cut : title;
}

/** "YYYY-MM-DD" of an instant in a zone. */
function dayKey(at: string, zone: string): string {
  return new Date(at).toLocaleDateString("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Rows grouped as "This week", "Next week", "Week of 2 November". */
function groupByWeek(rows: SessionRowItem[], zone: string): Array<{ label: string; rows: SessionRowItem[] }> {
  const weekStart = (at: string) => {
    const k = dayKey(at, zone);
    const d = new Date(`${k}T00:00:00Z`);
    return new Date(d.getTime() - d.getUTCDay() * 86_400_000);
  };
  const thisWeek = weekStart(new Date().toISOString()).getTime();
  const out: Array<{ label: string; rows: SessionRowItem[] }> = [];
  for (const r of rows) {
    const ws = weekStart(r.at);
    const diff = Math.round((ws.getTime() - thisWeek) / (7 * 86_400_000));
    const label =
      diff <= 0
        ? "This week"
        : diff === 1
          ? "Next week"
          : `Week of ${ws.toLocaleDateString("en-US", { timeZone: "UTC", day: "numeric", month: "long" })}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}

function seriesSpan(e: SeriesPageEntry): string | null {
  const zone = seriesZones(e.series).zone;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: zone, month: "short", year: "numeric" });
  if (!e.series.scheduledAt) return null;
  const until = e.series.recurrenceUntil;
  return until ? `${fmt(e.series.scheduledAt)} – ${fmt(until)}` : `From ${fmt(e.series.scheduledAt)}`;
}

function plainOf(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
