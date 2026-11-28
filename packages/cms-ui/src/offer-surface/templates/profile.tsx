"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { SurfaceIcon, type SurfaceIconKind } from "../icons";
import { useOfferEnv } from "../env";
import { layerFor, offerDescriptor } from "../descriptor";
import { useOpenOffer } from "../page";
import { fmtMoney, hasEnded, monoWhen, shortWhen } from "../format";
import { useNowMs } from "../ended";
import type { SurfaceOffer, SurfaceWritingPiece } from "../types";
import { TemplateShell } from "./shell";
import type { TemplateProps, TemplatePiece } from "./types";

// ============================================================================
// Profile page (packet 3a desktop, 4b phone): who, what is on now, what else is
// offered, a writing shelf. One column in the packet's order, ~800px wide and
// centred; on a phone the offers become full-width list rows.
// The shell's gateway strip is redundant here, so it is off.
// ============================================================================

const KIND_ICON: Record<SurfaceOffer["kind"], SurfaceIconKind> = { event: "evt", service: "svc", series: "ser", artwork: "art", writing: "wr" };
const KIND_WORD: Record<SurfaceOffer["kind"], string> = { event: "Event", service: "Service", series: "Series", artwork: "Artwork", writing: "Writing" };

/** "Mondays · 6 pm PT" from a start instant in its own zone. */
function seriesRhythm(o: SurfaceOffer): string | null {
  const w = o.when;
  if (!w?.start) return null;
  const d = new Date(w.start);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const tz = w.timeZone || undefined;
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(d);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(d);
    return `${day}s · ${time.replace(":00", "").replace(/\s?([AP]M)/, (_m, a: string) => ` ${a.toLowerCase()}`)}`;
  } catch {
    return null;
  }
}

/** The card's meta bits, soonest facts first: price, length, where. */
function metaBits(o: SurfaceOffer, ended?: boolean): string[] {
  const bits: string[] = [];
  if (o.kind === "event") {
    if (ended) bits.push("Past");
    if (o.when?.start) bits.push(shortWhen(o.when.start, o.when.timeZone));
    bits.push(o.price ? fmtMoney(o.price) : "Free");
  } else if (o.kind === "service") {
    if (o.price) bits.push(fmtMoney(o.price));
    if (o.durationMinutes) bits.push(`${o.durationMinutes} min`);
    if (o.venue?.online) bits.push("online");
  } else if (o.kind === "series") {
    const r = seriesRhythm(o);
    if (r) bits.push(r);
    bits.push(o.price ? fmtMoney(o.price) : "free");
  } else if (o.kind === "artwork") {
    if (o.price) bits.push(fmtMoney(o.price));
    if (o.artwork?.edition) bits.push(o.artwork.edition);
  } else if (o.price) bits.push(fmtMoney(o.price));
  return bits;
}

function pieceDate(p: TemplatePiece | SurfaceWritingPiece): string | null {
  const d = (p as TemplatePiece).date;
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC" }).format(t).split(" ").reverse().join(" ").toUpperCase();
}

function pieceMeta(p: TemplatePiece | SurfaceWritingPiece): string {
  const bits: string[] = [];
  const d = pieceDate(p);
  if (d) bits.push(d);
  if (p.minutes) bits.push(`${p.minutes} MIN`);
  return bits.join(" · ");
}

function Kbox({ kind, size }: { kind: SurfaceOffer["kind"]; size: number }) {
  const env = useOfferEnv();
  return (
    <span className="osf-kbox ost-pf-kbox" style={{ ["--osf-kc" as string]: `var(--os-kind-${kind})` }}>
      <SurfaceIcon kind={KIND_ICON[kind]} set={env.data.look.icons} size={size} />
    </span>
  );
}

export function ProfileTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const env = useOfferEnv();
  const openOffer = useOpenOffer();
  const now = useNowMs();
  const o = data.owner;
  const following = env.isFollowing(o.id);
  const f = data.featured;
  const others = data.offers.filter((x) => x.key !== f?.key);
  const [lead, ...rest] = data.writing as Array<TemplatePiece>;
  const readPiece = (key: string, el: HTMLElement) => open(offerDescriptor("wr-read", key), el);
  const toggleFollow = (el: HTMLElement) => open(following ? offerDescriptor("pf-owner", o.id) : offerDescriptor("follow", o.id, { flow: "fol" }), el);
  const poster = f ? f.poster ?? f.images?.[0] ?? null : null;
  const links = o.links ?? [];
  // Live until mounted, then ended when the featured event is over (hydration-safe).
  const ended = now != null && hasEnded(f, now);
  const featuredLabel = !f ? "" : f.kind === "event" ? (ended ? "Open" : f.takeUp === "pay" ? "Get a place" : "I'm coming") : f.kind === "service" ? "Book" : f.kind === "artwork" ? "Order" : "Open";
  const featuredLine = !f ? "" : [stripTags(f.description) || f.standfirst, f.capacity?.coming != null ? `${f.capacity.coming} coming` : ""].filter(Boolean).join(" · ");
  const phoneLine = !f ? "" : [f.capacity?.coming != null ? `${f.capacity.coming} coming` : "", f.venue?.name ?? ""].filter(Boolean).join(" · ");

  return (
    <TemplateShell data={data} template="profile" gateway={false}>
      <div className="ost-pf">
        {/* Header: photo | who | follow */}
        <header className={`ost-pf-head${o.portrait || data.placeholders ? "" : " is-bare"}`}>
          {o.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ost-pf-photo" src={o.portrait} alt="" />
          ) : (
            data.placeholders && (
              <span className="ost-pf-photo osf-ph" aria-hidden>
                <i>photograph</i>
              </span>
            )
          )}
          <div className="ost-pf-who">
            <h1 className="ost-pf-name">{o.name}</h1>
            {o.role && <span className="ost-pf-role">{o.role}</span>}
          </div>
          {o.bio && <p className="ost-pf-bio">{o.bio}</p>}
          <div className="ost-pf-side">
            <button type="button" className={`ost-pf-follow${following ? " is-on" : ""}`} onClick={(e) => toggleFollow(e.currentTarget)}>
              {following ? "✓ Following" : "+ Follow"}
            </button>
            {o.followers != null && <span className="ost-pf-count">{o.followers} FOLLOWING</span>}
            {links.length > 0 && (
              <span className="ost-pf-links">
                {links.map((l, i) => (
                  <React.Fragment key={l.href + l.label}>
                    {i > 0 && <span className="ost-pf-dot" aria-hidden> · </span>}
                    <a href={l.href}>{l.label}</a>
                  </React.Fragment>
                ))}
              </span>
            )}
            {links.length > 0 && (
              <span className="ost-pf-pills">
                {links.slice(0, 2).map((l) => (
                  <a key={l.href + l.label} className="ost-pf-pill" href={l.href}>
                    {l.label === "Website" ? "Site" : l.label === "Instagram" ? "IG" : l.label}
                  </a>
                ))}
              </span>
            )}
          </div>
        </header>

        {/* On now */}
        {f && (
          <section className="ost-pf-sec" aria-label={ended ? "Most recent" : "On now"}>
            <h2 className="ost-pf-label">
              {ended ? "Most recent" : "On now"}<span className="ost-pf-desk"> · this site&apos;s offer page</span>
            </h2>
            <div className="ost-pf-now">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ost-pf-poster" src={poster} alt="" />
              ) : (
                data.placeholders && (
                  <span className="ost-pf-poster osf-ph" aria-hidden>
                    <i>{f.kind} poster</i>
                  </span>
                )
              )}
              <div className="ost-pf-nowbody">
                <div className="ost-pf-nowkick">
                  {!ended && <span className="ost-pf-live" aria-hidden />}
                  <span suppressHydrationWarning>
                    {KIND_WORD[f.kind].toUpperCase()}
                    {f.when?.start ? ` · ${monoWhen(f.when.start, f.when.timeZone)}` : ""}
                  </span>
                </div>
                <h3 className="ost-pf-nowtitle">{f.title}</h3>
                <span className="ost-pf-nowline ost-pf-desk">{featuredLine}</span>
                <span className="ost-pf-nowline ost-pf-mob">{phoneLine}</span>
                <div className="ost-pf-nowbtns">
                  <button type="button" className="ost-pf-btn is-primary" onClick={(e) => openOffer(f, e.currentTarget, true)}>
                    {featuredLabel}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Also offered */}
        {others.length > 0 && (
          <section className="ost-pf-sec" aria-label="Also offered">
            <h2 className="ost-pf-label">
              Also offered<span className="ost-pf-desk"> · opens here</span>
            </h2>
            <div className="ost-pf-cards">
              {others.map((x) => {
                const bits = metaBits(x, now != null && hasEnded(x, now));
                const inner = (
                  <>
                    <span className="ost-pf-plus" aria-hidden>
                      +
                    </span>
                    <Kbox kind={x.kind} size={15} />
                    <span className="ost-pf-ctext">
                      <span className="ost-pf-ckind">{x.kind}</span>
                      <span className="ost-pf-ctitle">{x.title}</span>
                      <span className="ost-pf-cmeta ost-pf-desk">{bits.join(" · ")}</span>
                      <span className="ost-pf-cmeta is-mono ost-pf-mob">{[x.kind, ...bits].join(" · ")}</span>
                    </span>
                  </>
                );
                // Every offer opens its layer here; nothing leaves the page.
                return layerFor(x) ? (
                  <button key={x.key} type="button" className="ost-pf-card" onClick={(e) => openOffer(x, e.currentTarget)}>
                    {inner}
                  </button>
                ) : (
                  <div key={x.key} className="ost-pf-card is-inert" aria-disabled="true">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Writing shelf */}
        {lead && (
          <section className="ost-pf-sec" aria-label="Writing">
            <h2 className="ost-pf-label">
              <span className="ost-pf-desk">Writing shelf · reads in a popup</span>
              <span className="ost-pf-mob">Writing</span>
            </h2>
            <div className="ost-pf-shelf">
              <WritingLead piece={lead} onRead={readPiece} placeholders={data.placeholders} />
              <div className="ost-pf-list">
                {rest.slice(0, 2).map((p) => (
                  <WritingRow key={p.key} piece={p} onRead={readPiece} />
                ))}
                {data.writing.length > 3 && (
                  <button type="button" className="ost-pf-all" onClick={(e) => readPiece(lead.key, e.currentTarget)}>
                    All writing ({data.writing.length}) →
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </TemplateShell>
  );
}

type ReadPiece = (key: string, el: HTMLElement) => void;

const stripTags = (s?: string | null) => (s ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

function WritingLead({ piece, onRead, placeholders }: { piece: TemplatePiece; onRead: ReadPiece; placeholders?: boolean }) {
  const kicker = [piece.series ? piece.series.toUpperCase() : "", pieceDate(piece) ?? ""].filter(Boolean).join(" · ");
  const body = (
    <>
      {piece.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ost-pf-cover" src={piece.cover} alt="" />
      ) : (
        placeholders && (
          <span className="ost-pf-cover osf-ph" aria-hidden>
            <i>cover</i>
          </span>
        )
      )}
      <span className="ost-pf-wkick ost-pf-desk">{kicker || "WRITING"}</span>
      <span className="ost-pf-wtitle">{piece.title}</span>
      {piece.standfirst && <span className="ost-pf-wlead ost-pf-desk">{piece.standfirst}</span>}
      <span className="ost-pf-wmeta ost-pf-mob">{pieceMeta(piece)}</span>
    </>
  );
  return (
    <button type="button" className="ost-pf-lead" onClick={(e) => onRead(piece.key, e.currentTarget)}>
      {body}
    </button>
  );
}

function WritingRow({ piece, onRead }: { piece: TemplatePiece; onRead: ReadPiece }) {
  const body = (
    <>
      <span className="ost-pf-wtitle is-row">{piece.title}</span>
      <span className="ost-pf-wmeta">{pieceMeta(piece)}</span>
    </>
  );
  return (
    <button type="button" className="ost-pf-row" onClick={(e) => onRead(piece.key, e.currentTarget)}>
      {body}
    </button>
  );
}
