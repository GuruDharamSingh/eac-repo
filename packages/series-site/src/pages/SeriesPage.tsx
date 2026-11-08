import type { Metadata } from "next";
import type { SeriesSite } from "../config";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getSeriesPageSettings, getSeriesRsvps, listSeriesForPage, seriesJoinUrl } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { canSeeMaterials, getSeriesBySlug, hostCards, isViewerSubscribed, nextPublicSession, readerOf } from "../lib/series";
import { comingLabel, dateParts, dayMonthLong, displayZones, rhythmLabel, scheduleLine, seriesZones, timeInZones, timesWithDayMark } from "../lib/series-time";
import { coverStill, shareMetadata } from "../lib/series-share";
import { Icon } from "../components/icons";
import { JoinDetails } from "../components/join-details";
import { SeriesTop } from "../components/series-top";
import { CoverMedia, weekCover } from "../components/cover-media";
import { SessionRows, type SessionRowItem } from "../components/session-rows";

/**
 * The public page of one series. Since 2026-10-18 (mockup D,
 * docs/open/series-index-mockups-2026-10-18/d-series-page.html) it leads
 * with the series, not this week:
 *   - "‹ All series", the title, the cover (picture, muted looping video or
 *     YouTube/Vimeo player) directly under it;
 *   - the series' general card: About (the thread's body, rich text; the
 *     lede when there is none), schedule, hosts, beside "Follow the series"
 *     (subscribe, talk, share, the sign-in form): components/site/series-top.tsx;
 *   - one band for the next published session with "I'm coming" and, past
 *     the join gate, the join link;
 *   - the other coming sessions as rows that open their own pages
 *     (session-rows.tsx), earlier sessions folded below, then the rota.
 * This week's write-up is no longer repeated on this page.
 *
 * The join link and details show to anyone signed in with a role in the org
 * (`canSeeMaterials`), coming or not; the HTML carries them for nobody else
 * and the public `.ics` never does. Only published weeks show.
 */

const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

/*
 * TODO(E5): the series' own forum category and its general thread, once the
 * forum effort creates them (docs/open/IFAC_SERIES_PLAN_2026-10-10.md E5).
 */
const SERIES_FORUM_HREF = "/forum";

export async function seriesPageMetadata(site: SeriesSite, params: Promise<{ slug: string }>): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(site, slug, { count: 1 });
  if (!series) return { title: `${site.shortName} | Series` };
  return shareMetadata(site, {
    title: series.title,
    description: series.presentation.lede ?? series.excerpt,
    path: `/series/${series.slug}`,
    image: coverStill(series.cover),
  });
}

export async function SeriesPage({ site, params }: { site: SeriesSite; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(site, slug, { count: 10, pastCount: 12 });
  if (!series) notFound();

  const viewer = await site.getViewer();
  const userId = viewer?.userId ?? null;
  const signedIn = Boolean(userId);
  const [hosts, rsvps, subscribed, settings] = await Promise.all([
    hostCards(site, series),
    userId ? getSeriesRsvps(series, userId) : Promise.resolve({} as Record<string, "yes" | "maybe" | "no">),
    isViewerSubscribed(series, userId),
    getSeriesPageSettings(site.orgId).catch(() => null),
  ]);
  // This series' colour, as the Series page assigns it.
  const entry = settings
    ? (await listSeriesForPage(site.orgId, { count: 1, settings, viewer: await readerOf(site) }).catch(() => [])).find((e) => e.series.id === series.id) ?? null
    : null;
  const accent = entry?.accent ?? null;

  const { zone, zones } = seriesZones(series);
  const shownZones = displayZones(series);
  // Drafts are not public: lead with the first coming published week.
  const next = nextPublicSession(series);
  const pres = series.presentation;
  const href = `/series/${series.slug}`;

  // The schedule line reads from the coming session when there is one, so
  // it follows daylight saving rather than the series' first date.
  const scheduleAt = next?.at ?? series.sessions.find((s) => !s.isPast)?.at ?? series.scheduledAt;
  const times = scheduleAt ? timesWithDayMark(scheduleAt, shownZones, zone) : [];

  const toRow = (s: (typeof series.sessions)[number]): SessionRowItem => {
    const h = s.host?.userId ? card(hosts, s.host.userId, s.host.displayName) : null;
    const d = dateParts(s.at, zone);
    return {
      seriesId: series.id,
      at: s.at,
      number: s.number,
      href: `${href}/${s.number}`,
      title: s.title,
      subtitle: s.subtitle,
      isPast: s.isPast,
      date: { weekday: d.weekday, day: d.day, month: d.month },
      timeLine: timeInZones(s.at, zones),
      host: h ? { name: h.name, avatarUrl: h.avatarUrl } : null,
      cover: weekCover(s.coverImageUrl, s.coverFrame, s.coverKind, s.coverPosterUrl),
      viewerStatus: rsvps[s.at] ?? null,
      rsvpCount: s.rsvpCount,
      accent: accent ? { mark: accent.mark, text: accent.text } : null,
    };
  };
  const published = series.sessions.filter((s) => s.isPublished);
  const coming = published.filter((s) => !s.isPast && s !== next).map(toRow);
  const earlier = published.filter((s) => s.isPast).reverse().map(toRow);

  // Attendance and the join gate are separate: the link and the meeting
  // ID/passcode go to anyone signed in with a role in the org.
  const going = signedIn && next !== null && rsvps[next.at] === "yes";
  const canJoin = canSeeMaterials(viewer);
  const joinUrl = canJoin ? seriesJoinUrl(series, TALK_BASE || null) : null;
  const hasDetails = Boolean(series.joinDetails.meetingId || series.joinDetails.passcode || series.joinDetails.other);
  const joinSlot =
    canJoin && next && (joinUrl || hasDetails) ? (
      <>
        {joinUrl && (
          <a className="ifs-btn ifs-btn--primary" href={joinUrl} target="_blank" rel="noopener noreferrer">
            <Icon.video />Join the session
          </a>
        )}
        <JoinDetails details={series.joinDetails} />
      </>
    ) : null;

  // Everyone hosting a loaded week, for the card's host line.
  const hostList = Array.from(
    new Map(
      series.sessions
        .filter((s) => s.isPublished && s.host?.userId)
        .map((s) => [s.host!.userId!, card(hosts, s.host!.userId!, s.host!.displayName)])
    ).values()
  );
  const about = series.body ? sanitizeRichText(series.body) : "";
  const upcomingHosts = series.sessions.filter((s) => !s.isPast && s.isPublished && s.host).slice(0, 5);

  const aboutNode = (
    <>
      <p className="ifs-eyebrow">About the series</p>
      {about ? (
        <div className="ifs-rich" dangerouslySetInnerHTML={{ __html: about }} />
      ) : (
        <p className="ifs-rich">{pres.lede ?? series.excerpt ?? ""}</p>
      )}
      <div className="ifs-facts">
        {scheduleAt && (
          <span>
            <Icon.calendar />
            {scheduleLine(series, scheduleAt, zone)}
          </span>
        )}
        {times.length > 0 && (
          <span>
            <Icon.clock />
            <span className="ist-times">
              {times.map((t) => (
                <span key={t.zone} className="ist-time">
                  {t.text}
                  {t.dayMark && <span className="ist-daymark"> ({t.dayMark})</span>}
                </span>
              ))}
            </span>
          </span>
        )}
        <span>
          <Icon.video />
          {series.format === "in_person" ? series.location ?? "In person" : site.onlineLabel}
        </span>
      </div>
      {hostList.length > 0 && (
        <p className="ist-hosts">
          <span className="ist-hosts__faces">
            {hostList.slice(0, 4).map((h) =>
              h.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={h.name} src={h.avatarUrl} alt="" />
              ) : (
                <i key={h.name} aria-hidden="true">{h.name.charAt(0)}</i>
              )
            )}
          </span>
          <span>Hosted by {joinNames(hostList.map((h) => h.name))}</span>
        </p>
      )}
    </>
  );

  const nextHost = next?.host?.userId ? card(hosts, next.host.userId, next.host.displayName) : null;
  const nd = next ? dateParts(next.at, zone) : null;
  const nextNode =
    next && nd ? (
      <>
        <span className="ist-next__date" aria-hidden="true">
          <small>{nd.weekday}</small>
          <b>{nd.day}</b>
          <small>{nd.month}</small>
        </span>
        <span>
          <span className="ist-next__k">
            {comingLabel(next)} · Session {next.number}
          </span>
          <h2 className="ist-next__t">
            <a href={`${href}/${next.number}`}>{next.title ?? `Session ${next.number}`}</a>
          </h2>
          {next.subtitle && <p className="ist-next__sub">{next.subtitle}</p>}
          <p className="ist-next__meta">
            {dayMonthLong(next.at, zone)} · {timeInZones(next.at, zones)}
            {nextHost ? ` · with ${nextHost.name}` : ""}
          </p>
        </span>
      </>
    ) : null;

  const style = accent ? ({ "--acc": accent.mark, "--acc-text": accent.text } as CSSProperties) : undefined;

  return (
    <site.chrome.Shell>
      <site.chrome.Header active="series" seriesHref="/series" />

      <section className="ifs-event-head ist-head" style={style}>
        <div className="ifs-wrap">
          <p className="ist-crumb">
            <a className="ifs-link" href="/series">‹ All series</a>
            {viewer?.canEdit && (
              <>
                {" · "}
                <a className="ifs-link" href={`/hub/series/${series.id}#settings`}>Edit series: cover, about, schedule, sessions</a>
              </>
            )}
          </p>
          <p className="ifs-eyebrow">{seriesEyebrow(series)}</p>
          <h1>{unbreakable(series.title)}</h1>
          {series.cover && <CoverMedia cover={series.cover} className="ist-media" />}
          {!series.cover && (pres.lede ?? series.excerpt) && <p className="ifs-hero__lede">{pres.lede ?? series.excerpt}</p>}
        </div>
      </section>

      <section className="ist-section" style={style}>
        <div className="ifs-wrap">
          <SeriesTop
            seriesId={series.id}
            seriesTitle={series.title}
            href={href}
            signedIn={signedIn}
            canJoin={canJoin}
            week={
              next
                ? {
                    at: next.at,
                    number: next.number,
                    weekdayLong: dayMonthLong(next.at, zone).split(" ")[0],
                    calendarUrl: `${href}/calendar.ics?at=${encodeURIComponent(next.at)}`,
                  }
                : null
            }
            initialGoing={going}
            initialSubscribed={subscribed}
            about={aboutNode}
            next={nextNode}
            readMoreHref={next ? `${href}/${next.number}` : null}
            joinSlot={joinSlot}
            talkHref={SERIES_FORUM_HREF}
            audience={site.audience}
            presentedBy={site.shortName}
          />
        </div>
      </section>

      <section className="ifs-sessions">
        <div className="ifs-wrap">
          <div className="ifs-section__head">
            <div><p className="ifs-eyebrow">Sessions</p><h2>Coming up</h2></div>
          </div>
          {coming.length > 0 ? (
            <SessionRows rows={coming} signedIn={signedIn} />
          ) : (
            <p className="ifs-muted">{next ? "Later sessions appear here as hosts post them." : "Sessions appear here as hosts post them."}</p>
          )}
          {earlier.length > 0 && (
            <details className="ifs-earlier">
              <summary>Earlier sessions ({earlier.length})</summary>
              <SessionRows rows={earlier} signedIn={signedIn} rsvp={false} />
            </details>
          )}
        </div>
      </section>

      {site.showRota !== false && (
      <section className="ifs-thisweek">
        <div className="ifs-wrap">
          <div className="ifs-panel ist-rota">
            <div>
              <p className="ifs-eyebrow">Who&apos;s hosting</p>
              <h3>The rota</h3>
              {upcomingHosts.length === 0 && <p className="ifs-muted">Hosts for the coming sessions will be announced here.</p>}
              <div className="ifs-hosts">
                {upcomingHosts.map((s) => {
                  const h = s.host?.userId ? card(hosts, s.host.userId, s.host.displayName) : null;
                  const d = dateParts(s.at, zone);
                  const inner = (
                    <>
                      {h?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.avatarUrl} alt="" />
                      ) : (
                        <i aria-hidden="true">{h ? h.name.charAt(0) : "?"}</i>
                      )}
                      <span className="ifs-host__w">{d.day} {d.month}</span>
                      <b>{h?.name ?? "To be announced"}</b>
                    </>
                  );
                  return h?.href ? (
                    <a key={s.at} className="ifs-host" href={h.href}>{inner}</a>
                  ) : (
                    <div key={s.at} className={`ifs-host${h ? "" : " is-empty"}`}>{inner}</div>
                  );
                })}
              </div>
              <p className="ifs-muted" style={{ marginTop: 18, fontSize: "0.95rem" }}>
                {site.shortName} members: hosts post their notes and materials for their session from the hub&apos;s Series planner.{" "}
                <a className="ifs-link" href="/hub">Open the hub →</a>
              </p>
            </div>
          </div>
        </div>
      </section>
      )}

      <site.chrome.Footer seriesHref="/series" />
    </site.chrome.Shell>
  );
}

function card(
  hosts: Record<string, { name: string; avatarUrl: string | null; href: string | null; roleTitle: string | null }>,
  userId: string,
  fallbackName: string | null
) {
  const h = hosts[userId];
  return {
    name: h?.name ?? fallbackName ?? "Host",
    avatarUrl: h?.avatarUrl ?? null,
    href: h?.href ?? null,
    roleTitle: h?.roleTitle ?? null,
  };
}

/** "Kevin, Eric and Jason", or "… and others" past three. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length > 3) return `${names.slice(0, 3).join(", ")} and others`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function seriesEyebrow(series: Parameters<typeof rhythmLabel>[0]): string {
  if (series.recurrencePattern === "WEEKLY" && (series.schedule?.intervalWeeks ?? 1) > 1) return `Series · every ${series.schedule!.intervalWeeks} weeks`;
  if (series.recurrencePattern === "WEEKLY") return "Weekly series";
  if (series.recurrencePattern === "MONTHLY") return "Monthly series";
  return "Series";
}

/**
 * Keep a hyphenated word on one line: "Non-Professionals" never breaks at
 * the hyphen. The hyphen stays U+002D and the word gets `white-space:
 * nowrap` (`.nb`, series-top.css): Cormorant Garamond has no U+2011, and
 * the fallback font drew the non-breaking hyphen as a cross (2026-10-10).
 */
function unbreakable(title: string) {
  return title.split(" ").map((w, i) => (
    <span key={i}>
      {i > 0 ? " " : ""}
      {w.includes("-") ? <span className="nb">{w}</span> : w}
    </span>
  ));
}
