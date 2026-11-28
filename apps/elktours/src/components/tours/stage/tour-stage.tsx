"use client";

import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useSyncExternalStore, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  SurfaceFrame,
  SurfaceStage,
  useSurfaceStage,
  type StageFace,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { useTourPage, type TourPageData } from "@/blocks/tour/context";
import { BookingForm } from "@/components/tours/booking-form";
import { StreetView } from "@/components/tours/street-view";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tour-format";
import {
  DEFAULT_TOUR_STAGE,
  toRoman,
  type StagePhoto,
  type StageStopData,
  type StageTake,
  type TourStageData,
  type TourStageOptions,
} from "./types";
import { StageEditProvider, createStageEditStore, useStageEdit } from "./edit/stage-edit-store";
import { StageEditHost } from "./edit/stage-edit-host";
import { StopEditRow } from "./edit/route-chips";
import { StopLineEdit } from "./edit/stop-line-edit";
import { PlacePicturesEdit, StopPicturesEdit } from "./edit/pictures";
import "./tour-stage.css";
import "./edit/stage-edit.css";

// Desktop tour stage, reworked toward design 1a (developer, 2026-11-20): the strip's cards are the cover with the
// stop's number centred and grow over the stage on hover; Book is always in the foot and the last card; the place
// (and, on the overview, "About this tour") grows up inside the narrative column instead of covering the stage; the
// same stage is the tour popup a listing card opens (tour-stage-popup.tsx), framed over the stop's photo.

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;

/** Where the stage is drawn when it is not the tour page's hero: the tour popup. */
export interface TourStageHost {
  /** The popup's close: a ✕ in the stage head. */
  onClose?: () => void;
  /** Stage height as a CSS length (the popup fits the viewport). */
  height?: string;
  /** A quiet link to the tour's own page in the foot. */
  pageHref?: string;
}

/** What every stage surface reads: the merged options, the stage data and the page's tour. */
interface Ctx {
  o: TourStageOptions;
  data: TourStageData;
  page: TourPageData;
  /** Stops that get a face (perStop `hidden` removed); numbering is by position in the whole tour. */
  visible: StageStopData[];
  bookable: boolean;
  pageHref: string | null;
}
const StageCtx = createContext<Ctx | null>(null);
function useStageCtx(): Ctx {
  const c = useContext(StageCtx);
  if (!c) throw new Error("TourStage surfaces render inside <TourStage>");
  return c;
}

export const OVERVIEW = "overview";
export const BOOK = "book";

/** Cut at a word with an ellipsis when over `max`. */
export function clip(text: string, max: number): string {
  if (max <= 0 || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

export function firstClause(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/^[^,;:.!?—–]{12,90}/);
  return (m ? m[0] : text.slice(0, 80)).trim();
}

/** The stop's pictures for its media option (and the per-stop override). */
function photosFor(stop: StageStopData, media: TourStageOptions["media"]): StagePhoto[] {
  if (media === "place") return stop.placePhotos.length ? stop.placePhotos : stop.stopPhotos;
  if (media === "stop") return stop.stopPhotos;
  const seen = new Set<string>();
  return [...stop.stopPhotos, ...stop.placePhotos].filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

// ── the stage ────────────────────────────────────────────────────────────

export function TourStage({ host, ...props }: Partial<TourStageOptions> & { host?: TourStageHost }) {
  const page = useTourPage();
  const o: TourStageOptions = { ...DEFAULT_TOUR_STAGE, ...props, perStop: { ...DEFAULT_TOUR_STAGE.perStop, ...(props.perStop ?? {}) } };
  const data = page?.stage;
  // null until the visitor picks a face: the backdrop then follows the face the stage opened on (startAt).
  const [active, setActive] = useState<string | null>(null);
  const pageHref = host?.pageHref ?? null;
  // Editors only, on the tour page itself (not the popup, not the phone): the stage can be edited where it is read.
  const [store] = useState(createStageEditStore);
  const editable = !host && !!page?.canEdit;
  const editing = useStageEdit_(store, editable);
  useEffect(() => {
    if (!editable) return;
    const on = () => store.set({ editing: true });
    window.addEventListener("elk:stage-edit", on);
    return () => window.removeEventListener("elk:stage-edit", on);
  }, [editable, store]);

  const ctx = useMemo<Ctx | null>(() => {
    if (!page || !data) return null;
    const visible = data.stops.filter((s) => !o.perStop[s.id]?.hidden);
    const bookable = !page.unavailable && !!(page.tour.price && page.tour.price > 0) && page.tour.departures.some((d) => d.seatsLeft > 0);
    return { o, data, page, visible, bookable, pageHref };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, data, JSON.stringify(o), pageHref]);

  if (!ctx) return null;
  const { visible } = ctx;
  const total = data!.stops.length;
  const priced = data!.price != null && data!.price > 0;

  const faces: StageFace[] = [
    {
      id: OVERVIEW,
      descriptor: { type: "custom", key: "tour-stage-overview", title: page!.tour.title, kind: "neutral", size: "stage" },
      title: "The walk",
      numeral: "⌖",
      kicker: `Overview · ${total} ${total === 1 ? "stop" : "stops"}`,
      teaser: data!.tourLede ? clip(data!.tourLede, 120) : null,
      cover: data!.overviewPhotos[0]?.url ?? null,
      counter: "Overview",
    } as StageFace,
    ...visible.map(
      (s) =>
        ({
          id: s.id,
          descriptor: { type: "custom", key: "tour-stage-stop", title: s.title, kind: "neutral", size: "stage", props: { stopId: s.id } },
          title: s.title,
          numeral: s.numeral,
          // The strip shows a plain number over the cover (developer, 2026-11-20); the head keeps the numeral.
          mark: String(s.number),
          kicker: `Stop ${s.numeral}`,
          teaser: firstClause(s.narrative) ?? (s.place?.address ? s.place.address : null),
          cover: s.cover,
          counter: `${s.numeral} / ${toRoman(total)}`,
        }) as StageFace
    ),
    // Book is always the last card and always in the foot (design 1a); when the tour cannot be sold yet, the
    // layer says why and offers an email instead (BookingForm's AskInstead).
    {
      id: BOOK,
      descriptor: { type: "custom", key: "tour-stage-book", title: "Book this walk", kind: "event", size: "compact" },
      title: "Book",
      numeral: "◆",
      mark: "Book",
      kind: "event",
      kicker: "Book",
      teaser: priced ? `${formatPrice(data!.price, data!.currency)} per person` : "Ask about a date",
      pushes: true,
      crumb: page!.tour.title,
    } as StageFace,
  ];

  const startId = o.startAt === "first-stop" && visible[0] ? visible[0].id : OVERVIEW;
  const activeStop = visible.find((s) => s.id === (active ?? startId));
  const backdropUrl = activeStop ? activeStop.cover : data!.overviewPhotos[0]?.url ?? null;

  return (
    <StageEditProvider value={editable ? store : null}>
    <StageCtx.Provider value={ctx}>
      <SurfaceStage
        faces={faces}
        initialId={startId}
        label={`${page!.tour.title}: the walk, stop by stop`}
        custom={CUSTOM}
        showStrip={o.showStrip}
        height={host?.height ?? o.height}
        urlParam={null}
        className={`ts-root${host ? " ts-root--popup" : ""}${editing ? " ts-root--editing" : ""}`}
        onClose={host?.onClose}
        onSelect={(id: string) => {
          if (id !== BOOK) setActive(id);
        }}
        backdrop={
          <div className="ts-backdrop" aria-hidden>
            {backdropUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backdropUrl} alt="" className="ts-backdrop__img" />
            )}
            <div className="ts-backdrop__shade" />
          </div>
        }
        backdropCaption={
          activeStop ? (
            <span className="ts-backdrop__cap">
              Stop {activeStop.numeral} · {activeStop.title}
            </span>
          ) : null
        }
      />
      {editing && page ? <StageEditHost tourId={page.tour.id} store={store} /> : null}
    </StageCtx.Provider>
    </StageEditProvider>
  );
}

/** Whether edit mode is on (only ever true where editing is offered). */
function useStageEdit_(store: ReturnType<typeof createStageEditStore>, editable: boolean): boolean {
  const on = useSyncExternalStore(store.subscribe, () => store.get().editing, () => false);
  return editable && on;
}

const CUSTOM: Record<string, (p: { descriptor: Custom }) => ReactNode> = {
  "tour-stage-overview": () => <OverviewSurface />,
  "tour-stage-stop": ({ descriptor }) => <StopSurface stopId={String(descriptor.props?.stopId ?? "")} />,
  "tour-stage-book": () => <BookSurface />,
};

// ── shared pieces ────────────────────────────────────────────────────────

function FootStatus() {
  const { data, page } = useStageCtx();
  const priced = data.price != null && data.price > 0;
  return (
    <span className="ts-status">
      <strong>{page.tour.title}</strong>
      {data.nextDeparture ? (
        <>
          {" "}
          · Next walk {formatDeparture(data.nextDeparture.startsAt)}
          {priced ? ` · ${formatPrice(data.price, data.currency)} per person` : ""}
        </>
      ) : (
        <> · No dates open yet{priced ? ` · ${formatPrice(data.price, data.currency)} per person` : ""}</>
      )}
    </span>
  );
}

/** The foot's buttons: the tour page (in the popup), the face's own, then Book, always the one primary. */
function useFootActions(own: SurfaceAction[]): SurfaceAction[] {
  const stage = useSurfaceStage();
  const { pageHref } = useStageCtx();
  const edit = useStageEdit();
  return [
    ...(edit && !edit.editing ? [{ label: "Edit this page", quiet: true, onClick: () => edit.store.set({ editing: true }) } as SurfaceAction] : []),
    ...(pageHref ? [{ label: "Tour page", href: pageHref, quiet: true } as SurfaceAction] : []),
    ...own,
    { label: "Book", primary: true, onClick: () => stage?.select(BOOK) },
  ];
}

function Takes({ takes }: { takes: StageTake[] }) {
  const list = takes.filter((t) => t.body);
  if (list.length === 0) return null;
  return (
    <div className="ts-take">
      <span className="ts-take__label">From your guide</span>
      {list.map((t, i) => (
        <p key={i}>
          {t.body}
          {t.guideName ? <span className="ts-take__by"> · {t.guideName}</span> : null}
        </p>
      ))}
    </div>
  );
}

function Facts({ facts }: { facts: [string, string][] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="ts-facts ts-facts--grid">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A one-line face at the foot of the narrative column that grows up over the narrative to show what it holds
 * (design 1a's place sheet, "growing vertical a bit": its height follows its content, capped at the column).
 * It never covers the media or the strip. Closing returns to the one line.
 */
function GrowPanel({
  tone,
  medal,
  kicker,
  line,
  crumb,
  title,
  foot,
  children,
}: {
  tone: "place" | "tour";
  medal: string;
  kicker: string;
  line: string;
  crumb: string;
  title: string;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState<number | null>(null);
  const box = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // Measure the open content's natural height; the transition runs from the one line (62px) to it.
  useLayoutEffect(() => {
    if (!open || !box.current) return;
    let n = 2; // borders
    for (const el of Array.from(box.current.children) as HTMLElement[]) n += el === body.current ? el.scrollHeight : el.offsetHeight;
    setH(n);
  }, [open]);

  return (
    <section
      ref={box}
      className={`ts-grow ts-grow--${tone}`}
      data-open={open || undefined}
      style={{ height: open && h ? h : 62 }}
    >
      {!open ? (
        <button type="button" className="ts-grow__line" aria-expanded={false} onClick={() => setOpen(true)}>
          <span className="ts-grow__medal" aria-hidden>
            {medal}
          </span>
          <span className="ts-grow__text">
            <span className="ts-grow__kicker">{kicker}</span>
            <span className="ts-grow__sub">{line}</span>
          </span>
          <span className="ts-grow__cue" aria-hidden>
            +
          </span>
        </button>
      ) : (
        <>
          <header className="ts-grow__head">
            <span className="ts-grow__medal" aria-hidden>
              {medal}
            </span>
            <span className="ts-grow__headings">
              <span className="ts-grow__crumb">
                <button type="button" onClick={() => { setOpen(false); setH(null); }}>
                  ‹ {crumb}
                </button>
                <span aria-hidden> · </span>
                {kicker}
              </span>
              <span className="ts-grow__title">{title}</span>
            </span>
            <button
              type="button"
              className="ts-grow__close"
              aria-expanded
              aria-label={`Close ${title}`}
              onClick={() => {
                setOpen(false);
                setH(null);
              }}
            >
              −
            </button>
          </header>
          <div className="ts-grow__body" ref={body}>
            {children}
          </div>
          {foot ? <footer className="ts-grow__foot">{foot}</footer> : null}
        </>
      )}
    </section>
  );
}

/** A picture slot with ‹ › and a caption band. */
function Photos({ photos, captionOverride, empty }: { photos: StagePhoto[]; captionOverride?: string; empty: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="ts-empty">{empty}</div>;
  const at = Math.min(i, photos.length - 1);
  const p = photos[at]!;
  const step = (d: number) => setI((at + d + photos.length) % photos.length);
  const caption = captionOverride || p.caption;
  return (
    <div className="ts-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt={p.alt ?? caption ?? ""} className="ts-photo__img" />
      {photos.length > 1 && (
        <>
          <button type="button" className="ts-arrow ts-arrow--prev" onClick={() => step(-1)} aria-label="Previous picture">
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" className="ts-arrow ts-arrow--next" onClick={() => step(1)} aria-label="Next picture">
            <ChevronRight size={18} aria-hidden />
          </button>
        </>
      )}
      {(caption || photos.length > 1 || p.credit) && (
        <div className="ts-cap">
          <span className="ts-cap__text">
            {caption}
            {p.credit ? <span className="ts-cap__credit"> {caption ? "· " : ""}{p.credit}</span> : null}
          </span>
          {photos.length > 1 && (
            <span className="ts-cap__count">
              {at + 1} / {photos.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Street View: nothing is requested until the visitor presses the button. */
function LoadOnPress({ kicker, button, children }: { kicker: string; button: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  if (on) return <>{children}</>;
  return (
    <div className="ts-load">
      <span className="ts-load__kicker">{kicker}</span>
      <button type="button" className="ts-load__btn" onClick={() => setOn(true)}>
        {button}
      </button>
      <span className="ts-load__note">Nothing loads until this is pressed</span>
    </div>
  );
}

function Pills<T extends string>({ value, items, onChange }: { value: T; items: { id: T; label: string }[]; onChange: (id: T) => void }) {
  if (items.length < 2) return null;
  return (
    <div className="ts-pills" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} className={`ts-pill${value === it.id ? " is-on" : ""}`} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── the overview ─────────────────────────────────────────────────────────

function OverviewSurface() {
  const stage = useSurfaceStage();
  const { data, page, visible, pageHref } = useStageCtx();
  const t = page.tour;
  const film = t.film;
  type Tab = "photo" | "film";
  const [tab, setTab] = useState<Tab>(film ? "film" : "photo");
  const lede = data.tourLede;
  const dur = formatDuration(t.durationMinutes);
  const facts: [string, string][] = [];
  if (dur) facts.push(["Length", dur]);
  if (t.details.maxParty) facts.push(["Group", `up to ${t.details.maxParty}`]);
  if (t.details.languages.length) facts.push(["Language", t.details.languages.join(", ")]);
  if (t.location) facts.push(["Meet at", t.location]);
  if (t.details.includes.length) facts.push(["Included", t.details.includes.join(", ")]);
  if (t.details.effort) facts.push(["Effort", t.details.effort]);
  const line = [dur, t.details.maxParty ? `up to ${t.details.maxParty}` : null, t.details.languages[0] ?? null, t.location ? `Meet at ${t.location}` : null]
    .filter(Boolean)
    .join(" · ");
  const first = visible[0];
  const actions = useFootActions(first ? [{ label: `Start at stop ${first.numeral}`, onClick: () => stage?.select(first.id) }] : []);
  const stopsLabel = `${data.stops.length} ${data.stops.length === 1 ? "stop" : "stops"}`;

  return (
    <SurfaceFrame kind="neutral" title={t.title} kicker={`The walk · ${stopsLabel}`} flush status={<FootStatus />} actions={actions}>
      <div className="ts-body">
        <div className="ts-left has-panel">
          {lede ? <p className="ts-narr">{lede}</p> : <p className="ts-narr ts-narr--quiet">The walk, stop by stop.</p>}
          {first && (
            <button type="button" className="ts-flow" onClick={() => stage?.select(first.id)}>
              <span className="ts-flow__rule" aria-hidden />
              <span>
                Start with stop {first.numeral}, {first.title}
              </span>
            </button>
          )}
          <GrowPanel
            tone="tour"
            medal="⌖"
            kicker="About this tour"
            line={line || stopsLabel}
            crumb="The walk"
            title="About this tour"
            foot={
              <>
                <span className="ts-status">{[stopsLabel, dur].filter(Boolean).join(" · ")}</span>
                {pageHref ? (
                  <a className="ts-grow__link" href={pageHref}>
                    Open the tour page →
                  </a>
                ) : null}
              </>
            }
          >
            <Facts facts={facts} />
            {t.details.highlights.length > 0 && (
              <ul className="ts-highlights">
                {t.details.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {t.excerpt && t.excerpt !== lede ? <p className="ts-about">{t.excerpt}</p> : null}
            {facts.length === 0 && t.details.highlights.length === 0 && !(t.excerpt && t.excerpt !== lede) ? (
              <p className="ts-about ts-about--quiet">No details for this tour yet.</p>
            ) : null}
          </GrowPanel>
        </div>
        <div className="ts-right">
          <Pills<Tab> value={tab} onChange={setTab} items={[...(film ? [{ id: "film" as const, label: "Fly-over" }] : []), { id: "photo", label: "Photo" }]} />
          {tab === "film" && film ? (
            // The fly-over plays at once (developer, 2026-11-20): no press-to-load gate; Street View keeps its own.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video className="ts-video" src={film.url720 ?? film.url} poster={film.poster ?? undefined} controls autoPlay muted loop playsInline />
          ) : (
            <Photos photos={data.overviewPhotos} empty="No pictures for this walk yet." />
          )}
        </div>
      </div>
    </SurfaceFrame>
  );
}

// ── a stop ───────────────────────────────────────────────────────────────

function StopSurface({ stopId }: { stopId: string }) {
  const stage = useSurfaceStage();
  const { o, data, page, visible } = useStageCtx();
  const actions = useFootActions([]);
  const stop = data.byStop[stopId];
  if (!stop) return null;
  const over = o.perStop[stop.id] ?? {};
  const at = visible.findIndex((s) => s.id === stop.id);
  const next = visible[at + 1] ?? null;
  const narrative = stop.narrative ? clip(stop.narrative, o.narrativeMax) : null;
  const lines = [stop.place?.excerpt ?? null].filter(Boolean) as string[];
  const walk = next && next.number === stop.number + 1 && stop.walkMinutesToNext ? stop.walkMinutesToNext : null;
  const editing = !!useStageEdit()?.editing;
  const showPlace = placeHasDetails(stop) || (editing && !!stop.place);

  const crumb = (
    <>
      <button type="button" className="eac-surface-crumb" onClick={() => stage?.select(OVERVIEW)}>
        ‹ The walk
      </button>
      <span className="eac-surface-sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      Stop {stop.numeral} of {toRoman(data.stops.length)}
    </>
  );

  return (
    <SurfaceFrame kind="neutral" title={stop.title} kicker={crumb} flush status={<FootStatus />} actions={actions}>
      <div className="ts-body">
        <div className={`ts-left ts-left--stop${showPlace ? " has-panel" : ""}`}>
          {editing && <StopEditRow stopId={stop.id} />}
          {editing ? (
            <StopLineEdit stopId={stop.id} fallback={stop.narrativeIsFallback ? stop.narrative : null} />
          ) : narrative ? (
            <p className="ts-narr">{narrative}</p>
          ) : lines.length ? (
            <p className="ts-narr ts-narr--quiet">{clip(lines[0]!, o.narrativeMax)}</p>
          ) : (
            // No line written yet (most stops today): the stop's name stands in, then where it is and how long,
            // so the column reads as a stop, not a missing field. Editors get a way to write the line.
            <>
              <p className="ts-narr">{stop.title}</p>
              {(stop.place?.address || stop.durationMinutes) && (
                <p className="ts-narr ts-narr--quiet">
                  {[stop.place?.address ?? null, stop.durationMinutes ? `${stop.durationMinutes} min here` : null].filter(Boolean).join(" · ")}
                </p>
              )}
              {page.canEdit && (
                <a href="/hub" className="ts-edit-hint">
                  Write this stop&apos;s line (hub › Create a tour)
                </a>
              )}
            </>
          )}
          {next ? (
            <button type="button" className="ts-flow" onClick={() => stage?.select(next.id)}>
              <span className="ts-flow__rule" aria-hidden />
              <span>
                Then on to {next.numeral}, {next.title}
                {walk ? ` · ${walk} min walk` : ""}
              </span>
            </button>
          ) : (
            <button type="button" className="ts-flow" onClick={() => stage?.select(OVERVIEW)}>
              <span className="ts-flow__rule" aria-hidden />
              <span>The end of the walk · back to the overview</span>
            </button>
          )}
          {!showPlace && <Takes takes={stop.takes} />}
          {showPlace && <PlacePanel key={stop.id} stop={stop} />}
        </div>
        <div className="ts-right">
          <StopMedia key={stop.id} stop={stop} media={over.media ?? o.media} lead={over.lead ?? o.lead} caption={over.caption} />
          {editing && <StopPicturesEdit stopId={stop.id} />}
        </div>
      </div>
    </SurfaceFrame>
  );
}

/**
 * Whether the stop's place has anything to show (developer, 2026-11-20: "if place has no details do not show the
 * place card"): an address, entry, hours, a description, a website or a link. The stop's own time-here does not count.
 */
export function placeHasDetails(stop: StageStopData): boolean {
  const p = stop.place;
  return !!p && !!(p.address || p.ticket || p.hours || p.excerpt || p.website || p.links.length);
}

export function placeLine(stop: StageStopData): string {
  const p = stop.place;
  if (!p) return "";
  const bits = [p.address, stop.durationMinutes ? `${formatDuration(stop.durationMinutes)} here` : null, p.hours ? `Open ${p.hours}` : null].filter(Boolean) as string[];
  return bits.length ? bits.join(" · ") : p.excerpt ?? "About this place";
}

/** The stop's place, grown in place over the narrative (design 1a), not a layer over the whole stage. */
function PlacePanel({ stop }: { stop: StageStopData }) {
  const place = stop.place!;
  const editing = !!useStageEdit()?.editing;
  const facts: [string, string][] = [];
  if (stop.durationMinutes) facts.push(["Time here", formatDuration(stop.durationMinutes) ?? ""]);
  if (place.address) facts.push(["Address", place.address]);
  if (place.ticket) facts.push(["Entry", place.ticket]);
  if (place.hours) facts.push(["Open", place.hours]);
  const links: { label: string; url: string }[] = [
    ...(place.website ? [{ label: "Website", url: place.website }] : []),
    ...place.links.map((l) => ({
      label: l.kind === "wikipedia_en" ? "Wikipedia" : l.kind === "wikipedia_fr" ? "Wikipédia (fr)" : l.kind === "wikidata" ? "Wikidata" : "OpenStreetMap",
      url: l.url,
    })),
  ];
  const takes = stop.takes.filter((t) => t.body);
  const nothing = facts.length === 0 && !place.excerpt && takes.length === 0 && links.length === 0;
  return (
    <GrowPanel
      tone="place"
      medal="⊙"
      kicker={`Place · ${place.title}`}
      line={placeLine(stop)}
      crumb={`Stop ${stop.numeral}`}
      title={place.title}
      foot={
        <>
          <span className="ts-status">In the catalogue{place.businessName ? ` · ${place.businessName}` : ""}</span>
          <a className="ts-grow__link" href={`/places?place=${encodeURIComponent(place.slug)}`}>
            Open the place page →
          </a>
        </>
      }
    >
      <Facts facts={facts} />
      {place.excerpt && <p className="ts-about">{place.excerpt}</p>}
      <Takes takes={stop.takes} />
      {editing && <PlacePicturesEdit placeId={place.id} placeTitle={place.title} />}
      {links.length > 0 && (
        <div className="ts-links">
          {links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="ts-link">
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
      {nothing ? <p className="ts-about ts-about--quiet">No details for this place yet.</p> : null}
    </GrowPanel>
  );
}

function StopMedia({ stop, media, lead, caption }: { stop: StageStopData; media: TourStageOptions["media"]; lead: TourStageOptions["lead"]; caption?: string }) {
  const { page } = useStageCtx();
  const photos = photosFor(stop, media);
  const street = stop.streetView;
  type Tab = "photos" | "street";
  const kinds: { id: Tab; label: string }[] = [
    ...(photos.length ? [{ id: "photos" as const, label: "Photos" }] : []),
    ...(street ? [{ id: "street" as const, label: "Street View" }] : []),
  ];
  const [tab, setTab] = useState<Tab>(lead === "streetview" && street ? "street" : photos.length ? "photos" : "street");
  const shown: Tab = kinds.some((k) => k.id === tab) ? tab : kinds[0]?.id ?? "photos";
  return (
    <>
      <Pills<Tab> value={shown} onChange={setTab} items={kinds} />
      {shown === "street" && street ? (
        <LoadOnPress kicker="Street View" button="Look around">
          <StreetView
            pose={{ lat: street.lat, lng: street.lng, heading: street.heading, pitch: street.pitch, fov: street.fov }}
            imageUrl={street.stillUrl}
            title={stop.title}
            apiKey={page.googleMapsKey}
            className="ts-street"
          />
        </LoadOnPress>
      ) : (
        <Photos photos={photos} captionOverride={caption} empty="No pictures for this stop yet." />
      )}
    </>
  );
}

// ── the book layer ───────────────────────────────────────────────────────

function BookSurface() {
  const { page, data } = useStageCtx();
  const t = page.tour;
  const label = formatPrice(t.price, t.currency);
  return (
    <SurfaceFrame kind="event" title="Book this walk" kicker="Book">
      <div className="ts-book">
        <p className="ts-book__price">
          {label}
          {data.price ? <span> per person</span> : null}
        </p>
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
          />
        </Suspense>
      </div>
    </SurfaceFrame>
  );
}
