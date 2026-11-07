import type { Metadata } from "next";
import type { SeriesSite } from "../config";
import { notFound } from "next/navigation";
import { getSeriesRsvps, listReplies, listRotaCandidates, listSeriesSessionAttendees, seriesJoinUrl } from "@elkdonis/services";
import { canSeeDraftWeek, canSeeMaterials, getSeriesWeek, hostCards, isAnnouncedCancellation } from "../lib/series";
import { dateParts, seriesZones, timeInZones } from "../lib/series-time";
import { Icon } from "../components/icons";
import { SeriesRsvp } from "../components/series-rsvp";
import { SeriesSignIn } from "../components/series-signin";
import { WeekEditor } from "../components/week-editor";
import { WeekCommentForm } from "../components/week-comments";
import { JoinDetails } from "../components/join-details";
import { CoverMedia, weekCover } from "../components/cover-media";
import { coverStill, shareMetadata } from "../lib/series-share";

/**
 * One week of a series as its own page (2026-10-09): date and title, "I'm
 * coming", the join link (signed in with a role in the org; 2026-10-10), the host drawn from their profile, the write-up and materials, the weeks
 * either side, and the conversation (replies on the week's topic thread,
 * which the forum also sees). Organisers and the week's host edit it in
 * place.
 *
 * A draft week (no title, or not published; 2026-10-10) is visible only to
 * organisers and its host and co-host, who edit it here; everyone else gets
 * a 404, and the weeks either side skip drafts. Materials show to signed-in
 * viewers with any role in the org (`canSeeMaterials`).
 *
 * Weeks are found by their stored number first (`series_sessions`,
 * migration 203), so `/series/<slug>/<n>` keeps naming the same week after
 * a move or a schedule change. A moved week shows its new time; a cancelled
 * week that had been published says so, without RSVP or join link, and a
 * cancelled draft stays hidden like any draft.
 */
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");

async function load(site: SeriesSite, slug: string, nRaw: string) {
  const n = Number.parseInt(nRaw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const found = await getSeriesWeek(site, slug, n);
  if (!found) return null;
  return { series: found.series, week: found.week, n };
}

export async function seriesWeekMetadata(site: SeriesSite, params: Promise<{ slug: string; n: string }>): Promise<Metadata> {
  const { slug, n } = await params;
  const data = await load(site, slug, n);
  if (!data) return { title: `${site.shortName} | Series` };
  // Share preview (2026-10-18): the week's cover, else the series'.
  const meta = shareMetadata(site, {
    title: `${data.week.title ?? `Session ${data.n}`} · ${data.series.title}`,
    description: data.week.subtitle ?? data.week.summary?.split("\n").find((l) => l.trim()) ?? null,
    path: `/series/${data.series.slug}/${data.week.number}`,
    image: data.week.coverStillUrl ?? coverStill(data.series.cover),
  });
  // Drafts are not public: no preview for a week the public cannot open.
  return data.week.isPublished ? meta : { title: meta.title };
}

export async function SeriesWeekPage({ site, params }: { site: SeriesSite; params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const data = await load(site, slug, n);
  if (!data) notFound();
  const { series, week } = data;
  const seriesHref = `/series/${series.slug}`;
  const href = `${seriesHref}/${week.number}`;

  const viewer = await site.getViewer();
  const cancelled = week.isCancelled;
  if (!week.isPublished && !isAnnouncedCancellation(week) && !canSeeDraftWeek(viewer, week)) notFound();
  const userId = viewer?.userId ?? null;
  const signedIn = Boolean(userId);
  const showMaterials = canSeeMaterials(viewer);
  const [hosts, rsvps, attendees, replies] = await Promise.all([
    hostCards(site, series),
    userId ? getSeriesRsvps(series, userId) : Promise.resolve({} as Record<string, "yes" | "maybe" | "no">),
    week.topicThreadId ? listSeriesSessionAttendees(week.topicThreadId, 8) : Promise.resolve([]),
    week.topicThreadId ? listReplies(week.topicThreadId, { limit: 50, viewer: await site.getForumViewer() }).catch(() => null) : Promise.resolve(null),
  ]);
  const host = week.host?.userId ? hosts[week.host.userId] : null;
  const coHost = week.coHost?.userId ? hosts[week.coHost.userId] : null;
  const hostProfile = host?.href ? await site.getHostProfile?.(host.href.split("/").pop()!).catch(() => undefined) : undefined;
  const canEditWeek = Boolean(viewer && (viewer.canEdit || week.host?.userId === userId || week.coHost?.userId === userId));

  const { zone, zones } = seriesZones(series);
  const d = dateParts(week.at, zone);
  // The join link, meeting ID and passcode: anyone signed in with a
  // role (developer's decision, 2026-10-10 evening), coming or not. The HTML
  // carries them for nobody else; the public .ics never does.
  const canJoin = canSeeMaterials(viewer);
  const joinUrl = canJoin ? seriesJoinUrl(series, TALK_BASE || null) : null;
  const hasDetails = Boolean(series.joinDetails.meetingId || series.joinDetails.passcode || series.joinDetails.other);
  // Drafts are skipped for everyone who cannot edit this week.
  const visible = canEditWeek ? series.sessions : series.sessions.filter((s) => s.isPublished || s.at === week.at);
  const idx = visible.findIndex((s) => s.at === week.at);
  const prev = idx > 0 ? visible[idx - 1] : null;
  const next = idx >= 0 && idx < visible.length - 1 ? visible[idx + 1] : null;
  const comments = replies?.rows ?? [];

  const body = (
    <>
      <h1 className="ifs-week__title">{week.title ?? "To be announced"}</h1>
      {week.subtitle && <p className="ifs-subtitle">{week.subtitle}</p>}
      {week.coverImageUrl && <CoverMedia cover={weekCover(week.coverImageUrl, week.coverFrame, week.coverKind, week.coverPosterUrl)!} className="ifs-week__cover" />}
      {week.bodyHtml ? (
        // Sanitised on write (saveSeriesSession).
        <div className="ifs-week__prose ifs-rich" dangerouslySetInnerHTML={{ __html: week.bodyHtml }} />
      ) : week.summary ? (
        <div className="ifs-week__prose">{week.summary}</div>
      ) : (
        <p className="ifs-faint">The host hasn&apos;t written this session up yet.</p>
      )}
      <h2 className="ifs-week__h2">Materials</h2>
      {!showMaterials && week.materials.length > 0 ? (
        <p className="ifs-rsvp-card__gate">
          <Icon.lock />
          {signedIn ? `Materials are for ${site.audience}.` : "Sign in to see the materials for this session."}
        </p>
      ) : week.materials.length > 0 ? (
        <div className="ifs-materials">
          {week.materials.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener">
              {m.kind === "image" ? <Icon.image /> : m.kind === "video" ? <Icon.play /> : m.kind === "audio" ? <Icon.audio /> : <Icon.doc />}
              <span className="n">{m.name}</span>
              <span className="x">{m.kind}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="ifs-faint">Nothing to look at beforehand. Just come.</p>
      )}
    </>
  );

  return (
    <site.chrome.Shell>
      <site.chrome.Header active="series" seriesHref={seriesHref} seriesLabel={series.title} />
      <div className="ifs-wrap ifs-week">
        <p className="ifs-week__crumb"><a className="ifs-link" href={seriesHref}>‹ {series.title}</a> · Session {week.number}{viewer?.canEdit && <> · <a className="ifs-link" href={`/hub/series/${series.id}`}>Series planner</a></>}</p>

        <div className="ifs-week__grid">
          <article className="ifs-block ifs-week__main">
            <div className="ifs-week__when">
              <div className="ifs-datebox">
                <div className="ifs-datebox__d">{d.weekday}</div>
                <div className="ifs-datebox__n">{d.day}</div>
                <div className="ifs-datebox__m">{d.month}</div>
              </div>
              <div>
                <p className="ifs-eyebrow">{cancelled ? "Cancelled" : week.isNext ? "This week" : week.isPast ? "Past session" : "Coming up"} · Session {week.number}</p>
                <p className="ifs-week__time">{d.long} · {timeInZones(week.at, zones)} · {series.format === "in_person" ? series.location ?? "In person" : site.onlineLabel}</p>
                {week.isMoved && week.slotAt && !cancelled && (
                  <p className="ifs-muted">Moved from {dateParts(week.slotAt, zone).long} · {timeInZones(week.slotAt, zones)}</p>
                )}
              </div>
            </div>
            {canEditWeek ? (
              <WeekEditor
                seriesId={series.id}
                occurrenceAt={week.at}
                initial={{ title: week.title, subtitle: week.subtitle, summary: week.summary, bodyHtml: week.bodyHtml, coverImageUrl: week.coverImageUrl, coverFrame: week.coverFrame, coverKind: week.coverKind, coverPosterUrl: week.coverPosterUrl, materials: week.materials.map((m) => ({ id: m.id, name: m.name, url: m.url, kind: m.kind, external: m.external })) }}
                heading={{
                  number: week.number,
                  when: `${d.long} · ${timeInZones(week.at, zones)}`,
                  prevHref: prev ? `${seriesHref}/${prev.number}` : null,
                  nextHref: next ? `${seriesHref}/${next.number}` : null,
                }}
                canPlan={Boolean(viewer?.canEdit)}
                host={week.host?.userId ? { userId: week.host.userId, displayName: host?.name ?? week.host.displayName ?? "Someone" } : null}
                coHost={week.coHost?.userId ? { userId: week.coHost.userId, displayName: coHost?.name ?? week.coHost.displayName ?? "Someone" } : null}
                /* Organisers assign hosts; ids and names only, no emails to the client. */
                candidates={viewer?.canEdit ? (await listRotaCandidates(site.orgId).catch(() => [])).map((c) => ({ userId: c.userId, displayName: c.displayName })) : []}
              >
                {body}
              </WeekEditor>
            ) : (
              body
            )}
          </article>

          <aside className="ifs-week__side">
            <section className="ifs-block ifs-week__rsvp" aria-label="Coming?">
              <p className="ifs-eyebrow">{cancelled ? "This session is cancelled" : week.isPast ? "This session has passed" : "Coming?"}</p>
              {!week.isPast && !cancelled && series.isRsvpEnabled && (
                <SeriesRsvp seriesId={series.id} occurrenceAt={week.at} signedIn={signedIn} initialStatus={rsvps[week.at] ?? null} initialCount={week.rsvpCount} label="I'm coming" returnTo={href} resumeIntent />
              )}
              {week.rsvpCount > 0 && (
                <div className="ifs-rsvp-card__count">
                  <span className="ifs-avatars">
                    {attendees.map((a) =>
                      a.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={a.userId} src={a.avatarUrl} alt="" />
                      ) : (
                        <i key={a.userId}>{(a.displayName ?? "·").charAt(0)}</i>
                      )
                    )}
                  </span>
                  {week.rsvpCount} going
                </div>
              )}
              {!week.isPast && !cancelled && (canJoin && (joinUrl || hasDetails) ? (
                <>
                  {joinUrl && (
                    // Opens the meeting in a new tab; "Add to calendar" below is a separate control.
                    <a className="ifs-btn ifs-btn--primary" href={joinUrl} target="_blank" rel="noopener noreferrer"><Icon.video />Join the session</a>
                  )}
                  <JoinDetails details={series.joinDetails} />
                </>
              ) : !signedIn ? (
                // The series page's sign-in form (2026-10-13); "I'm coming"
                // above calls it forward and the week is marked on return.
                <SeriesSignIn seriesId={series.id} returnTo={href} />
              ) : (
                <div className="ifs-rsvp-card__gate">
                  <Icon.lock />
                  {canJoin
                    ? "The join link will be posted here before the session."
                    : `The join link shows here to ${site.audience}. Say you're coming to see it.`}
                </div>
              ))}
              {!cancelled && (
                <a className="ifs-btn ifs-btn--small" href={`${seriesHref}/calendar.ics?at=${encodeURIComponent(week.at)}`}><Icon.calendar />Add to calendar</a>
              )}
            </section>

            <section className="ifs-block ifs-week__host" aria-label="Host">
              <p className="ifs-eyebrow">{host ? "Your host" : "Host"}</p>
              {host ? (
                <>
                  <div className="ifs-week__host-row">
                    {host.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={host.avatarUrl} alt="" />
                    ) : (
                      <i aria-hidden="true">{host.name.charAt(0)}</i>
                    )}
                    <div>
                      <b>{host.name}</b>
                      {(host.roleTitle ?? hostProfile?.role) && <span className="ifs-muted">{host.roleTitle ?? hostProfile?.role}</span>}
                    </div>
                  </div>
                  {hostProfile?.bio?.[0] && <p className="ifs-week__bio">{hostProfile.bio[0]}</p>}
                  {host.href && <a className="ifs-link" href={host.href}>More about {host.name.split(" ")[0]} →</a>}
                  {coHost && <p className="ifs-muted" style={{ marginTop: 10 }}>With {coHost.href ? <a className="ifs-link" href={coHost.href}>{coHost.name}</a> : coHost.name}</p>}
                </>
              ) : (
                <p className="ifs-muted">To be announced.</p>
              )}
            </section>

            {(prev || next) && (
              <section className="ifs-block ifs-week__nav" aria-label="Other sessions">
                {prev && (
                  <a href={`${seriesHref}/${prev.number}`}>
                    <span className="ifs-eyebrow">Previous</span>
                    <b>{prev.title ?? `Session ${prev.number}`}</b>
                    <span className="ifs-muted">{dateParts(prev.at, zone).long}</span>
                  </a>
                )}
                {next && (
                  <a href={`${seriesHref}/${next.number}`}>
                    <span className="ifs-eyebrow">Next</span>
                    <b>{next.title ?? `Session ${next.number}`}</b>
                    <span className="ifs-muted">{dateParts(next.at, zone).long}</span>
                  </a>
                )}
              </section>
            )}
          </aside>
        </div>

        <section className="ifs-block ifs-comments" aria-labelledby="comments-h">
          <div className="ifs-block__head"><h2 className="ifs-block__h" id="comments-h">Conversation</h2></div>
          {comments.length === 0 ? (
            <p className="ifs-muted">Nothing said yet. {signedIn ? "Start it below." : ""}</p>
          ) : (
            <ol className="ifs-comments__list">
              {comments.map((r) => (
                <li key={r.id}>
                  <div className="ifs-comments__who">
                    {r.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.author.avatarUrl} alt="" />
                    ) : (
                      <i aria-hidden="true">{r.author.name.charAt(0)}</i>
                    )}
                    <b>{r.author.name}</b>
                    <span className="ifs-faint">{new Date(r.createdAt).toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="ifs-comments__body" dangerouslySetInnerHTML={{ __html: r.contentHtml }} />
                </li>
              ))}
            </ol>
          )}
          <WeekCommentForm seriesId={series.id} occurrenceAt={week.at} signedIn={signedIn} returnTo={href} />
        </section>
      </div>
      <site.chrome.Footer seriesHref={seriesHref} seriesLabel={series.title} />
    </site.chrome.Shell>
  );
}
