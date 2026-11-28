"use client";

import * as React from "react";
import { fmtMoney, dateBlock, hasEnded } from "../format";
import { useNowMs } from "../ended";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { useOpenOffer } from "../page";
import { PersonName } from "../layers-people";
import { Prose } from "../parts";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Event page, "Playbill" (packet frame 2m): poster with a live countdown,
// running order, ticket-stub rail, who is coming, and a photo reel.

function Pulse({ still }: { still?: boolean }) {
  return <span className={`ost-event-pulse${still ? " is-still" : ""}`} aria-hidden />;
}

/** Ticks every second. Draws dashes until mounted, so the server and browser agree. */
function Countdown({ target, quiet, plate }: { target: string; quiet?: boolean; plate?: boolean }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const t0 = new Date(target).getTime();
  // A real page does not count down to a date that has gone.
  if (quiet && now != null && !Number.isNaN(t0) && t0 <= now) return null;
  let s = now == null || Number.isNaN(t0) ? null : Math.max(0, Math.floor((t0 - now) / 1000));
  const parts: Array<[string, string]> = [];
  if (s == null) {
    parts.push(["days", "--"], ["hrs", "--"], ["min", "--"], ["sec", "--"]);
  } else {
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;
    const p = (n: number) => String(n).padStart(2, "0");
    parts.push(["days", p(d)], ["hrs", p(h)], ["min", p(m)], ["sec", p(s)]);
  }
  const clock = (
    <div className="ost-event-count" role="timer" aria-label="Time until doors">
      <span className="ost-event-count-label">DOORS IN</span>
      {parts.map(([u, v]) => (
        <span key={u} className="ost-event-count-cell">
          <span key={u === "sec" ? `s${v}` : u} className={`ost-event-count-num${u === "sec" ? " is-tick" : ""}`}>
            {v}
          </span>
          <span className="ost-event-count-unit">{u.toUpperCase()}</span>
        </span>
      ))}
    </div>
  );
  return plate ? <div className="ost-event-plate">{clock}</div> : clock;
}

const TILE_W = [128, 92, 156, 110, 136, 96, 146];

function Reel({ photos }: { photos: string[] }) {
  const base = photos.length > 0 ? photos : ["", "", "", "", "", ""];
  const tiles = [0, 1].flatMap((r) =>
    base.map((src, i) => (
      <div
        key={`${r}-${i}`}
        className={`ost-event-tile${src ? "" : " osf-ph"}`}
        style={{ width: TILE_W[i % TILE_W.length] }}
        aria-hidden={r === 1}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" />
        ) : i % 3 === 0 ? (
          "guest photo"
        ) : null}
      </div>
    ))
  );
  return (
    <div className="ost-event-reel">
      <div className="ost-event-reel-track">{tiles}</div>
    </div>
  );
}

export function EventTemplate({ data }: TemplateProps) {
  const openOffer = useOpenOffer();
  const { open } = useSurface();
  const now = useNowMs();
  const f = data.featured;
  const x = data.extras;
  if (!f) {
    return (
      <TemplateShell data={data} template="event">
        <div className="ost-event-empty">Nothing is on at the moment.</div>
      </TemplateShell>
    );
  }
  const tz = f.when?.timeZone;
  const b = f.when?.start ? dateBlock(f.when.start, tz) : null;
  const dateLine = b ? `${b.weekday} ${b.day} ${b.month}` : null;
  const timeLine = b ? b.time.toLowerCase() : null;
  const poster = f.poster ?? f.images?.[0] ?? null;
  const coming = f.capacity?.coming ?? x.attendees?.length ?? 0;
  const limit = f.capacity?.limit ?? null;
  const cost = f.price ? fmtMoney(f.price) : "Free";
  const takeLabel = f.takeUp === "rsvp" ? `${cost} · RSVP` : cost;
  const cta = f.takeUp === "rsvp" ? "I’m coming" : f.takeUp === "pay" ? "Get a ticket" : "More details";
  const photos = x.photos ?? [];
  const people = (x.attendees ?? []).slice(0, 4);
  const hosts = [f.hostId, ...(f.coHostIds ?? [])].filter(Boolean);
  // Draws live until mounted, then switches (the countdown does the same), so the server and browser agree.
  const ended = now != null && hasEnded(f, now);
  const kicker = [ended ? "Past event" : "Live event", x.category].filter(Boolean).join(" · ");
  const sandbox = Boolean(data.placeholders);
  const showReel = photos.length > 0 || sandbox;
  const showFaces = people.length > 0 || sandbox;

  return (
    <TemplateShell data={data} template="event">
      <div className="ost-event">
        <div className="ost-event-top">
          <section className="ost-event-main">
            <div className="ost-event-kicker">
              <Pulse still={ended} />
              <span>{kicker}</span>
            </div>
            <h1 className="ost-event-title">{f.title}</h1>
            {f.standfirst && <p className="ost-event-sub">{f.standfirst}</p>}
            <div className="ost-event-body">
              {poster || sandbox ? (
                <div className={`ost-event-poster${poster ? "" : " osf-ph"}`}>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" />
                  ) : (
                    <span className="ost-event-poster-label">event poster · 16:9</span>
                  )}
                  {f.when?.start && !ended && (
                    <div className="ost-event-count-wrap">
                      <Countdown target={f.when.start} quiet={!sandbox} />
                    </div>
                  )}
                </div>
              ) : (
                f.when?.start && !ended && (
                  <Countdown target={f.when.start} quiet plate />
                )
              )}
              {!sandbox && f.description && <Prose className="ost-body ost-event-desc" text={f.description} />}
              {x.program && x.program.length > 0 && (
                <div className="ost-event-order">
                  <span className="ost-event-label">Running order</span>
                  <ol className="ost-event-rows">
                    {x.program.map((r, i) => (
                      <li key={i} className="ost-event-row">
                        <span className="ost-event-row-time">{r.time}</span>
                        <span className="ost-event-row-label">{r.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>

          <aside className="ost-event-rail" aria-label="Tickets">
            <div className="ost-event-stub">
              <div className="ost-event-when">
                {dateLine && <span className="ost-event-when-day">{dateLine}</span>}
                {timeLine && <span className="ost-event-when-time">{timeLine}</span>}
                {f.venue?.name && <span className="ost-event-venue">{f.venue.name}</span>}
                {(f.venue?.address || f.venue?.online) && <span className="ost-event-addr">{f.venue?.address || "Online"}</span>}
                {x.map ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ost-event-map" src={x.map} alt="" />
                ) : (
                  sandbox && <div className="ost-event-map osf-ph">map</div>
                )}
              </div>
              <div className="ost-event-tear">
                {ended ? (
                  <p className="ost-event-ended">This event has ended.</p>
                ) : (
                  <>
                    <div className="ost-event-tear-row">
                      <span className="ost-event-cost">{takeLabel}</span>
                      {limit != null && (
                        <span className="ost-event-cap">
                          {coming} / {limit}
                        </span>
                      )}
                    </div>
                    <button type="button" className="ost-event-go" onClick={(e) => openOffer(f, e.currentTarget, true)}>
                      {cta}
                    </button>
                  </>
                )}
              </div>
            </div>
            {(showFaces || coming > 0) && <span className="ost-event-label">Who&rsquo;s coming</span>}
            {(showFaces || coming > 0) && (
            <div className="ost-event-faces">
              {(people.length > 0 ? people : sandbox ? [{ name: "" }, { name: "" }, { name: "" }, { name: "" }] : []).map((p, i) => {
                const a = (p as { avatar?: string | null }).avatar;
                return a ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} className="ost-event-face" src={a} alt="" />
                ) : (
                  <i key={i} className="ost-event-face" data-i={i % 4} />
                );
              })}
              <span className="ost-event-faces-n">{coming} coming</span>
            </div>
            )}
            {hosts.length > 0 && (
              <div className="ost-event-hosts">
                <span className="ost-event-label">Hosted by</span>
                <span className="ost-event-hosts-names">
                  {hosts.map((id, i) => (
                    <React.Fragment key={id}>
                      {i > 0 && (i === hosts.length - 1 ? " and " : ", ")}
                      <PersonName id={id} context="Event host" className="ost-event-host" />
                    </React.Fragment>
                  ))}
                </span>
              </div>
            )}
          </aside>
        </div>

        <section className="ost-event-night" aria-label="From the night">
          <div className="ost-event-night-head">
            <span className="ost-event-label">{showReel ? `From the night${photos.length > 0 ? ` · ${photos.length} photos` : ""}` : "The talk"}</span>
            <div className="ost-event-night-btns">
              {/* Add a photo is drawn only: that layer is not built. Talk opens the talk layer. */}
              {showReel && (
                <button type="button" className="osf-btn osf-btn-quiet ost-event-nbtn" aria-disabled="true">
                  + Add a photo
                </button>
              )}
              <button type="button" className="osf-btn osf-btn-primary ost-event-nbtn" onClick={(e) => open(offerDescriptor("talk", f.key), e.currentTarget)}>
                Talk{x.talkCount != null ? ` · ${x.talkCount}` : ""}
              </button>
            </div>
          </div>
          {showReel && <Reel photos={photos} />}
        </section>
      </div>
    </TemplateShell>
  );
}
