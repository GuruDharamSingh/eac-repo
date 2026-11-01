/**
 * The plane: one continuous classified section. The world is a single sheet
 * of paper with no edges; tiles of CELL_W × CELL_H are only the unit of
 * generation and rendering. A tile is one or more *bands* (horizontal
 * stripes), each with its own column count, so the column grid can break
 * down the plane as well as across it; the dial `breaks` says how often.
 * Columns are filled flush to each band's bottom, so every seam is a box
 * edge like any other.
 *
 * Every box is drawn from the template catalog (templates.ts): the local
 * theme (keyframe weights) only biases the draw, the heterogeneity dial
 * flattens the bias, and no template is ever excluded. Heads likewise come
 * from the head catalog. Real entries have one home cell and echo
 * elsewhere; articles and the weather join at the editorial dial's share.
 */
import { Rng, hash, unit as unit01 } from "./rng";
import { styleAt, CELL_W, CELL_H, type Style } from "./style";
import { CLASSES, type EntryType, type UnitKind } from "./catalog";
import { generateAd, generateAgency, HOUSE_LINES, newsPool, type Ad } from "./copy";
import { unitOf } from "./dials";
import { HEADS, ALL_TEMPLATES as TEMPLATES, type HeadTemplate, type Template } from "./templates";
import { zone as zoneGeom, type Zone } from "./zones";
import { sectionAt } from "./style";
import { twistsFor, variant, type Section, type Twist } from "./sections";
import { PALETTES } from "./templates";

export { CELL_W, CELL_H };

export type Kind = UnitKind | "banner" | "filler";

/** The concrete look of one box: the template resolved against the palette. */
export interface Voice {
  tpl: string;
  fontBody: string;
  fontHead: string;
  fontDisplay: string;
  headScale: number;
  bodyScale: number;
  border: NonNullable<Template["border"]>;
  /** Background colour or undefined for paper. */
  fill?: string;
  /** Text colour when reversed. */
  ink?: string;
  edge?: string;
  reverse: boolean;
  shadow: boolean;
  align: "center" | "justify" | "left";
  cls?: string;
}

export interface Unit {
  key: string;
  kind: Kind;
  ad: Ad;
  voice: Voice;
  x: number;
  y: number;
  w: number;
  h: number;
  span: number;
  label?: string;
  num?: string;
  head?: HeadTemplate;
  home?: boolean;
  homeCell?: [number, number];
}

export interface Grid { cols: number; colW: number; gap: number; }

/** A generated zone: geometry, the style sampled at its centre, its grid, and its boxes (positions relative to the zone). */
export interface Tile {
  zone: Zone;
  /** The section this zone was generated from, with its twists, when inside a centre. */
  section?: { id: string; label: string; twists: string[]; hold: number };
  i: number;
  j: number;
  x: number;
  y: number;
  w: number;
  h: number;
  style: Style;
  grid: Grid;
  units: Unit[];
}

export interface RealEntry { ad: Ad; home: [number, number]; }

export function homeCellFor(key: string): [number, number] {
  let h = 0;
  for (let k = 0; k < key.length; k++) h = (h * 31 + key.charCodeAt(k)) | 0;
  return [(hash(h, 1) % 41) - 20, (hash(h, 2) % 29) - 14];
}

const KIND_FOR_TYPE: Record<EntryType, UnitKind[]> = {
  classified: ["liner", "liner-tint", "boxed", "display", "stack", "card", "reverse"],
  notice: ["notice", "boxed", "liner", "reverse"],
  seasonal: ["personal", "boxed", "liner"],
  listing: ["listing", "agency", "liner"],
  poster: ["poster", "reverse", "stack", "display"],
  mailorder: ["offer", "coupon", "liner", "stack"],
  profile: ["profile", "liner", "card", "boxed"],
  editorial: ["article", "weather"],
};
const DISPLAY_KINDS = new Set<Kind>(["display", "reverse", "notice", "stack", "coupon", "offer", "poster", "card", "profile", "house", "personal", "listing", "agency", "article", "weather"]);
const LINER_KINDS = new Set<Kind>(["liner", "liner-tint", "profile", "filler"]);

/** News sheet: kinds whose furniture only reads as an ad (coupon form, price, rate table) set the story in a news-shaped box instead. */
const NEWS_KIND: Partial<Record<Kind, Kind>> = { coupon: "display", offer: "display", house: "display", agency: "article", listing: "article", weather: "article" };
const NEWS_MASTHEADS = ["THE NEWS", "Today's Headlines", "NEWS OF THE DAY", "The Wire", "WORLD & LOCAL"];

/** Boxes that set a story's picture: a photo under the headline, or the profile's cut. The rest stay type only. */
const PHOTO_KINDS = new Set<Kind>(["article", "display", "reverse", "profile"]);

/** A real story dressed for its box: liners and boxed runs lead with the headline, since they show no headline line of their own. */
function newsAd(kind: Kind, st: Ad, id: string): Ad {
  const image = PHOTO_KINDS.has(kind) ? st.image : undefined;
  if (LINER_KINDS.has(kind) || kind === "boxed") return { ...st, id, image, lead: `${st.headline}.`, body: `${st.via ?? ""} · ${st.lead}`, foot: undefined };
  return { ...st, id, image };
}

/** Height of the photo under a headline: 3:2 across the box, capped so a wide box does not become all picture. */
function photoHeight(inner: number, fs: number): number {
  return Math.round(Math.min(inner / 1.5, fs * 11));
}

/** Theme bias for a template or head: Σ affinity × keyframe weight, flattened by heterogeneity. */
function bias(aff: Record<string, number>, s: Style): number {
  let a = 0;
  for (const [id, v] of Object.entries(aff)) a += v * (s.weights[id] ?? 0);
  const het = unitOf(s.dials.heterogeneity);
  // At het 0 the theme decides (a in 0..1, floor 0.04); at het 1 every template is equal.
  return (1 - het) * (0.04 + a * 3) + het * 0.6;
}

function pickTemplate(rng: Rng, s: Style, type: EntryType, sec?: Section, hold = 0): Template {
  const kinds = KIND_FOR_TYPE[type];
  const d = s.dials;
  // Inside a centre the section's own box set wins by its hold; the open catalog keeps a (1 − hold) share so intrusions happen.
  if (sec && hold > 0 && rng.chance(hold)) {
    const own = sec.boxes.map(([id, w]) => [TEMPLATES.find((t) => t.id === id), w] as const).filter((e): e is readonly [Template, number] => !!e[0] && kinds.includes(e[0].kind));
    if (own.length) return rng.weighted(own);
  }
  const entries = TEMPLATES.filter((t) => kinds.includes(t.kind)).map((t) => {
    let w = t.base * bias(t.aff, s);
    if (t.kind === "boxed") w *= 0.4 + unitOf(d.borders) * 1.4;
    if (t.kind === "liner" || t.kind === "liner-tint") w *= 1.6 - unitOf(d.borders) - unitOf(d.scale) * 0.4;
    if (DISPLAY_KINDS.has(t.kind)) w *= 0.4 + unitOf(d.scale) * 1.4;
    if (t.fill && t.fill !== "none" && t.fill !== "white") w *= 0.15 + unitOf(d.colour) * 1.7;
    if (t.fontDisplay && /Pinyon|Unifraktur|Righteous|Bowlby|Rye|Ultra/.test(t.fontDisplay)) w *= 0.3 + unitOf(d.fontMix) * 1.4;
    return [t, Math.max(0.001, w)] as const;
  });
  return rng.weighted(entries);
}

function pickHead(rng: Rng, s: Style, sec?: Section, hold = 0): HeadTemplate {
  if (sec && hold > 0 && rng.chance(hold)) {
    const own = sec.heads.map(([id, w]) => [HEADS.find((h) => h.id === id), w] as const).filter((e): e is readonly [HeadTemplate, number] => !!e[0]);
    if (own.length) return rng.weighted(own);
  }
  const entries = HEADS.map((h) => {
    let w = h.base * bias(h.aff, s);
    if (h.fill === "accent" || h.fill === "second" || h.fill === "fill") w *= 0.2 + unitOf(s.dials.colour) * 1.6;
    if (h.fill === "ink") w *= 0.5 + unitOf(s.dials.headers);
    return [h, Math.max(0.001, w)] as const;
  });
  return rng.weighted(entries);
}

function pickType(rng: Rng, s: Style, sec?: Section, hold = 0): EntryType {
  const e = { ...s.entries };
  if (sec) for (const [k, w] of Object.entries(sec.entries) as [EntryType, number][]) e[k] = e[k] * (1 - hold) + w * hold * 3;
  e.editorial = e.editorial * (0.1 + unitOf(s.dials.editorial) * 2.4);
  return rng.weighted(Object.entries(e) as [EntryType, number][]);
}

/** Resolve a template against the palette into a concrete voice. */
function voiceOf(t: Template, s: Style, rng: Rng): Voice {
  const p = s.palette;
  const th = s.anchors.type.family.tokens;
  const fillSlot = t.fill ?? "none";
  const reverse = fillSlot === "ink" || fillSlot === "accent" || fillSlot === "second";
  const fill = fillSlot === "none" ? undefined : fillSlot === "fill" ? p.fill : fillSlot === "tint" ? p.tint : fillSlot === "white" ? "#ffffff" : fillSlot === "ink" ? p.ink : fillSlot === "accent" ? p.accent : p.second;
  const edge = t.edge === "accent" ? p.accent : t.edge === "second" ? p.second : undefined;
  return {
    tpl: t.id,
    fontBody: t.fontBody ?? th["--cl-font-body"],
    fontHead: t.fontHead ?? t.fontDisplay ?? th["--cl-font-head"],
    fontDisplay: t.fontDisplay ?? t.fontHead ?? th["--cl-font-display"],
    headScale: t.headScale ?? 1.3,
    bodyScale: t.bodyScale ?? 1,
    border: t.border ?? "rule",
    fill,
    ink: reverse ? (fillSlot === "ink" ? "#f1ece0" : "#ffffff") : undefined,
    edge,
    reverse,
    shadow: !!t.shadow && rng.chance(0.7),
    align: t.align ?? (LINER_KINDS.has(t.kind) ? "justify" : "center"),
    cls: t.cls,
  };
}
const FILLER_VOICE = (s: Style): Voice => ({ tpl: "filler", fontBody: s.fontBody, fontHead: s.fontHead, fontDisplay: s.fontDisplay, headScale: 1, bodyScale: 0.8, border: "none", reverse: false, shadow: false, align: "left" });

function estimateHeight(kind: Kind, ad: Ad, width: number, s: Style, v: Voice): number {
  const boxed = !LINER_KINDS.has(kind);
  const inner = width - (boxed ? 20 : 6);
  const fs = s.bodySize * v.bodyScale;
  const glyph = /Courier/.test(v.fontBody) ? 0.6 : /Condensed|Oswald|Pathway/.test(v.fontBody) ? 0.45 : /Unifraktur/.test(v.fontBody) ? 0.5 : 0.53;
  const cpl = Math.max(8, inner / (fs * glyph));
  const lineH = fs * s.leading;
  const headH = fs * v.headScale * 1.05;
  const chars = (ad.lead?.length ?? 0) + ad.body.length + (ad.foot?.length ?? 0) + 4;
  const bodyLines = Math.ceil(chars / cpl) + (ad.body.match(/\n/g)?.length ?? 0);
  const headLines = Math.max(1, Math.ceil(((ad.headline ?? ad.lead).length * fs * v.headScale * 0.55) / inner));
  const air = 1 + unitOf(s.dials.scale) * 0.22;
  let px: number;
  switch (kind) {
    case "head": px = fs * 2.2 + 12; break;
    case "banner": px = fs * 8 + 30; break;
    case "filler": px = 0; break;
    case "liner": case "liner-tint": px = bodyLines * lineH + 8; break;
    case "boxed": px = bodyLines * lineH + headH * 0.3 + 18; break;
    case "display": case "reverse": px = (Math.ceil(ad.body.length / (cpl * 1.05)) * lineH + headLines * headH * 0.9 + fs * 1.6 + 22) * air; break;
    case "notice": px = bodyLines * lineH * 1.1 + headLines * headH + fs * 2 + 28; break;
    case "stack": px = (headLines * headH + fs * 6 + Math.ceil(ad.body.length / cpl) * lineH + 16) * air; break;
    case "coupon": px = headLines * headH + fs * 10 + 80; break;
    case "offer": px = bodyLines * lineH + headLines * headH + fs * 2 + 24; break;
    case "agency": case "listing": px = (ad.body.split("\n").length + 2) * lineH * 1.2 + headH + 16; break;
    case "poster": px = (headLines * headH * 0.9 + fs * 4.5 + 40) * air; break;
    case "personal": px = bodyLines * lineH * 1.15 + headH + fs * 1.5 + 20; break;
    case "card": px = (bodyLines * lineH + headH + fs * 1.5 + 24) * air; break;
    case "profile": px = bodyLines * lineH + fs * 4 + 24; break;
    case "house": px = headLines * headH + Math.ceil(ad.body.length / cpl) * lineH + 20; break;
    case "article": px = headLines * headH + Math.ceil((ad.lead?.length ?? 0) / cpl) * lineH * 1.25 + Math.ceil(ad.body.length / cpl) * lineH + 26; break;
    case "weather": px = (ad.body.split("\n").length + 1) * lineH * 1.3 + headH + 26; break;
  }
  if (ad.image && kind !== "profile") px += photoHeight(inner, fs) + 6;
  // Liners wrap unpredictably and are stretched to the column anyway; boxes were over-estimated, so less slack there.
  return Math.ceil(px * (LINER_KINDS.has(kind) ? 1.16 : 1.06) + 6);
}

const PAIRED: Record<EntryType, string> = {
  classified: "ANUNCIOS", notice: "AVISOS", seasonal: "AMOR", listing: "CARTELERA", poster: "ESTA NOCHE", mailorder: "POR CORREO", profile: "ARTISTAS", editorial: "NOTICIAS",
};
function labelFor(rng: Rng, type: EntryType, head: HeadTemplate): { label: string; num?: string } {
  const label = rng.pick(CLASSES[type]);
  if (head.device === "paired") return { label, num: PAIRED[type] };
  if (head.device === "two-tier") return { label: label.split(/ & | /).slice(-1)[0].toUpperCase(), num: label.split(/ & | /).slice(0, -1).join(" ").toUpperCase() || "HELP WANTED" };
  if (head.device === "town") return { label: rng.pick(["BELLEVILLE", "KEARNY", "HARRISON", "N. ARLINGTON", "RIVERSIDE", "THE OLD MILL", "CANAL STREET", "FOUNDRY YARD"]) };
  const num = head.device === "numbered" || (head.device === "tab-colour" && rng.chance(0.4)) ? String(rng.int(1, 99)).padStart(3, "0") : undefined;
  return { label, num };
}

/** Generate zone (r, k). The style is sampled at the zone's centre in tile units. */
/** A page generated purely from a section and twists (hold 1), for the review grid. */
export function tileFromSection(base: Section, twists: Twist[], seed: number, w = 900, h = 1300): Tile {
  return tileCore({ r: 9000 + seed, k: 0, x: 0, y: 0, w, h }, seed, [], { section: base, twists, hold: 1 });
}

export function tileAt(r: number, k: number, reals: RealEntry[]): Tile {
  return tileCore(zoneGeom(r, k), 0, reals, null);
}

function tileCore(z: Zone, seedOffset: number, reals: RealEntry[], forced: { section: Section; twists: Twist[]; hold: number } | null): Tile {
  const r = z.r, k = z.k;
  const ci = Math.floor((z.x + z.w / 2) / CELL_W);
  const cj = Math.floor((z.y + z.h / 2) / CELL_H);
  const s0 = styleAt(ci, cj);
  const rng = new Rng(hash(r, k, 42 + seedOffset));
  const d = s0.dials;
  // The section at this spot: inside a centre the zone takes the section's grid, body, palette and rule; its twists come from the zone hash.
  const at = forced ? { section: forced.section, hold: forced.hold } : sectionAt(ci, cj);
  const tw = forced ? forced.twists : at ? twistsFor(unit01(r, k, 77), at.hold > 0.6 ? 3 : 2) : [];
  const sec = at ? variant(at.section, tw) : undefined;
  const hold = at?.hold ?? 0;
  const s: Style = sec && hold > 0.5
    ? { ...s0, pitch: sec.pitch, gap: sec.gap, bodySize: sec.body, leading: sec.leading, rule: sec.rule, palette: PALETTES.find((p) => p.id === sec.palette) ?? s0.palette, tint: (PALETTES.find((p) => p.id === sec.palette) ?? s0.palette).tint }
    : s0;
  const units: Unit[] = [];
  let n = 0;
  const key = (q: string) => `${r}:${k}:${q}${n++}`;
  const seen = new Set<string>();
  const used = new Map<string, number>();
  // News sheet: every box carries a real story; a zone repeats one only once it has used them all.
  const news = newsPool();
  const regions = [...new Set(news.map((a) => a.lead))];
  const story = (): Ad => {
    let a = rng.pick(news);
    for (let t = 0; t < 8 && seen.has(a.id); t++) a = rng.pick(news);
    seen.add(a.id);
    return a;
  };
  const fillerAd = (): Ad => ({ id: key("f"), type: "classified", origin: "generated", lead: "", body: (sec && hold > 0.5 ? rng.pick(sec.fillers) : rng.pick(["xzde★", "wxzd★", "efgh★", "m18 1m", "dec10 3m", "apl5 tf", "· · ·", "——", "31W03", "33W04", "(CL21017106)"])).replace(/\{n\}/g, () => String(rng.int(100, 999))).replace(/\{l\}/g, () => String.fromCharCode(65 + rng.int(0, 25))) });

  // The grid: the strip's pitch divides the zone's width; the breaks dial lets a zone depart from its neighbours' pitch.
  const pitch = s.pitch * (rng.chance(unitOf(d.breaks) * 0.5) ? rng.pick([0.7, 0.85, 1.2, 1.45]) : 1);
  const cols = Math.max(2, Math.min(10, Math.round(z.w / pitch)));
  const gap = s.gap;
  const colW = (z.w - (cols - 1) * gap) / cols;
  const grid: Grid = { cols, colW, gap };
  const heights = new Array<number>(cols).fill(0);
  const colX = (c: number) => c * (colW + gap);
  const spanW = (span: number) => span * colW + (span - 1) * gap;
  const bottom = z.h;

  const zoneHead = pickHead(rng, s, sec, hold);
  const headPerRun = rng.chance(unitOf(d.heterogeneity) * (1 - hold));

  const homes: Ad[] = [];
  const echoes: Array<{ ad: Ad; home: [number, number] }> = [];
  for (const e of reals) {
    const hx = e.home[0] * CELL_W + CELL_W / 2, hy = e.home[1] * CELL_H + CELL_H / 2;
    const isHome = hx >= z.x && hx < z.x + z.w && hy >= z.y && hy < z.y + z.h;
    let h = 0;
    for (let q = 0; q < e.ad.id.length; q++) h = (h * 31 + e.ad.id.charCodeAt(q)) | 0;
    if (isHome) homes.push(e.ad);
    else if (unit01(r, k, h) < 2.2 / Math.max(1, reals.length)) echoes.push(e);
  }

  const place = (kind: Kind, ad: Ad, voice: Voice, span: number, extra: Partial<Unit> = {}): boolean => {
    span = Math.min(span, cols);
    let c0 = 0;
    if (span === 1) {
      for (let c = 1; c < cols; c++) if (heights[c] < heights[c0]) c0 = c;
    } else {
      let best = Infinity;
      for (let c = 0; c + span <= cols; c++) {
        const top = Math.max(...heights.slice(c, c + span));
        if (top < best) { best = top; c0 = c; }
      }
      const top = Math.max(...heights.slice(c0, c0 + span));
      for (let c = c0; c < c0 + span; c++) {
        if (heights[c] < top - 2) units.push({ key: key("p"), kind: "filler", ad: fillerAd(), voice: FILLER_VOICE(s), x: colX(c), y: heights[c], w: colW, h: top - heights[c], span: 1 });
        heights[c] = top;
      }
    }
    const y = heights[c0];
    if (y >= bottom) return false;
    const w = spanW(span);
    const h = estimateHeight(kind, ad, w, s, voice);
    units.push({ key: ad.id, kind, ad, voice, x: colX(c0), y, w, h, span, ...extra });
    for (let c = c0; c < c0 + span; c++) heights[c] = y + h;
    return true;
  };
  const full = () => Math.min(...heights) >= bottom;

  /** Draw a template, honouring rarity: rare ones seldom and at most twice per zone; nothing repeats back to back. */
  const draw = (type: EntryType): Template => {
    for (let tries = 0; tries < 4; tries++) {
      const t = pickTemplate(rng, s, type, sec, hold);
      const u = used.get(t.id) ?? 0;
      if (t.rare && (u >= 2 || rng.chance(0.55))) continue;
      if (!t.rare && u >= 1 && rng.chance(0.5)) continue;
      used.set(t.id, u + 1);
      return t;
    }
    const t = pickTemplate(rng, s, type, sec, hold);
    used.set(t.id, (used.get(t.id) ?? 0) + 1);
    return t;
  };
  /** A voice with the box's own size: displays and posters vary 0.95–1.35×, liners stay put. */
  const sized = (t: Template): Voice => {
    const v = voiceOf(t, s, rng);
    if (DISPLAY_KINDS.has(t.kind) && t.kind !== "profile") v.bodyScale *= 0.95 + rng.next() * 0.4 * (0.5 + unitOf(d.scale));
    return v;
  };

  const newsBanner = (src: { title: string; kicker?: string }) =>
    news.length ? { title: rng.pick(NEWS_MASTHEADS), kicker: regions.slice(0, 7).join(" · ") } : src;
  if (sec && hold > 0.5 && sec.banner && rng.next() < sec.banner.chance) {
    const bt = TEMPLATES.find((t) => t.id === sec.banner!.template) ?? TEMPLATES[0];
    const b = newsBanner(sec.banner);
    place("banner", { id: key("b"), type: "classified", origin: "generated", lead: b.kicker ?? "", headline: b.title, body: b.kicker ?? "" }, voiceOf(bt, s, rng), Math.min(cols, cols >= 6 ? 4 : 3));
  } else if (!sec && rng.next() < s.banner * unitOf(d.structures) * 0.3) {
    const src = s.anchors.mix.masthead ?? s.anchors.device.masthead;
    const b = src && newsBanner(src);
    if (b) place("banner", { id: key("b"), type: "classified", origin: "generated", lead: b.kicker ?? "", headline: b.title, body: b.kicker ?? "" }, voiceOf(draw("poster"), s, rng), Math.min(cols, cols >= 6 ? 4 : 3));
  }
  for (const a of homes) place(cols >= 4 ? "display" : "profile", a, voiceOf(TEMPLATES.find((t) => t.id === "display-playfair")!, s, rng), cols >= 4 ? 2 : 1, { home: true });

  let guard = 0;
  const headChance = sec ? sec.headChance * hold + (0.2 + unitOf(d.headers) * 0.8) * (1 - hold) : 0.2 + unitOf(d.headers) * 0.8;
  while (!full() && guard++ < 600) {
    if (echoes.length && rng.chance(0.3)) {
      const e = echoes.shift()!;
      const t = draw("profile");
      place(t.kind, e.ad, voiceOf(t, s, rng), 1, { homeCell: e.home });
    }
    const type = pickType(rng, s, sec, hold);
    const run = sec && hold > 0.5 ? rng.int(sec.run[0], sec.run[1]) : rng.int(2, 3 + Math.round(unitOf(d.density) * 4));
    const head = headPerRun ? pickHead(rng, s, sec, hold) : zoneHead;
    if (rng.chance(headChance)) {
      const { label, num } = news.length ? { label: rng.pick(regions), num: head.device === "paired" ? PAIRED.editorial : undefined } : labelFor(rng, type, head);
      const hv: Voice = { ...FILLER_VOICE(s), tpl: head.id, fontHead: head.font, headScale: head.scale, bodyScale: 1, align: "center" };
      place("head", { id: key("h"), type, origin: "generated", lead: label, body: "" }, hv, 1, { label, num, head });
    }
    for (let q = 0; q < run && !full(); q++) {
      const t = draw(type);
      let kind: Kind = t.kind;
      let ad: Ad;
      if (news.length) {
        kind = NEWS_KIND[kind] ?? kind;
        ad = newsAd(kind, story(), key("n"));
      } else if (kind === "agency") ad = generateAgency(rng, key("a"));
      else if (kind === "house") {
        const [lead, body] = rng.pick(HOUSE_LINES);
        ad = { id: key("x"), type, origin: "generated", lead, headline: lead, body };
      } else {
        ad = generateAd(rng, type, key("g"));
        if (seen.has(ad.headline ?? ad.lead)) ad = generateAd(rng, type, key("g"));
        if (kind === "weather" && ad.type !== "editorial") kind = "display";
      }
      seen.add(ad.headline ?? ad.lead);
      const scale = unitOf(d.scale);
      const wideP = (t.wide ?? 0.2) * (0.3 + scale * 1.4);
      const wide = DISPLAY_KINDS.has(kind) && cols >= 4 && rng.chance(wideP);
      place(kind, ad, sized(t), wide ? (cols >= 7 && rng.chance(scale * 0.5) ? 3 : 2) : 1);
    }
    if (!news.length && rng.chance(0.05)) {
      const [lead, body] = rng.pick(HOUSE_LINES);
      const houseId = rng.chance(0.5) ? "house-spartan" : "house-anton-black";
      const t = TEMPLATES.find((x) => x.id === houseId)!;
      place("house", { id: key("x"), type: "classified", origin: "generated", lead, headline: lead, body }, voiceOf(t, s, rng), 1);
    }
  }
  for (const e of echoes.splice(0, 2)) if (!full()) place("liner", e.ad, voiceOf(TEMPLATES[0], s, rng), 1, { homeCell: e.home });

  for (let c = 0; c < cols; c++) {
    const gapH = bottom - heights[c];
    if (gapH <= 0) continue;
    const inCol = units.filter((u) => u.x === colX(c) && u.span === 1).sort((p, q) => p.y - q.y);
    const last = inCol.at(-1);
    if (last && LINER_KINDS.has(last.kind)) last.h += gapH;
    else units.push({ key: key("p"), kind: "filler", ad: fillerAd(), voice: FILLER_VOICE(s), x: colX(c), y: heights[c], w: colW, h: gapH, span: 1 });
  }
  for (const u of units) if (u.y + u.h > bottom) u.h = bottom - u.y;

  return { zone: z, i: ci, j: cj, x: z.x, y: z.y, w: z.w, h: z.h, style: s, grid, units, section: sec ? { id: at!.section.id, label: at!.section.label, twists: tw.map((t) => t.id), hold } : undefined };
}

export function findNearest(i: number, j: number, recipeId: string, radius = 40): [number, number] | null {
  for (let r = 1; r <= radius; r++) {
    for (let di = -r; di <= r; di++) for (const dj of [-r, r]) if (styleAt(i + di, j + dj).anchors.mix.id === recipeId) return [i + di, j + dj];
    for (let dj = -r + 1; dj <= r - 1; dj++) for (const di of [-r, r]) if (styleAt(i + di, j + dj).anchors.mix.id === recipeId) return [i + di, j + dj];
  }
  return null;
}
