"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArchFrame, BackButton, Chip, Porthole, Sheet, StopTimeline, roman, useIsMobile } from "@/components/mobile";
import { frameStyle } from "@/components/mobile/arch-frame";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { cityMenuDescriptor } from "@/components/surfaces/city-menu-popup";
import { PhoneThemeToggle } from "@/components/mobile/phone-theme";
import { StreetView } from "@/components/tours/street-view";
import type { MobileGuide, MobileTourDetail } from "./types";

// The interactive halves of the phone blocks (masthead sheet, guides accordion, tour hero, route timeline). Split from
// the declarations the way contact-form is: a "use client" module's exports become client references.

const RoutePreviewPhone = dynamic(() => import("@/components/tours/route-preview-phone").then((m) => m.RoutePreviewPhone), { ssr: false });

/* ---- masthead + City sheet (screen 22) ---- */

export function MastheadView(p: { viewer?: { name: string | null; office?: boolean } | null; loginLabel?: string; accountLabel?: string; wordTop?: ReactNode; wordBottom?: ReactNode; city?: ReactNode; line?: ReactNode; cityName: string; issueLabel?: ReactNode; sheetTitle: string; moreTitle: string; moreText: string; suggestLabel?: ReactNode; cover?: string; coverVideo?: string; wash?: number; textAt?: string; coverHeight?: number }) {
  const [open, setOpen] = useState(false);
  const surface = useSurfaceOptional();
  const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
  // With the surface system mounted (the live site) the button opens the cms-ui `city-menu` popup; the Sheet below is the fallback.
  const openMenu = () => {
    if (!surface) return setOpen(true);
    surface.open(cityMenuDescriptor({
      cityName: p.cityName,
      sheetTitle: p.sheetTitle,
      moreTitle: p.moreTitle,
      moreText: p.moreText,
      suggestLabel: str(p.suggestLabel, "Suggest an artist or place"),
      loginLabel: str(p.loginLabel, "Log in"),
      accountLabel: str(p.accountLabel, "Account"),
      viewer: p.viewer ? { name: p.viewer.name, office: Boolean(p.viewer.office) } : null,
    }));
  };
  const hasCover = Boolean(p.cover || p.coverVideo);
  return (
    <header
      className={"blk blk-mmast-root" + (hasCover ? " blk-mmast-root--cover blk-mmast-at-" + (p.textAt === "middle" || p.textAt === "bottom" ? p.textAt : "top") : "")}
      style={hasCover ? ({ "--mmast-wash": String(Math.min(100, Math.max(0, p.wash ?? 55)) / 100), "--mmast-h": Math.min(700, Math.max(200, p.coverHeight ?? 360)) + "px" } as React.CSSProperties) : undefined}
    >
      {hasCover ? (
        <div className="blk-mmast-cover" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.cover ? <img src={p.cover} alt="" /> : null}
          {p.coverVideo ? <video src={p.coverVideo} poster={p.cover || undefined} autoPlay muted loop playsInline preload="metadata" /> : null}
          <span className="blk-mmast-wash" />
        </div>
      ) : null}
      <div className="blk-mmast">
        <div className="blk-mmast-word">
          <span className="blk-mmast-word1">{p.wordTop}</span>
          <span className="blk-mmast-word2">{p.wordBottom}</span>
        </div>
        {p.line ? null : (
          <button type="button" className="blk-mmast-city" aria-haspopup="dialog" onClick={openMenu}>
            <span className="blk-mmast-burger" aria-hidden="true">☰</span>
            <span className="blk-mmast-cityname">{p.city}</span>
          </button>
        )}
      </div>
      {/* With a line, the page heading is a sentence that begins with the city button (2026-11-16, canvas L1). */}
      {p.line ? (
        <h1 className="blk-mmast-line">
          <button type="button" className="blk-mmast-city blk-mmast-city--inline" aria-haspopup="dialog" onClick={openMenu}>
            <span className="blk-mmast-cityname">{p.city}</span>
            <span className="blk-mmast-chev" aria-hidden="true" />
          </button>{" "}
          <span className="blk-mmast-linetext">{p.line}</span>
        </h1>
      ) : null}
      {p.issueLabel ? (
        <div className="blk-mmast-issue">
          <span className="blk-mmast-issue-label">{p.issueLabel}</span>
          <span className="m-rule" aria-hidden="true" />
          <span className="blk-mmast-diamond" />
        </div>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen} title={p.sheetTitle}>
        <div className="blk-mmast-sheet">
          <Link href={p.viewer ? "/account" : "/login"} className="blk-mmast-account">{p.viewer ? (p.viewer.name || p.accountLabel || "Account") : (p.loginLabel || "Log in")}</Link>
          {p.viewer?.office ? <Link href="/manage" className="blk-mmast-account">The Office →</Link> : null}
          <span className="m-kicker">The guide</span>
          <h2>{p.sheetTitle}</h2>
          <div className="blk-mmast-citycard">{p.cityName}</div>
          <span className="m-kicker">{p.moreTitle}</span>
          <p>{p.moreText}</p>
          {p.suggestLabel ? <Link href="/suggest" className="blk-mmast-suggest">{p.suggestLabel}</Link> : null}
          <PhoneThemeToggle />
        </div>
      </Sheet>
    </header>
  );
}

/* ---- guides, expand in place ---- */

export function GuidesView(p: { guides: MobileGuide[]; nowLabel?: ReactNode; profileLabel?: ReactNode; /** A card goes to the profile page instead of opening in place. */ toProfile?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="blk-mg-list">
      {p.guides.map((g) => {
        const open = openId === g.id;
        if (p.toProfile) {
          return (
            <div key={g.id} className="blk-mg-card">
              <Link href={`/people/${g.slug}`} className="blk-mg-head blk-mg-head--link">
                <Porthole size={52} src={g.photo} initial={g.initial} />
                <span className="blk-mg-text">
                  <span className="blk-mg-name">
                    {g.name}
                    {g.craft ? <span className="blk-mg-craft"> · {g.craft}</span> : null}
                  </span>
                  {g.bio ? <span className="blk-mg-bio">{g.bio}</span> : null}
                </span>
                <span className="blk-mg-mark">›</span>
              </Link>
            </div>
          );
        }
        return (
          <div key={g.id} className="blk-mg-card">
            <button type="button" className="blk-mg-head" aria-expanded={open} onClick={() => setOpenId(open ? null : g.id)}>
              <Porthole size={52} src={g.photo} initial={g.initial} />
              <span className="blk-mg-text">
                <span className="blk-mg-name">
                  {g.name}
                  {g.craft ? <span className="blk-mg-craft"> · {g.craft}</span> : null}
                </span>
                {g.bio ? <span className="blk-mg-bio">{g.bio}</span> : null}
              </span>
              <span className="blk-mg-mark">{open ? "–" : "+"}</span>
            </button>
            {open && (
              <div className="blk-mg-open m-fade">
                {g.tours.length > 0 && <span className="m-kicker blk-mg-now">{p.nowLabel}</span>}
                {g.tours.map((t) => (
                  <Link key={t.slug} href={`/tours/${t.slug}`} className="blk-mg-tour">
                    <span className="blk-mg-tour-title">{t.title}</span>
                    <span className="blk-mg-tour-sub">{t.sub}</span>
                  </Link>
                ))}
                <Link href={`/people/${g.slug}`} className="blk-mg-profile">{p.profileLabel}</Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- tour top bar: back, type label, heart (saved on this device, localStorage, guarded) ---- */

const SAVED_KEY = "elk:saved-tours";
function readSaved(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function TourTopbarView(p: { slug: string; savedLabel?: ReactNode }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(readSaved().includes(p.slug)), [p.slug]);
  const toggle = () => {
    const next = !saved;
    setSaved(next);
    try {
      const cur = readSaved().filter((s) => s !== p.slug);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next ? [...cur, p.slug] : cur));
    } catch {
      /* private window or blocked storage: the heart still toggles for this visit */
    }
  };
  return (
    <div className="blk blk-mttop">
      <BackButton href="/tours" />
      <button type="button" className={`m-back blk-mttop-heart${saved ? " is-saved" : ""}`} aria-pressed={saved} aria-label={typeof p.savedLabel === "string" ? p.savedLabel : "Save this tour"} onClick={toggle}>
        {saved ? "♥" : "♡"}
      </button>
    </div>
  );
}

/* ---- tour hero: the cover photo or the live 3D route; the fly-over film is an optional button opening it whole ---- */

type Kind = "map3d" | "photos";

function filmTime(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TourHeroView(p: { tour: MobileTourDetail["hero"]; filmLabel?: ReactNode; mapLabel?: ReactNode; photosLabel?: ReactNode; routeNote?: ReactNode }) {
  const isMobile = useIsMobile();
  const h = p.tour;
  const have: Record<Kind, boolean> = { map3d: !!h.map, photos: h.photos.length > 0 };
  const kinds = (["photos", "map3d"] as Kind[]).filter((k) => have[k]);
  // Photos (the cover) lead; the guide's choice is honoured only between the 3D route and the photos.
  const first: Kind | null = h.lead === "map3d" && have.map3d ? "map3d" : kinds[0] ?? null;
  const [picked, setPicked] = useState<Kind | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [calm, setCalm] = useState(false);
  const [filmOpen, setFilmOpen] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const kind = picked && have[picked] ? picked : first;
  const mapShort = typeof p.mapLabel === "string" && p.mapLabel.toLowerCase().startsWith("preview") ? "Fly-over" : p.mapLabel;
  const photosText = h.photos.length > 1 ? <>{p.photosLabel} · {h.photos.length}</> : p.photosLabel;
  const secs = filmTime(h.film?.seconds);
  const mapNow = kind === "map3d" && !!h.map && isMobile;
  useEffect(() => {
    try { setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* keep autoplay on */ }
  }, []);
  // One live map at a time: mounted while the hero is on screen, destroyed when it scrolls away or Photos is picked.
  useEffect(() => {
    const el = stage.current;
    if (!mapNow || !el || typeof IntersectionObserver === "undefined") { setOnScreen(false); return; }
    const io = new IntersectionObserver(([e]) => { if (e) setOnScreen((was) => (e.intersectionRatio >= 0.25 ? true : e.intersectionRatio === 0 ? false : was)); }, { threshold: [0, 0.25] });
    io.observe(el);
    return () => io.disconnect();
  }, [mapNow, kind]);
  if (!kind && !h.film) return null; // nothing switched on for this tour: no hero, as the design says

  return (
    <section className="blk blk-mth">
      {kind ? (
        <div className="blk-mth-stage" ref={stage}>
          <ArchFrame w={358} h={330} bottom={26} brass src={kind === "map3d" ? h.map?.cover ?? null : null}>
            {kind === "map3d" && h.map && (
              <>
                {mapNow && onScreen ? (
                  <div className="blk-mth-map">
                    <RoutePreviewPhone
                      title={h.title}
                      stops={h.map.stops as never}
                      meetingPoint={h.map.meetingPoint}
                      route={h.map.route as never}
                      durationMinutes={h.map.durationMinutes}
                      experiences={h.map.experiences}
                      autoplay={!calm}
                    />
                  </div>
                ) : (
                  <span className="m-kicker blk-mth-label">{p.routeNote}</span>
                )}
              </>
            )}
            {kind === "photos" && (
              <>
                <div
                  ref={gallery}
                  className="blk-mth-gallery"
                  onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / Math.max(e.currentTarget.clientWidth, 1)))}
                >
                  {h.photos.map((ph, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={ph.url} alt={ph.alt ?? ""} loading={i === 0 ? "eager" : "lazy"} style={frameStyle(ph.frame)} />
                  ))}
                </div>
                {h.photos.length > 1 && (
                  <span className="m-kicker blk-mth-count">
                    {roman(page + 1)} / {roman(h.photos.length)}
                  </span>
                )}
              </>
            )}
          </ArchFrame>
        </div>
      ) : (
        <div className="blk-mth-stage">
          <ArchFrame w={358} h={330} bottom={26} brass src={h.film?.poster ?? null} />
        </div>
      )}
      {kinds.length > 1 && (
        <div className="blk-mth-pills">
          {kinds.map((k) => (
            <Chip key={k} selected={k === kind} onClick={() => setPicked(k)}>
              {k === "map3d" ? mapShort : photosText}
            </Chip>
          ))}
        </div>
      )}
      {h.film && (
        <div className="blk-mth-filmrow">
          <button type="button" className="blk-mth-filmbtn" onClick={() => setFilmOpen(true)}>
            <span aria-hidden="true">▶</span> {p.filmLabel}{secs ? ` · ${secs}` : ""}
          </button>
          <Sheet open={filmOpen} onOpenChange={setFilmOpen} title={typeof p.filmLabel === "string" ? p.filmLabel : "Fly-over film"}>
            {/* The whole 16:9 frame, never cropped: the map credit and "promotional use only" sit in its edges. */}
            <div className="blk-mth-sheetfilm">
              {filmOpen && <video src={h.film.url720 ?? h.film.url} poster={h.film.poster ?? undefined} controls autoPlay playsInline preload="metadata" aria-label={h.title} />}
            </div>
          </Sheet>
        </div>
      )}
    </section>
  );
}

/* ---- Discover featured card without a cover photo: the 3D route as its cover (2026-11-17) ---- */

export function FeaturedRouteMap(p: { map: NonNullable<MobileTourDetail["hero"]["map"]>; title: string }) {
  const isMobile = useIsMobile();
  const box = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    try { setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* keep autoplay on */ }
  }, []);
  // Same rule as the tour hero: one live map, mounted while the card is on screen, freed when it scrolls away.
  useEffect(() => {
    const el = box.current;
    if (!isMobile || !el || typeof IntersectionObserver === "undefined") { setOnScreen(false); return; }
    const io = new IntersectionObserver(([e]) => { if (e) setOnScreen((was) => (e.intersectionRatio >= 0.25 ? true : e.intersectionRatio === 0 ? false : was)); }, { threshold: [0, 0.25] });
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile]);
  return (
    <div ref={box} className="blk-mft-map">
      {isMobile && onScreen ? (
        <RoutePreviewPhone
          title={p.title}
          stops={p.map.stops as never}
          meetingPoint={p.map.meetingPoint}
          route={p.map.route as never}
          durationMinutes={p.map.durationMinutes}
          experiences={p.map.experiences}
          autoplay={!calm}
          bare
        />
      ) : null}
    </div>
  );
}

/* ---- the route: stops with inline expand ---- */

export function TourRouteView(p: { stops: MobileTourDetail["stops"]; mapsKey?: string | null; experiencePrefix?: ReactNode; placeLabel?: ReactNode }) {
  // ?stop=<place id> (from the place sheet, G5) opens that stop on arrival.
  const stopParam = useSearchParams().get("stop");
  const [open, setOpen] = useState<number | null>(() => {
    const i = stopParam ? p.stops.findIndex((s) => s.placeId === stopParam) : -1;
    return i >= 0 ? i : null;
  });
  return (
    <StopTimeline
      stops={p.stops.map((s) => ({
        name: s.name,
        when: s.when ?? undefined,
        note: s.note ?? undefined,
        thumb: s.still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="blk-mtr-thumb" src={s.still} alt="" loading="lazy" />
        ) : undefined,
        extra: (
          <>
            {/* Opened stop: the live panorama, turnable, in the still's window (developer, 2026-11-17), as on the
                desktop page. Only the open stop is drawn, so one panorama loads at a time. */}
            {s.pose && p.mapsKey ? (
              <StreetView pose={s.pose} imageUrl={s.still} title={s.name} apiKey={p.mapsKey} className="blk-mtr-pano" />
            ) : s.still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="blk-mtr-still" src={s.still} alt="" loading="lazy" />
            ) : null}
            {s.placeId && (
              <Link href={`?place=${s.placeId}`} scroll={false} className="blk-mtr-pill">
                {p.placeLabel}
              </Link>
            )}
            {s.experience && (
              <Link href={`/experiences/${s.experience.slug}`} className="blk-mtr-pill is-exp">
                {p.experiencePrefix} · {[s.experience.artist, s.experience.title].filter(Boolean).join(" · ")}
              </Link>
            )}
          </>
        ),
      }))}
      openIndex={open}
      onToggle={(i) => setOpen(open === i ? null : i)}
    />
  );
}
