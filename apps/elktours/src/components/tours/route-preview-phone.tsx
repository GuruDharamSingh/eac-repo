"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TourStop } from "@elkdonis/commerce/server";
import { roman } from "@/components/mobile/roman";
import { makeMapLibre, type Cam, type Renderer } from "@/components/tours/route-preview";
import type { TourRoute } from "@/lib/tours";

/**
 * The phone's live fly-over, behaving like the design's "Fly-over film" hero (screens-guest section 4): it plays by
 * itself, flies stop to stop along the real walking route, pulls back to the whole route after the last stop and
 * loops. One segment per stop fills over its slot (tap one to jump), with a time readout and Play/Pause. The same
 * MapLibre scene as the desktop RoutePreview (makeMapLibre) with Roman-numeral brass pins (verdigris ring for a
 * stop with a public experience) and a bottom overlay (kicker, stop name, experience line).
 *
 * Camera: "an aeroplane, not a drone". A target camera is computed from the timeline (the whole route, or a point
 * along the stored foot-router leg, eased with easeInOutCubic) and the real camera follows it through a smoother:
 * heading turns at most ~22 deg/s, and a big change of heading pulls the camera back (higher, flatter) instead of
 * swinging it round. Legs come from threads.metadata.tour.route; a missing or degenerate leg falls back to a straight
 * line. The walked part of the route is bright, the rest dim.
 *
 * The tour hero mounts this only while it is on screen (and destroys the map when it leaves), only on phone;
 * `autoplay` is false under prefers-reduced-motion, which shows the static route with a Play button.
 * Desktop never imports this file.
 */

type LngLat = [number, number];

const DWELL_MS = 4800; // holding at a stop
const FLY_MS = 3800; // flying a leg to it
const SLOT_MS = FLY_MS + DWELL_MS;
const INTRO_MS = 2400; // the whole route
const OUTRO_MS = 3600; // pull back to the whole route
const TICK_MS = 100; // how often the React state (readout, segments) updates
const MAX_TURN = 22; // deg/s
const TRAVEL_TILT = 62;
const TRAVEL_RANGE = 240;
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const dist = (a: LngLat, b: LngLat) => {
  const dx = (b[0] - a[0]) * 111320 * Math.cos(rad((a[1] + b[1]) / 2));
  const dy = (b[1] - a[1]) * 111320;
  return Math.hypot(dx, dy);
};
const bearing = (a: LngLat, b: LngLat) => {
  const dx = (b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2));
  return (deg(Math.atan2(dx, b[1] - a[1])) + 360) % 360;
};

/** A walked polyline with distance lookup. */
class Path {
  readonly cum: number[] = [0];
  readonly total: number;
  constructor(readonly pts: LngLat[]) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    this.total = this.cum[this.cum.length - 1] ?? 0;
  }
  at(d: number): LngLat {
    const p = this.pts;
    if (p.length === 1 || d <= 0) return p[0]!;
    if (d >= this.total) return p[p.length - 1]!;
    let i = 1;
    while (this.cum[i]! < d) i++;
    const a = p[i - 1]!, b = p[i]!, seg = this.cum[i]! - this.cum[i - 1]!;
    const k = seg === 0 ? 0 : (d - this.cum[i - 1]!) / seg;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  /** Direction of travel at d, looking ~35 m ahead so corners are rounded off. */
  headingAt(d: number): number {
    const a = this.at(Math.max(0, d - 10));
    const b = this.at(Math.min(this.total, d + 35));
    return a[0] === b[0] && a[1] === b[1] ? bearing(this.pts[0]!, this.pts[this.pts.length - 1]!) : bearing(a, b);
  }
  upTo(d: number): LngLat[] {
    const out: LngLat[] = [];
    for (let i = 0; i < this.pts.length && this.cum[i]! <= d; i++) out.push(this.pts[i]!);
    out.push(this.at(d));
    return out;
  }
}

const round5 = (m: number) => Math.round(m / 5) * 5;
function offsetLabel(min: number): string {
  if (min <= 0) return "At the start";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `+${h}h${m ? ` ${m}` : ""}` : `+${m} min`;
}

interface Props {
  title: string;
  stops: TourStop[];
  meetingPoint: { lat: number; lng: number; label?: string | null } | null;
  route: TourRoute | null;
  durationMinutes?: number | null;
  experiences?: Record<string, { title: string; artist: string | null }>;
  badge?: string;
  playLabel?: string;
  pauseLabel?: string;
  routeKicker?: string;
  /** Start flying at once (false under prefers-reduced-motion). */
  autoplay?: boolean;
  /** As a card's cover (2026-11-17): the map only, no badge or controls, and taps pass through to the card's link. */
  bare?: boolean;
}

export function RoutePreviewPhone({ stops, meetingPoint, route, durationMinutes, experiences = {}, badge = "Fly-over", playLabel = "Play", pauseLabel = "Pause", routeKicker = "The route", autoplay = true, bare = false }: Props) {
  const placed = useMemo(() => stops.filter((s) => s.lat != null && s.lng != null), [stops]);
  const pts = useMemo<LngLat[]>(() => placed.map((s) => [s.lng!, s.lat!]), [placed]);
  const meeting = useMemo<LngLat | null>(() => (meetingPoint ? [meetingPoint.lng, meetingPoint.lat] : null), [meetingPoint]);
  const n = placed.length;

  // One path per stop (the leg that arrives at it); null for stop 1 when there is no meeting point.
  // Stored legs are used when their count matches; a missing or degenerate leg is a straight line.
  const legs = useMemo<Array<Path | null>>(() => {
    const all = [...(meeting ? [meeting] : []), ...pts];
    const cached = route?.legs && route.legs.length === all.length - 1 ? route.legs : null;
    return pts.map((p, i) => {
      const from = meeting ? (i === 0 ? meeting : pts[i - 1]!) : i === 0 ? null : pts[i - 1]!;
      if (!from) return null;
      const stored = cached ? cached[meeting ? i : i - 1] : null;
      const path = stored && stored.length >= 2 ? new Path(stored as LngLat[]) : null;
      if (path && path.total >= 5 && dist(path.pts[path.pts.length - 1]!, p) < 150) return path;
      return new Path([from, p]);
    });
  }, [pts, meeting, route]);

  // The whole route: framing for the intro and outro.
  const overview = useMemo<Cam>(() => {
    const all = [...(meeting ? [meeting] : []), ...pts, ...legs.flatMap((l) => (l ? l.pts : []))];
    if (all.length === 0) return { lng: 2.35, lat: 48.85, heading: 0, tilt: 40, range: 600 };
    const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
    const c: LngLat = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
    const span = dist([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]);
    return { lng: c[0], lat: c[1], heading: 0, tilt: 40, range: Math.max(320, span * 1.15) };
  }, [pts, meeting, legs]);

  const box = useRef<HTMLDivElement>(null);
  const rend = useRef<Renderer | null>(null);
  const [ready, setReady] = useState(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const tRef = useRef(0);
  const playRef = useRef(playing);
  playRef.current = playing;
  const totalMs = INTRO_MS + n * SLOT_MS + OUTRO_MS;
  // -1 = the whole route (intro), 0..n-1 = a stop, n = pulling back (outro)
  const phase = t < INTRO_MS ? -1 : t >= INTRO_MS + n * SLOT_MS ? n : Math.floor((t - INTRO_MS) / SLOT_MS);
  const at = phase >= 0 && phase < n ? phase : -1;
  const total = durationMinutes ?? (placed.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0) || null);

  useEffect(() => {
    let dead = false;
    if (!box.current) return;
    void makeMapLibre(box.current, pts, meeting, {
      lineColor: "#e2bf7c",
      restColor: "rgba(201,162,92,0.32)",
      pin: (el, i) => {
        if (i < 0) return false;
        el.className = "tpp-pin" + (experiences[placed[i]!.id] ? " is-exp" : "");
        el.textContent = roman(i + 1);
      },
    }).then((r) => {
      if (dead) { r.destroy(); return; }
      rend.current = r;
      const rest: LngLat[] = [];
      legs.forEach((l, i) => rest.push(...(l ? l.pts : [pts[i]!])));
      r.setRest?.(rest);
      r.setDrawn([]);
      r.setCamera(overview);
      setReady(true);
    });
    return () => { dead = true; rend.current?.destroy(); rend.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The target camera for a moment on the timeline, and how much of the route has been walked.
  function target(ms: number): { cam: Cam; drawn: LngLat[] } {
    const stopCam = (i: number, d: number | null): Cam => {
      const l = legs[i];
      const p = l ? l.at(d ?? l.total) : pts[i]!;
      const h = l ? l.headingAt(d ?? l.total) : pts[i + 1] ? bearing(pts[i]!, pts[i + 1]!) : 0;
      return { lng: p[0], lat: p[1], heading: h, tilt: TRAVEL_TILT, range: TRAVEL_RANGE };
    };
    const walkedBefore = (i: number) => legs.slice(0, i).flatMap((l, k) => (l ? l.pts : [pts[k]!]));
    if (n === 0 || ms < INTRO_MS) return { cam: overview, drawn: [] };
    if (ms >= INTRO_MS + n * SLOT_MS) return { cam: overview, drawn: walkedBefore(n) };
    const i = Math.floor((ms - INTRO_MS) / SLOT_MS);
    const into = (ms - INTRO_MS) % SLOT_MS;
    const l = legs[i];
    if (into >= FLY_MS || !l) return { cam: stopCam(i, null), drawn: walkedBefore(i + 1) };
    const u = easeInOutCubic(into / FLY_MS);
    const cam = stopCam(i, u * l.total);
    return { cam, drawn: [...walkedBefore(i), ...l.upTo(u * l.total)] };
  }

  // The animation loop: advances the clock, computes the target camera and follows it with limited turn rate.
  useEffect(() => {
    if (!ready || n === 0) return;
    let raf = 0;
    let last = performance.now();
    let lastState = 0;
    let lastDrawn = -1;
    const cur: Cam = { ...overview };
    let prevAt = -2;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playRef.current) {
        tRef.current += dt * 1000;
        if (tRef.current >= totalMs) tRef.current = 0;
      }
      const ms = tRef.current;
      const { cam, drawn } = target(ms);
      const k = 1 - Math.exp(-dt / 0.55);
      cur.lng += (cam.lng - cur.lng) * k;
      cur.lat += (cam.lat - cur.lat) * k;
      cur.tilt += (cam.tilt - cur.tilt) * k;
      const dh = wrap(cam.heading - cur.heading);
      cur.heading = (cur.heading + clamp(dh * k, -MAX_TURN * dt, MAX_TURN * dt) + 360) % 360;
      // A big turn still to make pulls the camera back (higher and flatter) rather than swinging it round.
      const pull = clamp(Math.abs(wrap(cam.heading - cur.heading)) / 90, 0, 1);
      const wantRange = cam.range * (1 + pull * 0.9);
      cur.range = Math.exp(Math.log(cur.range) + (Math.log(wantRange) - Math.log(cur.range)) * k);
      rend.current?.setCamera({ ...cur, tilt: cur.tilt - pull * 12 });
      if (now - lastState >= TICK_MS) {
        lastState = now;
        setT(ms);
        if (drawn.length !== lastDrawn) { lastDrawn = drawn.length; rend.current?.setDrawn(drawn); }
        const a = ms < INTRO_MS || ms >= INTRO_MS + n * SLOT_MS ? -1 : Math.floor((ms - INTRO_MS) / SLOT_MS);
        if (a !== prevAt) { prevAt = a; rend.current?.setActive(a); }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, n, totalMs]);

  // Land on a stop: the camera arrives at it (the dwell) and keeps playing from there.
  const jump = (i: number) => { tRef.current = INTRO_MS + i * SLOT_MS + FLY_MS; setT(tRef.current); };

  const cur = at >= 0 ? placed[at] : null;
  const exp = cur ? experiences[cur.id] : undefined;
  const kicker = cur ? `Stop ${roman(at + 1)}${total ? ` · ${offsetLabel(round5((total * at) / placed.length))}` : ""}` : `${routeKicker} · ${placed.length} stops`;

  return (
    <div className={`tpp${bare ? " tpp--bare" : ""}`}>
      <div ref={box} className="tpp-map" />
      {ready && !bare && <span className="tpp-badge"><span className="tpp-dot" />{badge}</span>}
      {bare ? null : <div className="tpp-bottom">
        <div className="tpp-info" aria-live="polite">
          <span className="m-kicker tpp-kicker">{kicker}</span>
          {cur && <span className="tpp-name">{cur.title}</span>}
          {exp && <span className="tpp-exp">{[exp.artist, exp.title].filter(Boolean).join(" · ")}</span>}
        </div>
        {/* One row (developer, 2026-11-17): time, the stop segments, Pause; it keeps the map window clear. */}
        <div className="tpp-row">
          <span className="tpp-time">{mmss(t)} / {mmss(totalMs)}</span>
          <div className="tpp-segs" role="group" aria-label={routeKicker}>
            {placed.map((st, i) => {
              const fill = phase > i || phase === n ? 1 : phase === i ? Math.min(1, (t - INTRO_MS - i * SLOT_MS) / SLOT_MS) : 0;
              return (
                <button key={st.id} type="button" className={`tpp-seg${experiences[st.id] ? " is-exp" : ""}`} aria-label={`${roman(i + 1)} ${st.title}`} aria-current={at === i} onClick={() => jump(i)}>
                  <span style={{ width: `${fill * 100}%` }} />
                </button>
              );
            })}
          </div>
          <button type="button" className={`tpp-play${playing ? " is-on" : ""}`} onClick={() => setPlaying((v) => !v)}>{playing ? pauseLabel : playLabel}</button>
        </div>
      </div>}
    </div>
  );
}
