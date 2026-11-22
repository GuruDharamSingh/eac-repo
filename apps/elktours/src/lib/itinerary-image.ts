/**
 * The itinerary image: a portrait PNG (1080 x 1920) a guest saves to their phone. Wordmark, title, guide, meeting point,
 * length, a map of the real walking route (stored foot-router legs, brass line, Roman stop pins, the meeting point) and
 * the ordered stops with arrival offsets. Server only. A pure function of its input (plus the OSM tiles it fetches), so
 * it can be exercised from a script. Relative imports only; no database, no app aliases.
 *
 * Basemap: OpenStreetMap raster tiles fetched server-side at one zoom, cached on disk, toned to zinc. If any tile fails
 * the map falls back to a stylised route-only drawing. Text is drawn by next/og (satori), not by librsvg, because the
 * server has no system fonts.
 */
import { createElement as h, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ItineraryInput {
  slug: string;
  title: string;
  guide: string | null;
  /** The meeting point as a sentence. */
  meet: string | null;
  durationMinutes: number | null;
  stops: Array<{ name: string; lat: number; lng: number; minutes: number | null }>;
  meeting: { lat: number; lng: number } | null;
  /** threads.metadata.tour.route.legs: one polyline per leg (meeting point, then each stop). Null = straight lines. */
  legs: Array<Array<[number, number]>> | null;
  /** The tour page, printed at the foot. */
  url: string;
}

const W = 1080;
const H = 1920;
const PAD = 72;
const MAP_W = W - PAD * 2; // 936
const MAP_H = 800;
const ZINC = "#2a2e35";
const CARD = "#343941";
const BRASS = "#c9a25c";
const BRASS_LIGHT = "#dcc08a";
const INK = "#f1ece2";
const MUTED = "#9aa0a8";
const UA = "elkdonis-itinerary/1.0";

// ---- helpers ---------------------------------------------------------------------------------------------------------

const ROMAN: Array<[number, string]> = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n: number): string {
  let rest = n, out = "";
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out || String(n);
}
const round5 = (m: number) => Math.round(m / 5) * 5;
function offsetLabel(min: number): string {
  if (min <= 0) return "At the start";
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh ? `+${hh}h${mm ? ` ${mm}` : ""}` : `+${mm} min`;
}
function durationLabel(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh ? `${hh} h${mm ? ` ${String(mm).padStart(2, "0")}` : ""}` : `${mm} min`;
}

/** Cache key for the finished PNG: changes when anything drawn changes. */
export function itineraryKey(i: ItineraryInput): string {
  return createHash("sha1").update(JSON.stringify([i.title, i.guide, i.meet, i.durationMinutes, i.stops, i.meeting, i.legs, i.url])).digest("hex").slice(0, 16);
}

// ---- projection ------------------------------------------------------------------------------------------------------

const worldX = (lng: number, z: number) => ((lng + 180) / 360) * 256 * 2 ** z;
const worldY = (lat: number, z: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};

/** The legs to draw: stored ones when their count matches and each has 2+ points, else straight lines between the points. */
function drawnLegs(i: ItineraryInput): Array<Array<[number, number]>> {
  const pts: Array<[number, number]> = [...(i.meeting ? [[i.meeting.lng, i.meeting.lat] as [number, number]] : []), ...i.stops.map((s) => [s.lng, s.lat] as [number, number])];
  const stored = i.legs && i.legs.length === pts.length - 1 && i.legs.every((l) => l.length >= 2) ? i.legs : null;
  const out: Array<Array<[number, number]>> = [];
  for (let k = 1; k < pts.length; k++) out.push(stored ? stored[k - 1]! : [pts[k - 1]!, pts[k]!]);
  const total = out.reduce((n, l) => n + l.length, 0);
  const stride = Math.max(1, Math.ceil(total / 1500));
  return stride === 1 ? out : out.map((l) => l.filter((_, idx) => idx % stride === 0 || idx === l.length - 1));
}

// ---- tiles -----------------------------------------------------------------------------------------------------------

const tileDir = path.join(os.tmpdir(), "elk-osm-tiles");

async function tile(z: number, x: number, y: number): Promise<Buffer | null> {
  const file = path.join(tileDir, `${z}-${x}-${y}.png`);
  try { return await fs.readFile(file); } catch { /* not cached */ }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { "User-Agent": UA }, signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    await fs.mkdir(tileDir, { recursive: true }).catch(() => {});
    await fs.writeFile(file, buf).catch(() => {});
    return buf;
  } catch {
    return null;
  }
}

export type TileFetcher = typeof tile;

interface MapOut { png: Buffer; basemap: "osm" | "plain"; project: (lng: number, lat: number) => [number, number] }

async function buildMap(i: ItineraryInput, legs: Array<Array<[number, number]>>, getTile: TileFetcher): Promise<MapOut> {
  const all: Array<[number, number]> = [...legs.flat(), ...i.stops.map((s) => [s.lng, s.lat] as [number, number]), ...(i.meeting ? [[i.meeting.lng, i.meeting.lat] as [number, number]] : [])];
  const pad = 80;
  let z = 16;
  for (let t = 17; t >= 11; t--) {
    const xs = all.map((p) => worldX(p[0], t)), ys = all.map((p) => worldY(p[1], t));
    if (Math.max(...xs) - Math.min(...xs) <= MAP_W - pad * 2 && Math.max(...ys) - Math.min(...ys) <= MAP_H - pad * 2) { z = t; break; }
    z = t;
  }
  const xs = all.map((p) => worldX(p[0], z)), ys = all.map((p) => worldY(p[1], z));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const left = Math.round(cx - MAP_W / 2), top = Math.round(cy - MAP_H / 2);
  const project = (lng: number, lat: number): [number, number] => [worldX(lng, z) - left, worldY(lat, z) - top];

  // Basemap tiles, all or nothing.
  const n = 2 ** z;
  const tx0 = Math.floor(left / 256), tx1 = Math.floor((left + MAP_W) / 256);
  const ty0 = Math.floor(top / 256), ty1 = Math.floor((top + MAP_H) / 256);
  const jobs: Array<{ x: number; y: number }> = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push({ x: tx, y: ty });
  let base: sharp.Sharp | null = null;
  if (jobs.length <= 36 && jobs.every((j) => j.y >= 0 && j.y < n)) {
    const got: Array<Buffer | null> = [];
    for (let k = 0; k < jobs.length; k += 4) got.push(...(await Promise.all(jobs.slice(k, k + 4).map((j) => getTile(z, ((j.x % n) + n) % n, j.y)))));
    if (got.every(Boolean)) {
      const canvas = await sharp({ create: { width: (tx1 - tx0 + 1) * 256, height: (ty1 - ty0 + 1) * 256, channels: 3, background: ZINC } })
        .composite(jobs.map((j, k) => ({ input: got[k]!, left: (j.x - tx0) * 256, top: (j.y - ty0) * 256 })))
        .png().toBuffer();
      base = sharp(canvas).extract({ left: left - tx0 * 256, top: top - ty0 * 256, width: MAP_W, height: MAP_H }).modulate({ saturation: 0.18, brightness: 0.62 });
    }
  }
  const basemap: MapOut["basemap"] = base ? "osm" : "plain";
  if (!base) {
    // Stylised route-only map: zinc with a faint street grid.
    const lines: string[] = [];
    for (let x = 0; x <= MAP_W; x += 78) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${MAP_H}"/>`);
    for (let y = 0; y <= MAP_H; y += 78) lines.push(`<line x1="0" y1="${y}" x2="${MAP_W}" y2="${y}"/>`);
    base = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}"><rect width="100%" height="100%" fill="#2f343c"/><g stroke="#ffffff" stroke-opacity="0.05" stroke-width="2">${lines.join("")}</g></svg>`));
  }

  // The route, the meeting point and the stop pins (numerals are drawn by the caller: this SVG has no text).
  const f = (v: number) => v.toFixed(1);
  const poly = (l: Array<[number, number]>) => l.map((p) => project(p[0], p[1])).map((p) => `${f(p[0])},${f(p[1])}`).join(" ");
  const shadow = legs.map((l) => `<polyline points="${poly(l)}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const line = legs.map((l) => `<polyline points="${poly(l)}" fill="none" stroke="#e2bf7c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const pins = i.stops.map((s) => { const [x, y] = project(s.lng, s.lat); return `<circle cx="${f(x)}" cy="${f(y)}" r="27" fill="${CARD}" stroke="${BRASS}" stroke-width="5"/>`; }).join("");
  let meet = "";
  if (i.meeting) {
    const [x, y] = project(i.meeting.lng, i.meeting.lat);
    meet = `<g transform="translate(${f(x)} ${f(y)}) rotate(45)"><rect x="-16" y="-16" width="32" height="32" fill="${INK}" stroke="${BRASS}" stroke-width="5"/></g>`;
  }
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}">${shadow}${line}${meet}${pins}</svg>`);
  const png = await base.composite([{ input: overlay }]).png().toBuffer();
  return { png, basemap, project };
}

// ---- fonts -----------------------------------------------------------------------------------------------------------

type Font = { name: string; data: Buffer; weight: 400; style: "normal" };
let fontCache: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fontCache ??= (async () => {
    const out: Font[] = [];
    const cwd = process.cwd();
    for (const dir of [path.join(cwd, "public/fonts"), path.join(cwd, "apps/elktours/public/fonts"), path.join(cwd, "../public/fonts")]) {
      try { out.push({ name: "Brothers", data: await fs.readFile(path.join(dir, "BrothersTypeface-Regular.otf")), weight: 400, style: "normal" }); break; } catch { /* next */ }
    }
    try {
      const req = createRequire(path.join(cwd, "package.json"));
      const noto = path.join(path.dirname(req.resolve("next/package.json")), "dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf");
      out.push({ name: "Noto", data: await fs.readFile(noto), weight: 400, style: "normal" });
    } catch { /* satori then uses whichever font loaded */ }
    return out;
  })();
  return fontCache;
}

// ---- layout ----------------------------------------------------------------------------------------------------------

const box = (style: Record<string, unknown>, ...kids: ReactNode[]) => h("div", { style: { display: "flex", ...style } }, ...kids);
const text = (style: Record<string, unknown>, s: string) => h("div", { style: { display: "flex", ...style } }, s);
const HEAD = "Brothers, Noto";
const BODY = "Noto, Brothers";

export async function buildItineraryPng(i: ItineraryInput, opts: { getTile?: TileFetcher } = {}): Promise<{ png: Buffer; basemap: "osm" | "plain" }> {
  const legs = drawnLegs(i);
  const map = await buildMap(i, legs, opts.getTile ?? tile);
  const mapUri = `data:image/png;base64,${map.png.toString("base64")}`;
  const n = i.stops.length;
  const total = i.durationMinutes ?? (i.stops.reduce((a, s) => a + (s.minutes ?? 0), 0) || null);
  const len = durationLabel(total);

  const info = (label: string, value: string) =>
    box({ flexDirection: "column", marginRight: 44 }, text({ fontFamily: BODY, fontSize: 21, letterSpacing: 5, color: BRASS, textTransform: "uppercase" }, label), text({ fontFamily: BODY, fontSize: 34, color: INK, marginTop: 6 }, value));
  const infoRow = [i.guide ? info("Guide", i.guide) : null, len ? info("Length", len) : null, n ? info("Stops", String(n)) : null].filter(Boolean) as ReactNode[];

  const pinLabels = i.stops.map((s, k) => {
    const [x, y] = map.project(s.lng, s.lat);
    return box({ position: "absolute", left: x - 27, top: y - 27, width: 54, height: 54, alignItems: "center", justifyContent: "center", fontFamily: BODY, fontSize: k >= 8 ? 21 : 25, color: BRASS_LIGHT }, roman(k + 1));
  });
  const meetLabel = i.meeting
    ? (() => {
        const [x, y] = map.project(i.meeting.lng, i.meeting.lat);
        return box({ position: "absolute", left: x + 26, top: y - 18, padding: "4px 12px", borderRadius: 14, backgroundColor: "rgba(42,46,53,0.9)", border: `1px solid ${BRASS}`, fontFamily: BODY, fontSize: 22, color: INK }, "Start");
      })()
    : null;

  // The stop list: one or two columns, row height from what is left.
  const cols = n > 6 ? 2 : 1;
  const perCol = Math.max(1, Math.ceil(n / cols));
  const rowH = Math.max(34, Math.min(64, Math.floor(330 / perCol)));
  const fs1 = Math.max(20, Math.round(rowH * 0.5));
  const row = (s: ItineraryInput["stops"][number], k: number) => {
    const off = total && n ? offsetLabel(round5((total * k) / n)) : k === 0 ? "At the start" : "";
    return box(
      { alignItems: "center", height: rowH, width: cols === 2 ? 440 : MAP_W },
      box({ width: rowH - 10, height: rowH - 10, borderRadius: rowH, border: `2px solid ${BRASS}`, alignItems: "center", justifyContent: "center", fontFamily: BODY, fontSize: Math.round(fs1 * 0.75), color: BRASS_LIGHT, flex: "none" }, roman(k + 1)),
      text({ fontFamily: BODY, fontSize: fs1, color: INK, marginLeft: 20, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, s.name),
      text({ fontFamily: BODY, fontSize: Math.round(fs1 * 0.72), color: MUTED, marginLeft: 12, flex: "none" }, off)
    );
  };
  const colsEls = Array.from({ length: cols }, (_, c) => box({ flexDirection: "column", marginRight: c === 0 && cols === 2 ? 56 : 0 }, ...i.stops.slice(c * perCol, (c + 1) * perCol).map((s, k) => row(s, c * perCol + k))));

  const tree = box(
    { width: W, height: H, flexDirection: "column", backgroundColor: ZINC, padding: `${PAD}px ${PAD}px 56px`, color: INK },
    box({ alignItems: "baseline", justifyContent: "space-between" }, text({ fontFamily: HEAD, fontSize: 48, color: BRASS_LIGHT }, "Elkdonis"), text({ fontFamily: BODY, fontSize: 22, letterSpacing: 7, color: MUTED, textTransform: "uppercase" }, "Itinerary")),
    box({ height: 2, backgroundColor: "rgba(201,162,92,0.45)", marginTop: 22 }),
    text({ fontFamily: HEAD, fontSize: i.title.length > 38 ? 74 : 92, lineHeight: 1.02, marginTop: 34, maxHeight: 290, overflow: "hidden" }, i.title),
    box({ marginTop: 28 }, ...infoRow),
    i.meet ? box({ flexDirection: "column", marginTop: 24 }, text({ fontFamily: BODY, fontSize: 21, letterSpacing: 5, color: BRASS, textTransform: "uppercase" }, "Meet at"), text({ fontFamily: BODY, fontSize: 32, color: INK, marginTop: 6, maxHeight: 84, overflow: "hidden" }, i.meet)) : null,
    box(
      { position: "relative", width: MAP_W, height: MAP_H, marginTop: 34, borderRadius: 26, overflow: "hidden", border: `2px solid rgba(201,162,92,0.45)` },
      h("img", { src: mapUri, width: MAP_W, height: MAP_H, style: { position: "absolute", left: 0, top: 0, width: MAP_W, height: MAP_H } }),
      ...pinLabels,
      meetLabel,
      text({ position: "absolute", right: 0, bottom: 0, padding: "4px 12px", backgroundColor: "rgba(42,46,53,0.82)", fontFamily: BODY, fontSize: 18, color: map.basemap === "osm" ? "#d7d2c8" : MUTED }, map.basemap === "osm" ? "© OpenStreetMap contributors" : "Route only")
    ),
    box({ marginTop: 28 }, ...colsEls),
    box({ flex: 1 }),
    box({ alignItems: "center", justifyContent: "space-between", borderTop: "2px solid rgba(201,162,92,0.3)", paddingTop: 20 }, text({ fontFamily: BODY, fontSize: 26, color: BRASS_LIGHT }, i.url.replace(/^https?:\/\//, "")), text({ fontFamily: BODY, fontSize: 20, color: MUTED }, "Choose a date on the tour page"))
  );

  const fonts = await loadFonts();
  const res = new ImageResponse(tree as never, { width: W, height: H, ...(fonts.length ? { fonts } : {}) });
  return { png: Buffer.from(await res.arrayBuffer()), basemap: map.basemap };
}

// ---- cache -----------------------------------------------------------------------------------------------------------

const outDir = path.join(os.tmpdir(), "elk-itinerary");

/** The finished PNG for a tour, cached on disk per tour and route hash. */
export async function itineraryPng(i: ItineraryInput): Promise<Buffer> {
  const file = path.join(outDir, `${i.slug.replace(/[^a-z0-9-]/gi, "_")}-${itineraryKey(i)}.png`);
  try { return await fs.readFile(file); } catch { /* build it */ }
  const { png, basemap } = await buildItineraryPng(i);
  // A route-only map (tiles failed) is not cached for long: try the real map again next time.
  if (basemap === "osm") {
    await fs.mkdir(outDir, { recursive: true }).catch(() => {});
    await fs.writeFile(file, png).catch(() => {});
  }
  return png;
}

// ---- the route map alone (2026-11-17) ----------------------------------------------------------------------------------

const mapDir = path.join(os.tmpdir(), "elk-route-map");

/**
 * The tour's route on the basemap, without the itinerary's text: the still on a phone list card when the tour has
 * no cover photo (developer, 2026-11-17: "not Street View"). Same drawing and tile cache as the itinerary; cached on
 * disk per tour and route hash, and not cached when the tiles failed.
 */
export async function routeMapPng(i: ItineraryInput): Promise<Buffer> {
  const file = path.join(mapDir, `${i.slug.replace(/[^a-z0-9-]/gi, "_")}-${itineraryKey(i)}.png`);
  try { return await fs.readFile(file); } catch { /* build it */ }
  const map = await buildMap(i, drawnLegs(i), tile);
  // About 95 KB: a list card is 112 px wide, and nine of these at 720 px came to 7 MB per /tours visit.
  const png = await sharp(map.png).resize({ width: 360 }).png({ compressionLevel: 9, palette: true }).toBuffer();
  if (map.basemap === "osm") {
    await fs.mkdir(mapDir, { recursive: true }).catch(() => {});
    await fs.writeFile(file, png).catch(() => {});
  }
  return png;
}
