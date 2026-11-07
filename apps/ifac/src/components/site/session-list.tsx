"use client";

import { useEffect, useState } from "react";
import { Icon } from "@elkdonis/series-site/components/icons";
import { SeriesRsvp } from "@elkdonis/series-site/components/series-rsvp";
import { CoverMedia, weekCover } from "@elkdonis/series-site/components/cover-media";

export interface SessionRowHost {
  name: string;
  avatarUrl: string | null;
  href: string | null;
  roleTitle: string | null;
}

export interface SessionRow {
  at: string;
  number: number;
  isPast: boolean;
  isNext: boolean;
  title: string | null;
  subtitle?: string | null;
  summary: string | null;
  /** The rich write-up, sanitised on write (meeting-series.ts); falls back to `summary`. */
  bodyHtml?: string | null;
  coverImageUrl: string | null;
  coverFrame?: { fx: number; fy: number; zoom: number } | null;
  materials: Array<{ id: string; name: string; url: string; kind: "image" | "video" | "audio" | "document" }>;
  /** The week has materials this viewer may not see (signed out, or no IFAC role); `materials` is then empty. */
  materialsLocked?: boolean;
  host: SessionRowHost | null;
  coHost: SessionRowHost | null;
  rsvpCount: number;
  viewerStatus: "yes" | "maybe" | "no" | null;
  date: { weekday: string; day: string; month: string; long: string };
  timeLine: string;
  calendarUrl: string;
}

/**
 * The coming weeks as a list: date box, title, host; the next week open,
 * the rest collapsed. Click a row to open it.
 */
export function SessionList({ sessions, seriesId, signedIn, returnTo }: { sessions: SessionRow[]; seriesId: string; signedIn: boolean; returnTo: string }) {
  const [openAt, setOpenAt] = useState<string | null>(sessions.find((s) => s.isNext)?.at ?? sessions[0]?.at ?? null);

  // Arriving at #week-<n> (the landing's "RSVP for …", "RSVP for next week
  // instead", the return from sign-in): open that week, then put its top
  // below the sticky header. The browser's own jump happens before this
  // opens the card and closes the one above it, and before the web fonts
  // reflow the heading, so it scrolls once more after both. The offset is
  // the card's scroll-margin-top (site.css).
  const [scrollTo, setScrollTo] = useState<{ n: number } | null>(null);
  useEffect(() => {
    function openFromHash() {
      const m = /^#week-(\d+)$/.exec(window.location.hash);
      if (!m) return;
      const target = sessions.find((s) => s.number === Number(m[1]));
      if (!target) return;
      setOpenAt(target.at);
      setScrollTo({ n: target.number });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [sessions]);
  useEffect(() => {
    if (!scrollTo) return;
    const scroll = () => document.getElementById(`week-${scrollTo.n}`)?.scrollIntoView({ block: "start" });
    scroll();
    void document.fonts?.ready.then(() => window.requestAnimationFrame(scroll));
  }, [scrollTo]);
  return (
    <div className="ifs-list">
      {sessions.map((s) => {
        const open = s.at === openAt;
        const kicker = s.isNext ? `This week · Session ${s.number}` : s.isPast ? `Past · Session ${s.number}` : `Session ${s.number}`;
        return (
          <article key={s.at} className={`ifs-row${open ? " is-open" : ""}${s.isPast ? " is-past" : ""}`} id={`week-${s.number}`}>
            <div className="ifs-datebox">
              <div className="ifs-datebox__d">{s.date.weekday}</div>
              <div className="ifs-datebox__n">{s.date.day}</div>
              <div className="ifs-datebox__m">{s.date.month}</div>
            </div>
            <button type="button" className="ifs-row__main" aria-expanded={open} onClick={() => setOpenAt(open ? null : s.at)}>
              <span className="ifs-row__k">{kicker}</span>
              <span className={`ifs-row__t${s.title ? "" : " is-empty"}`}>
                {s.title ?? "To be announced"}
                {s.subtitle && <span className="ifs-row__sub">{s.subtitle}</span>}
              </span>
              <span className="ifs-row__h">
                {s.host ? (
                  <>
                    {s.host.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.host.avatarUrl} alt="" />
                    ) : (
                      <i aria-hidden="true" />
                    )}
                    <span>
                      {s.host.name}
                      {s.host.roleTitle ? ` · ${s.host.roleTitle}` : ""}
                      {s.coHost ? ` · with ${s.coHost.name}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="ifs-faint">Host to be announced</span>
                )}
              </span>
            </button>
            <div className="ifs-row__side">
              {!s.isPast && (
                <SeriesRsvp
                  seriesId={seriesId}
                  occurrenceAt={s.at}
                  signedIn={signedIn}
                  initialStatus={s.viewerStatus}
                  initialCount={s.rsvpCount}
                  label="I'm coming"
                  small
                  returnTo={`${returnTo}#week-${s.number}`}
                />
              )}
              <button type="button" className="ifs-row__chev" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpenAt(open ? null : s.at)}>
                {open ? <Icon.chevUp /> : <Icon.chevDown />}
              </button>
            </div>

            {open && (
              <div className="ifs-row__detail">
                <div>
                  {s.coverImageUrl && <CoverMedia cover={weekCover(s.coverImageUrl, s.coverFrame)!} className="ifs-row__cover" />}
                  <p className="ifs-muted" style={{ fontSize: "0.95rem", marginBottom: 12 }}>{s.date.long} · {s.timeLine}</p>
                  {s.bodyHtml ? (
                    <div className="ifs-rich" dangerouslySetInnerHTML={{ __html: s.bodyHtml }} />
                  ) : s.summary ? (
                    <p className="ifs-prose">{s.summary}</p>
                  ) : (
                    <p className="ifs-faint">The host hasn't written this week up yet. Check back closer to the day.</p>
                  )}
                  <div className="ifs-row__actions">
                    <a className="ifs-btn ifs-btn--small ifs-btn--primary" href={`${returnTo}/${s.number}`}>See detail page <Icon.arrow /></a>
                    <a className="ifs-btn ifs-btn--small" href={s.calendarUrl}><Icon.calendar />Add to calendar</a>
                    {s.host?.href && <a className="ifs-btn ifs-btn--small" href={s.host.href}>About {s.host.name.split(" ")[0]}</a>}
                  </div>
                </div>
                <div>
                  <h4>Materials for this week</h4>
                  {s.materialsLocked ? (
                    <p className="ifs-rsvp-card__gate" style={{ fontSize: "0.92rem" }}>
                      <Icon.lock />
                      {signedIn ? "Materials are for IFAC members and followers." : "Sign in to see the materials for this week."}
                    </p>
                  ) : s.materials.length > 0 ? (
                    <div className="ifs-materials">
                      {s.materials.map((m) => (
                        <a key={m.id} href={m.url} target="_blank" rel="noopener">
                          {m.kind === "image" ? <Icon.image /> : m.kind === "video" ? <Icon.play /> : m.kind === "audio" ? <Icon.audio /> : <Icon.doc />}
                          <span className="n">{m.name}</span>
                          <span className="x">{m.kind}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="ifs-faint" style={{ fontSize: "0.92rem" }}>Nothing to look at beforehand. Just come.</p>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
