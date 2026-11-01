"use client";

import * as React from "react";
import Link from "next/link";
import type { HeroSlide } from "@/lib/home-hero";
import { Countdown } from "@/app/series/[slug]/countdown";

// The landing page's rotating hero (Intro 10): the whole band slides when an
// arrow is pressed. Every slide carries its own pair of arrows, set the same
// distance from the image's edges on both sides.

const longDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-CA", { month: "long", day: "numeric" }) : null);

function Arrow({ dir, onClick, label }: { dir: "prev" | "next"; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`hh-arrow is-${dir}`} aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {dir === "prev" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}

export function HomeHero({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = React.useState(0);
  const n = slides.length;
  const next = React.useCallback(() => setI((x) => (x + 1) % n), [n]);
  const prev = React.useCallback(() => setI((x) => (x - 1 + n) % n), [n]);
  if (n === 0) return null;
  const many = n > 1;

  return (
    <section className="hh" aria-roledescription="carousel" aria-label="Featured on Collect Art">
      <div className="hh-track" style={{ width: `${n * 100}%`, transform: `translateX(-${(100 / n) * i}%)` }}>
        {slides.map((s, k) => (
          <div key={s.kind === "series" ? `series-${s.series.id}` : `artist-${s.storeId}`} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} className="hh-slide" style={{ width: `${100 / n}%` }} aria-hidden={k !== i}>
            {s.kind === "series" ? <SeriesSlide s={s} heading={k === 0} arrows={many ? { prev, next } : null} /> : <ArtistSlide s={s} heading={k === 0} arrows={many ? { prev, next } : null} />}
          </div>
        ))}
      </div>
      {many && (
        <div className="hh-dots" aria-hidden="true">
          {slides.map((_, k) => <span key={k} className={k === i ? "is-on" : undefined} />)}
        </div>
      )}
    </section>
  );
}

type Arrows = { prev: () => void; next: () => void } | null;

function Nav({ arrows }: { arrows: Arrows }) {
  if (!arrows) return null;
  return (
    <>
      <Arrow dir="prev" onClick={arrows.prev} label="Previous" />
      <Arrow dir="next" onClick={arrows.next} label="Next" />
    </>
  );
}

function SeriesSlide({ s, heading, arrows }: { s: Extract<HeroSlide, { kind: "series" }>; heading: boolean; arrows: Arrows }) {
  const H = heading ? "h1" : "h2";
  const opens = longDate(s.series.silentOpensAt);
  const live = longDate(s.series.liveAt);
  const closed = s.series.phase === "closed";
  return (
    <>
      <div className="hh-body">
        <div className="hh-text">
          <p className="hh-kicker">{s.presenterName ? `${s.presenterName} presents` : "Auction series"}</p>
          <H className="hh-title">{s.series.title}</H>
          {s.series.subtitle && <p className="hh-lede">{s.series.subtitle}</p>}
          <div className="hh-actions">
            <Link href={`/series/${s.series.slug}#lots`} className="hh-btn is-accent">See the lots</Link>
            <Link href={`/series/${s.series.slug}`} className="hh-btn is-ghost">Learn about the auction</Link>
          </div>
        </div>
        <div className="hh-figure">
          {s.lot ? (
            <Link href={`/lots/${s.lot.id}`} className="hh-image is-portrait" aria-label={`Lot: ${s.lot.title}${s.lot.artistName ? ` by ${s.lot.artistName}` : ""}. Open the lot`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.lot.imageUrl} alt="" />
            </Link>
          ) : (
            <Link href={`/series/${s.series.slug}`} className="hh-image is-portrait is-empty" aria-label="The lots are revealed when bidding opens">
              <span>Lots revealed {opens ?? "soon"}</span>
            </Link>
          )}
          <Nav arrows={arrows} />
        </div>
      </div>
      <div className="hh-strip is-series"><div className="hh-strip-in">
        <span>
          {s.series.card.eyebrow ?? "Series 1"}
          {live ? ` · Silent bidding until ${live}` : ""}
          {s.series.hostName ? ` · Hosted by ${s.series.hostName}` : ""}
        </span>
        <span>{closed ? "Closed" : s.series.liveAt ? <>Live auction in <Countdown to={s.series.liveAt} className="hh-count" /></> : "Dates to be announced"}</span>
        <span>{s.lotCount} lot{s.lotCount === 1 ? "" : "s"} · {s.artistCount} artist{s.artistCount === 1 ? "" : "s"}</span>
      </div></div>
    </>
  );
}

function ArtistSlide({ s, heading, arrows }: { s: Extract<HeroSlide, { kind: "artist" }>; heading: boolean; arrows: Arrows }) {
  const H = heading ? "h1" : "h2";
  return (
    <>
      <div className="hh-body">
        <div className="hh-text">
          <p className="hh-kicker">Featured artist on Collect Art</p>
          <div className="hh-artist">
            {s.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photoUrl} alt="" className="hh-avatar" />
            ) : (
              <span className="hh-avatar" aria-hidden="true">{s.name.slice(0, 1)}</span>
            )}
            <H className="hh-title is-name">{s.name}</H>
          </div>
          {(s.headline || s.bioText) && <p className="hh-lede">{s.headline ?? s.bioText}</p>}
          <div className="hh-actions">
            <Link href={`/artists/${s.handle}`} className="hh-btn is-accent">See their work</Link>
            <Link href={`/artists/${s.handle}`} className="hh-btn is-ghost">Artist profile</Link>
          </div>
        </div>
        <div className="hh-figure">
          {s.work ? (
            <Link href={`/artworks/${s.work.id}`} className="hh-image" aria-label={`${s.work.title} by ${s.name}: open the piece`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.work.imageUrl} alt="" />
            </Link>
          ) : (
            <Link href={`/artists/${s.handle}`} className="hh-image is-portrait is-empty"><span>See the artist&rsquo;s page</span></Link>
          )}
          <Nav arrows={arrows} />
        </div>
      </div>
      <div className="hh-strip is-artist"><div className="hh-strip-in">
        <span>{s.work ? <>Featured work · <strong>{s.work.title}</strong></> : "Featured artist"}</span>
        <span>{s.work?.priceLabel ? <strong className="hh-count">{s.work.priceLabel}</strong> : ""}</span>
        <span>On the market · {s.workCount} work{s.workCount === 1 ? "" : "s"}</span>
      </div></div>
    </>
  );
}
