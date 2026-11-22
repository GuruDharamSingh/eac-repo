"use client";

import "@/components/tours/tour-story.css";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTourPage } from "@/blocks/tour/context";
import { PlaceDetails, useTourPhone } from "../tour-stage-phone";
import { placeHasDetails } from "../../tour-stage";
import { siteConfig } from "@/config/site";
import { tourMark } from "@/lib/tour-field-marks";
import { officeHref } from "@/lib/office-links";
import { buildModel, type DepRow, type IndexModel, type SectionId } from "./data";
import "./tour-phone-index.css";

/**
 * The phone tour page below the stage (design "Tour Detail Page Phone Light", docs/06; light theme): 4b the index, a full screen that
 * the stage snaps to, then 4c the seven sections with a sticky pill bar. The document is the scroller; the snap rules
 * are in tour-phone-index.css. Reads the page data and the shared phone controller (stage selection, chosen date).
 */

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), { ssr: false });

const LOCK_MS = 250;

export function TourPhoneIndex() {
  const page = useTourPage();
  const phone = useTourPhone();
  const [now] = useState(() => Date.now());
  const model = useMemo(() => (page ? buildModel(page, phone.chosenDepartureId, now) : null), [page, phone.chosenDepartureId, now]);
  const [active, setActive] = useState<SectionId>("expect");
  const lock = useRef(0);
  // After a jump the pressed pill stays lit until the visitor scrolls by hand (wheel, touch, keys): near the page end
  // a section cannot reach the top, and the bottom rule would otherwise light the last pill (DESIGN, 2026-11-20).
  const pinned = useRef<SectionId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);

  const ids = (model?.sections ?? []).map((s) => s.id).join(",");

  // Which section is in view: the last whose top is within 80px of the scroll top; at the very bottom, the last.
  useEffect(() => {
    if (!ids) return;
    const list = ids.split(",") as SectionId[];
    let raf = 0;
    const calc = () => {
      raf = 0;
      if (pinned.current) return;
      if (Date.now() < lock.current) {
        lock.current = Math.max(lock.current, Date.now() + 120);
        return;
      }
      let cur = list[0]!;
      for (const id of list) {
        const el = document.getElementById(`tpi-${id}`);
        if (el && el.getBoundingClientRect().top <= 80) cur = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = list[list.length - 1]!;
      setActive(cur);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    const unpin = () => {
      pinned.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) unpin();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", unpin, { passive: true });
    window.addEventListener("touchstart", unpin, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", unpin);
      window.removeEventListener("touchstart", unpin);
      window.removeEventListener("keydown", onKey);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids]);

  // Keep the lit pill in view inside the bar (the bar scrolls sideways, the page must not).
  useEffect(() => {
    const bar = nav.current;
    const pill = bar?.querySelector<HTMLElement>(`[data-pill="${active}"]`);
    // Set directly, not scrollTo smooth: a smooth scroll on the bar cancels the page's own smooth scroll in Chrome
    // (a jump from the index or a pill tap then never leaves its place).
    if (bar && pill) bar.scrollLeft = Math.max(0, pill.offsetLeft - 12);
  }, [active]);

  if (!page || !model) return null;

  const jump = (id: SectionId) => {
    const el = document.getElementById(`tpi-${id}`);
    if (!el) return;
    lock.current = Date.now() + LOCK_MS;
    pinned.current = id;
    setActive(id);
    const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A smooth scroll under mandatory snap is pulled back to the area's start (Chrome re-snaps mid-flight): snapping is
    // switched off for the length of the jump and restored once the page has stopped moving (a scrollend event can
    // arrive from an earlier scroll, so the position is polled instead).
    const html = document.documentElement;
    html.style.scrollSnapType = "none";
    const from = window.scrollY;
    let last = from;
    let still = 0;
    const started = Date.now();
    const poll = window.setInterval(() => {
      const y = window.scrollY;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      const moved = Math.abs(y - from) > 2;
      if ((moved && still >= 2) || Date.now() - started > (moved ? 2500 : 900)) {
        window.clearInterval(poll);
        html.style.scrollSnapType = "";
      }
    }, 100);
    // The snap change is applied first; the scroll is issued a frame later so the recompute cannot cancel it.
    requestAnimationFrame(() => requestAnimationFrame(() => el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" })));
  };

  const activeStop = phone.activeStop;

  return (
    <div className="tpi-root" ref={root}>
      <IndexScreen model={model} title={page.tour.title} onJump={jump} fieldEditId={page.fieldEditId ?? null} />
      <div className="tpi-every">
        <nav className="tpi-pills" ref={nav} aria-label="Sections of this tour">
          {model.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              data-pill={s.id}
              className={`tpi-pill${active === s.id ? " is-on" : ""}`}
              aria-current={active === s.id ? "true" : undefined}
              onClick={() => jump(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
        {model.sections.map((s) => (
          <Section key={s.id} id={s.id} n={s.n} title={s.title} aside={asideOf(s.id, model)}>
            {s.id === "expect" && <Expect model={model} fieldEditId={page.fieldEditId ?? null} />}
            {s.id === "route" && <Route model={model} activeId={activeStop?.id ?? null} onPick={(id) => phone.selectFace(id)} />}
            {s.id === "dates" && <Dates model={model} chosenId={model.selected?.id ?? null} onChoose={(id) => phone.chooseDeparture(id)} changeHref={page.fieldEditId ? officeHref("schedule", { tourId: page.fieldEditId }) : null} />}
            {s.id === "meet" && <Meet model={model} />}
            {s.id === "incl" && <Included items={model.includes} />}
            {s.id === "guide" && <Guide model={model} />}
            {s.id === "know" && <Know model={model} fieldEditId={page.fieldEditId ?? null} />}
          </Section>
        ))}
        {/* Reviews are off the phone page for now (developer, 2026-11-21). */}
        <div className="tpi-spacer" aria-hidden />
      </div>
    </div>
  );
}

function asideOf(id: SectionId, m: IndexModel): string | null {
  if (id === "route") return `${m.stops.length} ${m.stops.length === 1 ? "STOP" : "STOPS"}`;
  if (id === "dates" && m.priced) return `${m.priceLabel} PP`;
  return null;
}

// ── 4b ───────────────────────────────────────────────────────────────────

/** Index rows: every section but "Good to know" (taken off the index, developer, 2026-11-21; its section and pill stay). */
const INDEX_HIDDEN: SectionId[] = ["know"];
/** The title keeps its full size; only when it would run to a third line does it shrink, and only a little (developer, 2026-11-21). */
const TITLE_FIT_MIN = 0.8;
const TITLE_LINES = 2;

function IndexScreen({ model, title, onJump, fieldEditId }: { model: IndexModel; title: string; onJump: (id: SectionId) => void; fieldEditId: string | null }) {
  const sel = model.selected;
  const box = useRef<HTMLElement>(null);
  const rows = model.sections.filter((s) => !INDEX_HIDDEN.includes(s.id));
  const watch = `${title}`;
  useLayoutEffect(() => {
    const el = box.current;
    const name = el?.querySelector<HTMLElement>(".tpi-ix__name");
    if (!el || !name) return;
    const lines = () => {
      const lh = parseFloat(getComputedStyle(name).lineHeight);
      return lh > 0 ? Math.round(name.getBoundingClientRect().height / lh) : 1;
    };
    const fit = () => {
      let k = 1;
      el.style.setProperty("--tpi-title-k", "1");
      while (k > TITLE_FIT_MIN && lines() > TITLE_LINES) {
        k = Math.round((k - 0.03) * 100) / 100;
        el.style.setProperty("--tpi-title-k", String(k));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(name);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [watch]);
  return (
    <section className="tpi-index" ref={box} aria-label="Before you go">
      <div className="tpi-ix">
        {/* No "Back to the walk" bar (developer, 2026-11-21). "Before you go" is back, as the label cut into a framed title. */}
        <div className="tpi-ix__frame">
          <span className="tpi-ix__kicker">BEFORE YOU GO</span>
          {/* role=heading, not <h1>: the site stylesheet gives every h1-h4 the Brothers face, and the title is set in Venture here */}
          <div role="heading" aria-level={1} className="tpi-ix__name" {...tourMark(fieldEditId, "title")}>{title}</div>
        </div>
        {model.keyFacts.length > 0 && (
          <div className="tpi-key" style={{ "--n": model.keyFacts.length } as CSSProperties}>
            {model.keyFacts.map(([k, v]) => (
              <div key={k} className="tpi-key__cell">
                <span className="tpi-lab">{k.toUpperCase()}</span>
                <span className="tpi-key__v">{v}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="tpi-next" onClick={() => onJump("dates")}>
          <span className="tpi-next__rule" aria-hidden />
          <span className="tpi-next__tile">
            <span className="tpi-lab tpi-lab--k">{sel ? (model.selectedIsNext ? "NEXT" : "CHOSEN") : "DATES"}</span>
            <span className="tpi-next__d">{sel ? sel.date : "–"}</span>
          </span>
          <span className="tpi-next__text">
            <span className="tpi-next__t">{sel ? `${sel.day} · ${sel.time}` : "No dates open yet"}</span>
            <span className="tpi-next__s">
              {sel ? `${sel.left}${model.moreDates ? ` · ${model.moreDates} more ${model.moreDates === 1 ? "date" : "dates"}` : ""}` : model.deps.length ? "All dates are full" : "Ask us about a date"}
            </span>
          </span>
          <span className="tpi-next__go" aria-hidden>→</span>
        </button>
        <ol className="tpi-rows">
          {rows.map((s) => (
            <li key={s.id}>
              <button type="button" className="tpi-row" onClick={() => onJump(s.id)}>
                <span className="tpi-row__n">{s.n}</span>
                <span className="tpi-row__text">
                  <span className="tpi-row__t">{s.title}</span>
                  {s.teaser && <span className="tpi-row__s">{s.teaser}</span>}
                </span>
                <span className="tpi-row__go" aria-hidden>↓</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="tpi-brand">
        <span className="tpi-brand__name elk-brand">{brandMark(siteConfig.orgName)}</span>
      </div>
    </section>
  );
}

/** The brand in Brothers with the l-k pair joined, as in the site header (components/site-header.tsx brandMark). */
function brandMark(name: string) {
  const i = name.toLowerCase().indexOf("lk");
  if (i < 0) return name;
  return (
    <>
      {name.slice(0, i)}
      <span className="elk-brand-lk">{name.slice(i, i + 2)}</span>
      {name.slice(i + 2)}
    </>
  );
}

// ── 4c sections ──────────────────────────────────────────────────────────

function Section({ id, n, title, aside, children }: { id: SectionId; n: string; title: string; aside: string | null; children: ReactNode }) {
  return (
    <section id={`tpi-${id}`} className="tpi-sec" data-kind={id === "dates" ? "event" : undefined}>
      <h2 className="tpi-h">
        <span className="tpi-h__n">{n}</span>
        {title.toUpperCase()}
        {aside && <span className="tpi-h__aside">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

function Expect({ model, fieldEditId }: { model: IndexModel; fieldEditId: string | null }) {
  return (
    <>
      {model.summary ? (
        <p className="tpi-lede" {...tourMark(fieldEditId, "excerpt")}>{model.summary}</p>
      ) : (
        // Only the tour's guide sees this: an empty line to click and fill in.
        fieldEditId && <p className="tpi-empty" {...tourMark(fieldEditId, "excerpt")}>Write what guests can expect on this tour.</p>
      )}
      {model.expectFacts.length > 0 && (
        <div className="tpi-grid2">
          {model.expectFacts.map(([k, v]) => (
            <div key={k} className="tpi-grid2__cell">
              <span className="tpi-lab">{k.toUpperCase()}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Mounts its children once the box is near the screen, and keeps them: a map is heavy and the page is long. */
export function WhenNear({ className, caption, children }: { className: string; caption: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div ref={ref} className={className}>
      <span className="tpi-map__cap">{caption}</span>
      {near ? <div className="tpi-map__in">{children}</div> : null}
    </div>
  );
}

export function Route({ model, activeId, onPick }: { model: IndexModel; activeId: string | null; onPick: (id: string) => void }) {
  const points = model.mapStops.length + (model.meetingPoint ? 1 : 0);
  const [open, setOpen] = useState<string | null>(null);
  const [placeOpen, setPlaceOpen] = useState<string | null>(null);
  return (
    <>
      {points >= 2 && (
        <WhenNear className="tpi-map" caption={`Route map · ${model.stops.length} ${model.stops.length === 1 ? "stop" : "stops"}`}>
          {/* Framed on the stops alone, with little margin, so they spread over the window (developer, 2026-11-21). */}
          <TourMap
            stops={model.mapStops}
            meetingPoint={model.meetingPoint}
            activeIndex={-1}
            interactive={false}
            padding={18}
            fitMeeting={false}
            onSelect={(i) => {
              const s = model.mapStops[i];
              if (s) onPick(s.id);
            }}
          />
        </WhenNear>
      )}
      <ol className="tpi-stops">
        {model.stops.map((s) => {
          const kind = s.place?.title && s.place.title !== s.title ? s.place.title : null;
          const on = s.id === activeId;
          const isOpen = open === s.id;
          const address = s.place?.address ?? null;
          const hasPlace = !!s.place && placeHasDetails(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                className="tpi-stop"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpen(isOpen ? null : s.id);
                  setPlaceOpen(null);
                }}
              >
                <span className={`tpi-stop__n${on ? " is-on" : ""}`}>{s.numeral}</span>
                <span className="tpi-stop__text">
                  <span className="tpi-stop__t">{s.title}</span>
                  {kind && <span className="tpi-stop__k">{kind}</span>}
                </span>
                <span className="tpi-stop__min">{s.durationMinutes ? `${s.durationMinutes} min ` : ""}<span aria-hidden>{isOpen ? "▴" : "▾"}</span></span>
              </button>
              {isOpen && (
                // Everything here is already loaded with the page: the address, the place's facts. Nothing is fetched on open.
                <div className="tpi-stop__more">
                  {address && <p className="tpi-stop__addr">{address}</p>}
                  <div className="tpi-stop__acts">
                    {hasPlace && (
                      <button type="button" className="tpi-stop__act" aria-pressed={placeOpen === s.id} onClick={() => setPlaceOpen(placeOpen === s.id ? null : s.id)}>
                        Place card
                      </button>
                    )}
                    <button type="button" className="tpi-stop__act" onClick={() => onPick(s.id)}>Show on the walk ↑</button>
                  </div>
                  {hasPlace && placeOpen === s.id && (
                    <div className="tpi-stop__place">
                      <PlaceDetails stop={s} hideAddress hideKicker />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function Dates({ model, chosenId, onChoose, changeHref }: { model: IndexModel; chosenId: string | null; onChoose: (id: string) => void; changeHref: string | null }) {
  // The tour's guide (or an owner) can open this tour's dates in the office: the same editor that offers a tour. Never drawn for a visitor.
  const change = changeHref ? <a className="tpi-stop__act" href={changeHref}>Change dates and times</a> : null;
  if (model.deps.length === 0) return <><p className="tpi-empty">No dates open yet.</p>{change}</>;
  return (
    <>
    <div className="tpi-deps">
      {model.deps.map((d: DepRow) => {
        const on = d.id === chosenId && !d.full;
        return (
          <button
            key={d.id}
            type="button"
            className="tpi-dep"
            disabled={d.full}
            aria-pressed={d.full ? undefined : on}
            onClick={() => !d.full && onChoose(d.id)}
          >
            <span className="tpi-dep__tile">
              <span className="tpi-lab">{d.day.toUpperCase()}</span>
              <span className="tpi-dep__d">{d.date}</span>
            </span>
            <span className="tpi-dep__text">
              <span className="tpi-dep__t">{d.time}{d.guide ? ` · ${d.guide}` : ""}</span>
              <span className="tpi-dep__s">{d.left}</span>
            </span>
            <span className={`tpi-dep__tag ${d.full ? "is-full" : on ? "is-on" : ""}`}>{d.full ? "Full" : on ? "Chosen" : "Choose"}</span>
          </button>
        );
      })}
    </div>
    {change}
    </>
  );
}

function Meet({ model }: { model: IndexModel }) {
  const meet = model.meet;
  if (!meet) return null;
  // An address and a link out to the map app: no second map to load (developer, 2026-11-21).
  return (
    <div className="tpi-meet">
      <div className="tpi-meet__row">
        <span className="tpi-meet__text">
          <span className="tpi-meet__t">{meet.label}</span>
          {meet.startLine && <span className="tpi-meet__s">{meet.startLine}</span>}
        </span>
        <a className="tpi-meet__go" href={meet.directions} target="_blank" rel="noopener noreferrer">Map ↗</a>
      </div>
    </div>
  );
}

function Included({ items }: { items: string[] }) {
  const half = Math.ceil(items.length / 2);
  const cols = items.length > 3 ? [items.slice(0, half), items.slice(half)] : [items];
  return (
    <div className={`tpi-incl${cols.length === 1 ? " tpi-incl--one" : ""}`}>
      {cols.map((col, i) => (
        <ul key={i}>
          {col.map((x) => (
            <li key={x}>
              <span aria-hidden>✓</span>
              {x}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function Guide({ model }: { model: IndexModel }) {
  const g = model.guide;
  if (!g) return null;
  return (
    <>
      {g.name && (
        <div className="tpi-guide">
          <span className="tpi-guide__rule" aria-hidden />
          {g.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tpi-guide__face tpi-guide__face--photo" src={g.photo} alt={g.name} loading="lazy" />
          ) : (
            <span className="tpi-guide__face" aria-hidden>{g.name.trim().charAt(0).toUpperCase()}</span>
          )}
          <span className="tpi-guide__text">
            <span className="tpi-guide__t">{g.name}</span>
            {g.sub && <span className="tpi-guide__s">{g.sub}</span>}
          </span>
        </div>
      )}
      {g.take && (
        <div className="tpi-take">
          <span className="tpi-take__lab">THEIR TAKE</span>
          <span>
            {g.take.body}
            {g.take.by ? ` · ${g.take.by}` : ""}
          </span>
        </div>
      )}
    </>
  );
}

function Know({ model, fieldEditId }: { model: IndexModel; fieldEditId: string | null }) {
  const hasContact = model.know.some(([k]) => k === "Contact");
  return (
    <>
      {model.goodToKnow.length > 0 ? (
        <ul className="tpi-bullets" {...tourMark(fieldEditId, "goodToKnow")}>
          {model.goodToKnow.map((x, i) => (
            <li key={`${i}-${x}`}>{x}</li>
          ))}
        </ul>
      ) : (
        fieldEditId && <p className="tpi-empty" {...tourMark(fieldEditId, "goodToKnow")}>Add the points a guest should know before the walk.</p>
      )}
      {(model.know.length > 0 || Boolean(fieldEditId)) && <dl className="tpi-know">
        {model.know.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="tpi-know__row">
            <dt>{k.toUpperCase()}</dt>
            <dd {...(k === "Contact" ? tourMark(fieldEditId, "contact") : {})}>{v.href ? <a href={v.href}>{v.text}</a> : v.text}</dd>
          </div>
        ))}
        {fieldEditId && !hasContact && (
          <div className="tpi-know__row">
            <dt>CONTACT</dt>
            <dd {...tourMark(fieldEditId, "contact")}>Add a contact line</dd>
          </div>
        )}
      </dl>}
    </>
  );
}
