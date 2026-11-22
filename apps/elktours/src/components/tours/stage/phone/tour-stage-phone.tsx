"use client";

import Link from "next/link";
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  SurfaceFrame,
  SurfaceStage,
  useSurfaceStage,
  type StageFace,
  type SurfaceStageApi,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { useTourPage, type TourPageData } from "@/blocks/tour/context";
import { stopMark, tourMark } from "@/lib/tour-field-marks";
import { BookingForm } from "@/components/tours/booking-form";
import { StreetView } from "@/components/tours/street-view";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tour-format";
import { toRoman, type StagePhoto, type StageStopData, type StageTake, type TourStageData } from "../types";
import { BOOK, OVERVIEW, placeHasDetails } from "../tour-stage";
import "./tour-stage-phone.css";

/**
 * The tour page's hero stage on a portrait phone, drawn in code from "Tour Hero Stage Phone" (390 x 844) on the
 * cms-ui SurfaceStage phone layout: a 300px media band, the face's card under it (in the page's flow, so the tour
 * details below stay reachable), a docked strip of faces with the Book foot (fixed to the bottom), and the place,
 * About and Book layers as the host's bottom sheets. The palette and type are scoped to the wrapper
 * (tour-stage-phone.css). Visible below 768px only (the page's Split hides it above).
 */

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;

interface Ctx {
  page: TourPageData;
  data: TourStageData;
  stops: StageStopData[];
  bookable: boolean;
}
const PhoneCtx = createContext<Ctx | null>(null);
function useCtx(): Ctx {
  const c = useContext(PhoneCtx);
  if (!c) throw new Error("TourStagePhone surfaces render inside <TourStagePhone>");
  return c;
}

// The design's tones for faces without a picture (media band; the strip repeats them in CSS).
const TONES = ["#6d6559", "#5f6a6e", "#5f5a6e", "#5b5f66", "#6e6150", "#566259", "#6a5d52", "#5d6470", "#6b6457"];
const STRIPES = "repeating-linear-gradient(135deg, rgba(241,236,226,.05) 0 6px, transparent 6px 12px)";

function dedupe(photos: StagePhoto[]): StagePhoto[] {
  const seen = new Set<string>();
  return photos.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

function placeKindLine(s: StageStopData): string {
  return s.place?.title && s.place.title !== s.title ? s.place.title : `Stop ${s.numeral}`;
}

function overviewFactsOf(page: TourPageData): [string, string][] {
  const t = page.tour;
  const facts: [string, string][] = [];
  const dur = formatDuration(t.durationMinutes);
  if (dur) facts.push(["Length", dur]);
  if (t.details.maxParty) facts.push(["Group", `up to ${t.details.maxParty}`]);
  if (t.location) facts.push(["Meet at", t.location]);
  if (t.details.includes.length) facts.push(["Included", t.details.includes.join(", ")]);
  return facts;
}

// ── the controller: what the rest of the phone page reads and drives ─────

export interface TourPhoneApi {
  /** The face the stage has open (OVERVIEW or a stop id); Book is a layer, never the active face. */
  activeFaceId: string;
  /** The open stop, null on the overview. */
  activeStop: { id: string; numeral: string; title: string } | null;
  /** Open a face on the stage and scroll back up to it. */
  selectFace: (id: string) => void;
  /** The departure the visitor picked in the index; the Book bar shows it and the Book sheet preselects it. */
  chosenDepartureId: string | null;
  chooseDeparture: (id: string | null) => void;
  /** True while the stage is scrolled away: the dock keeps only its foot (strip folds away). */
  folded: boolean;
}
interface ControllerInternal extends TourPhoneApi {
  stageRef: { current: SurfaceStageApi | null };
  setActive: (id: string) => void;
}
const ControllerCtx = createContext<ControllerInternal | null>(null);

/** Wraps the phone tree (inside TourPageProvider). TourStagePhone registers its stage here. */
export function TourPhoneProvider({ children }: { children: ReactNode }) {
  const page = useTourPage();
  const stageRef = useRef<SurfaceStageApi | null>(null);
  const [activeFaceId, setActive] = useState(OVERVIEW);
  const [chosenDepartureId, chooseDeparture] = useState<string | null>(null);
  const [folded, setFolded] = useState(false);

  // Folded when less than a third of the stage is on screen.
  useEffect(() => {
    const el = document.querySelector(".tsp-root");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => setFolded((es[0]?.intersectionRatio ?? 1) < 0.34), { threshold: [0, 0.1, 0.2, 0.3, 0.34, 0.4, 0.5, 0.75, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [page]);

  const selectFace = useCallback((id: string) => {
    stageRef.current?.select(id);
    document.querySelector(".tsp-root")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const stop = page?.stage?.stops.find((s) => s.id === activeFaceId) ?? null;
  const value = useMemo<ControllerInternal>(
    () => ({
      activeFaceId,
      activeStop: stop ? { id: stop.id, numeral: stop.numeral, title: stop.title } : null,
      selectFace,
      chosenDepartureId,
      chooseDeparture,
      folded,
      stageRef,
      setActive,
    }),
    [activeFaceId, stop, selectFace, chosenDepartureId, folded]
  );
  return <ControllerCtx.Provider value={value}>{children}</ControllerCtx.Provider>;
}

/** The controller's public side. Outside a TourPhoneProvider it returns an inert default. */
export function useTourPhone(): TourPhoneApi {
  const c = useContext(ControllerCtx);
  return c ?? { activeFaceId: OVERVIEW, activeStop: null, selectFace: () => {}, chosenDepartureId: null, chooseDeparture: () => {}, folded: false };
}
function useController(): ControllerInternal | null {
  return useContext(ControllerCtx);
}

// ── the stage ────────────────────────────────────────────────────────────

export function TourStagePhone({ startAt = "overview" }: { startAt?: "overview" | "first-stop" }) {
  const page = useTourPage();
  const data = page?.stage;
  const ctl = useController();
  const folded = ctl?.folded ?? false;
  const setActive = ctl?.setActive;
  const firstStopId = data?.stops[0]?.id;
  useEffect(() => {
    if (startAt === "first-stop" && firstStopId) setActive?.(firstStopId);
  }, [startAt, firstStopId, setActive]);

  const ctx = useMemo<Ctx | null>(() => {
    if (!page || !data) return null;
    const bookable = !page.unavailable && !!(page.tour.price && page.tour.price > 0) && page.tour.departures.some((d) => d.seatsLeft > 0);
    return { page, data, stops: data.stops, bookable };
  }, [page, data]);

  if (!ctx || !page || !data) return null;
  const { stops, bookable } = ctx;
  const total = toRoman(Math.max(1, stops.length));
  const priced = data.price != null && data.price > 0;

  const faces: StageFace[] = [
    {
      id: OVERVIEW,
      descriptor: { type: "custom", key: "tour-phone-overview", title: page.tour.title, kind: "neutral", size: "stage" },
      title: "The walk",
      numeral: "⌖",
      kicker: "Overview",
      cover: data.overviewPhotos[0]?.url ?? null,
      counter: "Overview",
      crumb: "The walk",
    } as StageFace,
    ...stops.map(
      (s) =>
        ({
          id: s.id,
          descriptor: { type: "custom", key: "tour-phone-stop", title: s.title, kind: "neutral", size: "stage", props: { stopId: s.id } },
          title: s.title,
          numeral: s.numeral,
          mark: String(s.number),
          kicker: placeKindLine(s),
          cover: s.cover,
          counter: `${s.numeral} / ${total}`,
          crumb: `Stop ${s.numeral}`,
        }) as StageFace
    ),
    ...(bookable
      ? [
          {
            id: BOOK,
            descriptor: { type: "custom", key: "tour-phone-book", title: "Book this walk", kind: "event", size: "compact" },
            title: "Book",
            numeral: "◆",
            kind: "event",
            kicker: priced ? formatPrice(data.price, data.currency) : "Book",
            pushes: true,
            crumb: page.tour.title,
          } as StageFace,
        ]
      : []),
  ];

  const startId = startAt === "first-stop" && stops[0] ? stops[0].id : OVERVIEW;

  return (
    <PhoneCtx.Provider value={ctx}>
      <SurfaceStage
        layout="phone"
        faces={faces}
        initialId={startId}
        label={`${page.tour.title}: the walk, stop by stop`}
        custom={CUSTOM}
        urlParam={null}
        className={`tsp-root${folded ? " is-folded" : ""}`}
        onSelect={(id: string) => {
          if (id === BOOK || typeof document === "undefined") return;
          setActive?.(id);
          document.querySelector(".tsp-root .eac-stage-view")?.scrollTo({ top: 0 });
          // The dock is fixed: a face chosen while the page below is on screen brings the stage back into view.
          const top = document.querySelector(".tsp-root")?.getBoundingClientRect().top ?? 0;
          if (top < 0) window.scrollTo({ top: Math.max(0, window.scrollY + top), behavior: "smooth" });
        }}
        media={(face) => <PhoneMedia key={face.id} faceId={face.id} />}
        dockFoot={<PhoneFoot />}
      />
    </PhoneCtx.Provider>
  );
}

const CUSTOM: Record<string, (p: { descriptor: Custom }) => ReactNode> = {
  "tour-phone-overview": () => <OverviewSurface />,
  "tour-phone-stop": ({ descriptor }) => <StopSurface stopId={String(descriptor.props?.stopId ?? "")} />,
  "tour-phone-about": () => <AboutSurface />,
  "tour-phone-book": () => <BookSurface />,
};

// ── media band ───────────────────────────────────────────────────────────

type Slide =
  | { kind: "photo"; label: string; caption: string; photo: StagePhoto }
  | { kind: "sv"; label: string; caption: string }
  | { kind: "film"; label: string; caption: string };

const LOAD: Record<string, [string, string, string]> = {
  sv: ["◎", "Load Street View", "Street View · drag to look around"],
};

/** The 300px band for the open face: tabs, ‹ ›, caption and dots. Street View loads on a tap; the fly-over plays at once. */
function PhoneMedia({ faceId }: { faceId: string }) {
  const { page, data, stops } = useCtx();
  const stage = useSurfaceStage();
  const t = page.tour;
  const at = stops.findIndex((s) => s.id === faceId);
  const stop = at >= 0 ? stops[at]! : null;
  const [gi0, setGi] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  const slides: Slide[] = useMemo(() => {
    if (!stop) {
      // The fly-over leads and plays at once (developer, 2026-11-20); no film: the photos as before.
      const out: Slide[] = data.overviewPhotos.map((p) => ({ kind: "photo", label: "Photo", caption: p.caption ?? t.title, photo: p }));
      if (t.film) out.unshift({ kind: "film", label: "Fly-over", caption: "Fly-over · 3D map" });
      return out;
    }
    const out: Slide[] = dedupe([...stop.stopPhotos, ...stop.placePhotos]).map((p) => ({ kind: "photo", label: "Photos", caption: p.caption ?? stop.title, photo: p }));
    if (stop.streetView) out.push({ kind: "sv", label: "Street View", caption: `Street View at ${stop.title}` });
    return out;
  }, [data, t, stop]);

  const n = slides.length;
  const gi = n ? Math.min(gi0, n - 1) : 0;
  const cur = slides[gi] ?? null;
  const setIdx = (k: number) => setGi((k + n) % n);
  const key = cur?.kind ?? "none";
  const isLoaded = !!loaded[key];
  const tone = !stop ? "#5b5650" : TONES[at % TONES.length]!;
  const bg = `${STRIPES}, linear-gradient(160deg, ${cur && cur.kind === "photo" ? tone : "#3a3f47"}, #1f2228)`;
  const load = cur && cur.kind === "sv" ? LOAD.sv : null;
  const thumbs = (stage?.faces ?? []).filter((f) => !f.pushes && f.id !== BOOK);

  return (
    <>
      <div className="tsp-media__bg" style={{ background: bg }} aria-hidden />
      {cur?.kind === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={cur.photo.url} src={cur.photo.url} alt={cur.photo.alt ?? cur.caption} className="tsp-media__img" />
      )}
      {cur?.kind === "sv" && isLoaded && stop?.streetView && (
        <StreetView
          pose={{ lat: stop.streetView.lat, lng: stop.streetView.lng, heading: stop.streetView.heading, pitch: stop.streetView.pitch, fov: stop.streetView.fov }}
          imageUrl={stop.streetView.stillUrl}
          title={stop.title}
          apiKey={page.googleMapsKey}
          className="tsp-street"
        />
      )}
      {cur?.kind === "film" && t.film && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video className="tsp-media__img" src={t.film.url720 ?? t.film.url} poster={t.film.poster ?? undefined} controls autoPlay muted loop playsInline />
      )}
      {load && !isLoaded && (
        <div className="tsp-media__center" data-no-swipe="">
          <button type="button" className="tsp-load" onClick={() => setLoaded((l) => ({ ...l, [key]: true }))}>
            <span aria-hidden>{load[0]}</span>
            {load[1]}
          </button>
          <span className="tsp-media__note">Loads only when pressed</span>
        </div>
      )}
      {!cur && (
        <div className="tsp-media__center">
          <span className="tsp-media__note">No pictures for this {stop ? "stop" : "walk"} yet</span>
        </div>
      )}
      {n > 1 && (
        // Every slide, not photos only: with the Photos / Street View tabs gone (developer, 2026-11-21) the arrows are the
        // way to Street View and the fly-over.
        <>
          <button type="button" className="tsp-arrow tsp-arrow--prev" data-no-swipe="" onClick={() => setIdx(gi - 1)} aria-label="Previous picture">‹</button>
          <button type="button" className="tsp-arrow tsp-arrow--next" data-no-swipe="" onClick={() => setIdx(gi + 1)} aria-label="Next picture">›</button>
        </>
      )}
      {thumbs.length > 1 && (
        // The stops' thumbnails moved here from the dock's strip (developer, 2026-11-21), on the line the caption and
        // photo credit had: small pictures, the number as big and bold as before.
        <div className="tsp-thumbs" role="tablist" aria-label="The walk, stop by stop" data-no-swipe="">
          {thumbs.map((f, k) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === faceId}
              aria-label={f.id === OVERVIEW ? "The walk" : `Stop ${f.numeral}, ${f.title}`}
              data-face-id={f.id}
              className={`tsp-thumb${f.id === faceId ? " is-on" : ""}`}
              style={{ ["--tone" as string]: TONES[k % TONES.length] }}
              onClick={() => stage?.select(f.id)}
            >
              {f.cover ? <span className="tsp-thumb__pic" style={{ backgroundImage: `url("${f.cover.replace(/"/g, "%22")}")` }} aria-hidden /> : null}
              <span className="tsp-thumb__num" aria-hidden>{f.mark ?? f.numeral}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── the dock's foot ──────────────────────────────────────────────────────

/** Way back pair, tour name with next date and price, the counter and Book. Lives in the host's dock. */
function PhoneFoot() {
  const stage = useSurfaceStage();
  const ctl = useController();
  const { page, data, bookable } = useCtx();
  useEffect(() => {
    if (ctl) ctl.stageRef.current = stage;
    return () => {
      if (ctl) ctl.stageRef.current = null;
    };
  });
  if (!stage) return null;
  const base = stage.faces.filter((f) => !f.pushes)[stage.index];
  const priced = data.price != null && data.price > 0;
  const chosen = ctl?.chosenDepartureId ? page.tour.departures.find((d) => d.id === ctl.chosenDepartureId && d.seatsLeft > 0) : null;
  const nextLine = chosen ? formatDeparture(chosen.startsAt) : data.nextDeparture ? `Next ${formatDeparture(data.nextDeparture.startsAt)}` : "No dates open yet";
  const sub = `${nextLine}${priced ? ` · ${formatPrice(data.price, data.currency)} pp` : ""}`;
  return (
    <>
      <div className="tsp-back">
        <Link href="/tours" className="tsp-back__tours" aria-label="All tours"><span className="tsp-back__chev" aria-hidden>‹</span> TOURS</Link>
        <Link href="/" className="tsp-back__home" aria-label="Home">⌂</Link>
      </div>
      <div className="tsp-foot__name">
        <span className="tsp-foot__title">{page.tour.title}</span>
        <span className="tsp-foot__sub">{sub}</span>
      </div>
      <span className="tsp-foot__count" aria-live="polite">{base?.counter ?? ""}</span>
      {bookable && (
        <button type="button" className="tsp-bookbtn" onClick={() => stage.select(BOOK)}>Book</button>
      )}
    </>
  );
}

// ── shared pieces ────────────────────────────────────────────────────────

function Flow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="tsp-flow" onClick={onClick}>
      <span className="tsp-flow__rule" aria-hidden />
      {children} →
    </button>
  );
}

function PlaceFace({ glyph, kicker, line, pk, onClick }: { glyph: string; kicker: string; line: string; pk: string; onClick: () => void }) {
  return (
    <button type="button" className="tsp-placeface" style={{ "--pk": pk } as CSSProperties} onClick={onClick}>
      <span className="tsp-placeface__bar" aria-hidden />
      <span className="tsp-placeface__medal" aria-hidden>{glyph}</span>
      <span className="tsp-placeface__text">
        <span className="tsp-placeface__kicker">{kicker}</span>
        <span className="tsp-placeface__line">{line}</span>
      </span>
      <span className="tsp-placeface__cue" aria-hidden>+</span>
    </button>
  );
}

function GuideNotes({ takes }: { takes: StageTake[] }) {
  return (
    <>
      {takes
        .filter((x) => x.body)
        .map((tk, k) => (
          <div key={k} className="tsp-guide">
            <span className="tsp-guide__label">Your guide</span>
            <span>
              {tk.body}
              {tk.guideName ? ` · ${tk.guideName}` : ""}
            </span>
          </div>
        ))}
    </>
  );
}

function FactList({ facts }: { facts: [string, string][] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="tsp-facts">
      {facts.map(([k, v]) => (
        <div key={k} className="tsp-facts__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── the overview ─────────────────────────────────────────────────────────

function OverviewSurface() {
  const stage = useSurfaceStage();
  const { page, data, stops } = useCtx();
  const facts = overviewFactsOf(page);
  const first = stops[0];
  return (
    <SurfaceFrame
      kind="neutral"
      title={page.tour.title}
      kicker={`The walk · ${stops.length} ${stops.length === 1 ? "stop" : "stops"}`}
      flush
    >
      <div className="tsp-body tsp-body--fit">
        <FitText watch={`overview|${data.tourLede ?? ""}|${data.tourTakes.length}`}>
          <p className={`tsp-narr${data.tourLede ? "" : " tsp-narr--quiet"}`} {...tourMark(page.fieldEditId, "excerpt")}>{data.tourLede ?? "The walk, stop by stop."}</p>
          <GuideNotes takes={data.tourTakes} />
        </FitText>
        {first && <Flow onClick={() => stage?.select(first.id)}>Start with stop {first.numeral}, {first.title}</Flow>}
        {facts.length > 0 && (
          <PlaceFace
            glyph="⌖"
            kicker="About this tour"
            line={facts.map(([, v]) => v).slice(0, 3).join(" · ")}
            pk="var(--sf-kind)"
            onClick={() => stage?.push({ type: "custom", key: "tour-phone-about", title: "About this tour", kind: "neutral", size: "standard" })}
          />
        )}
      </div>
    </SurfaceFrame>
  );
}

// ── a stop ───────────────────────────────────────────────────────────────

/** The description region of a card: its text shrinks until it fits, so the card never scrolls (developer, 2026-11-21). */
const FIT_MIN = 0.7;
function FitText({ children, watch }: { children: ReactNode; watch: string }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      let k = 1;
      el.style.setProperty("--tsp-fit", "1");
      while (k > FIT_MIN && el.scrollHeight > el.clientHeight + 1) {
        k = Math.round((k - 0.03) * 100) / 100;
        el.style.setProperty("--tsp-fit", String(k));
      }
      // Still too long at the smallest size: let this one scroll rather than cut it off.
      if (el.scrollHeight > el.clientHeight + 1) el.dataset.scroll = "";
      else delete el.dataset.scroll;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [watch]);
  return <div ref={box} className="tsp-fit">{children}</div>;
}

/** A stop's place facts, excerpt and links (all already loaded). Also used by the route list below the stage. */
export function PlaceDetails({ stop, hideAddress = false, hideKicker = false }: { stop: StageStopData; hideAddress?: boolean; hideKicker?: boolean }) {
  const place = stop.place;
  if (!place) return null;
  const facts: [string, string][] = [];
  if (stop.durationMinutes) facts.push(["Time here", formatDuration(stop.durationMinutes) ?? ""]);
  if (place.address && !hideAddress) facts.push(["Address", place.address]);
  if (place.ticket) facts.push(["Entry", place.ticket]);
  if (place.hours) facts.push(["Open", place.hours]);
  const links: { label: string; url: string }[] = [
    ...(place.website ? [{ label: "Website", url: place.website }] : []),
    ...place.links.map((l) => ({
      label: l.kind === "wikipedia_en" ? "Wikipedia" : l.kind === "wikipedia_fr" ? "Wikipédia (fr)" : l.kind === "wikidata" ? "Wikidata" : "OpenStreetMap",
      url: l.url,
    })),
  ];
  return (
    <>
      {!hideKicker && <span className="tsp-placecard__kicker">Place · {place.title}</span>}
      <FactList facts={facts} />
      {place.excerpt && <p className="tsp-about">{place.excerpt}</p>}
      {links.length > 0 && (
        <div className="tsp-links">
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="tsp-chip">{l.label} ↗</a>
          ))}
          <a href={`/places?place=${encodeURIComponent(place.slug)}`} className="tsp-chip">Place page →</a>
        </div>
      )}
    </>
  );
}

const MAGNIFIER = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <circle cx="10" cy="10" r="6.2" />
    <path d="M15 15l5.5 5.5" />
  </svg>
);

function StopSurface({ stopId }: { stopId: string }) {
  const stage = useSurfaceStage();
  const { page, data, stops } = useCtx();
  const [placeOpen, setPlaceOpen] = useState(false);
  useEffect(() => setPlaceOpen(false), [stopId]);
  const at = stops.findIndex((s) => s.id === stopId);
  const stop = stops[at];
  if (!stop) return null;
  const next = stops[at + 1] ?? null;
  const walk = next && next.number === stop.number + 1 && stop.walkMinutesToNext ? stop.walkMinutesToNext : null;
  const total = toRoman(data.stops.length);
  const hasPlace = !!stop.place && placeHasDetails(stop);

  const crumb = (
    <>
      <button type="button" className="eac-surface-crumb" onClick={() => stage?.select(OVERVIEW)}>
        ‹ The walk
      </button>
      <span className="eac-surface-sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      Stop {stop.numeral} of {total}
    </>
  );

  return (
    <SurfaceFrame
      kind="neutral"
      title={stop.title}
      kicker={crumb}
      flush
      // The number tile becomes a magnifier when the place has details (developer, 2026-11-21); a tap opens them over the
      // text, a second tap closes them. Without details the tile keeps the number.
      glyphAction={hasPlace ? { label: placeOpen ? "Close the place details" : "Show the place details", icon: MAGNIFIER, pressed: placeOpen, onClick: () => setPlaceOpen((o) => !o) } : undefined}
    >
      <div className="tsp-body tsp-body--fit">
        <FitText watch={`${stop.id}|${stop.narrative ?? ""}|${stop.takes.length}`}>
          {stop.narrative ? (
            <p className="tsp-narr" {...stopMark(page.fieldEditId, stop.id)}>{stop.narrative}</p>
          ) : page.fieldEditId ? (
            // The tour's guide: an empty line to click and fill in (the address and length stand in until it is written).
            <p className="tsp-narr tsp-narr--quiet" {...stopMark(page.fieldEditId, stop.id)}>
              {[stop.place?.address ?? null, stop.durationMinutes ? `${stop.durationMinutes} min here` : null].filter(Boolean).join(" · ") || "Write what guests see and hear at this stop."}
            </p>
          ) : (
            // No line written yet: where it is and how long, muted (never the title again, it is in the masthead).
            !!(stop.place?.address || stop.durationMinutes) && (
              <p className="tsp-narr tsp-narr--quiet">
                {[stop.place?.address ?? null, stop.durationMinutes ? `${stop.durationMinutes} min here` : null].filter(Boolean).join(" · ")}
              </p>
            )
          )}
          {!stop.narrative && page.canEdit && !page.fieldEditId && (
            <a href="/hub" className="tsp-edit-hint">Write this stop&apos;s line (hub › Create a tour)</a>
          )}
          <GuideNotes takes={stop.takes} />
        </FitText>
        {next ? (
          <Flow onClick={() => stage?.select(next.id)}>
            Then {next.numeral}, {next.title}
            {walk ? ` · ${walk} min walk` : ""}
          </Flow>
        ) : (
          <Flow onClick={() => stage?.select(OVERVIEW)}>The end of the walk · back to the overview</Flow>
        )}
        {hasPlace && placeOpen && (
          // Over the description only: the head and the dock stay.
          <div className="tsp-placecard" role="region" aria-label={`Place details: ${stop.place!.title}`} data-no-swipe="">
            <PlaceDetails stop={stop} />
          </div>
        )}
      </div>
    </SurfaceFrame>
  );
}

// ── the layers: place, about, book (host draws them as sheets) ───────────

function AboutSurface() {
  const { page, stops } = useCtx();
  const facts = overviewFactsOf(page);
  const dur = formatDuration(page.tour.durationMinutes);
  return (
    <SurfaceFrame
      kind="neutral"
      title="About this tour"
      kicker="Tour"
      flush
      status={<>{stops.length} {stops.length === 1 ? "stop" : "stops"}{dur ? ` · ${dur}` : ""}</>}
    >
      <div className="tsp-sheet__body">
        <FactList facts={facts} />
      </div>
    </SurfaceFrame>
  );
}

function BookSurface() {
  const { page, data } = useCtx();
  const ctl = useController();
  const t = page.tour;
  const label = formatPrice(t.price, t.currency);
  const priced = data.price != null && data.price > 0;
  return (
    <SurfaceFrame kind="event" title="Book this walk" kicker="Book" flush>
      <div className="tsp-sheet__body">
        <p className="tsp-price">
          {label}
          {priced ? <span> per person</span> : null}
        </p>
        <div className="tsp-form" data-no-swipe="">
          <Suspense>
            <BookingForm
              tourSlug={t.slug}
              departures={t.departures}
              priceLabel={label}
              pricePerPerson={t.price}
              currency={t.currency}
              maxParty={page.maxParty}
              unavailable={page.unavailable}
              signedInEmail={page.signedInEmail}
              tourTitle={t.title}
              contactEmail={page.contactEmail}
              initialDepartureId={ctl?.chosenDepartureId ?? null}
            />
          </Suspense>
        </div>
      </div>
    </SurfaceFrame>
  );
}

