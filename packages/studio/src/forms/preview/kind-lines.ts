// ============================================================================
// What the series, artwork and offering previews print, read from the answers
// (pass 2, Tendons). Plain functions, no React, so a host's own cards can use
// them too. Keys are the pass 2 answer keys (PLAN §12); dates are wall-clock
// "YYYY-MM-DD" and are never converted through an instant (see format.ts).
// ============================================================================

import type { Answers, FormContext } from '../contract';
import type { PersonOption } from '../fields/Chips';
import { creditName, creditRoleLabel, readCredits, type CreditValue } from '../fields/CreditRows';
import { mediaUrl } from '../fields/MediaField';
import { readPictures } from '../fields/PicturesField';
import { mediumShort, priceLine } from '../kinds/artwork/sections';
import { heldSummary, priceSummary } from '../kinds/service/sections';
import { firstTitledSession, seriesEnds, seriesEveryWeeks, seriesSessions } from '../rules/series';
import { clock, paragraphs, parseWallClock, shortDay, text, weekdayPlural, type WallClock } from './format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** "$180", "$1,250.50": the narrow symbol (the design's "$ 180 CAD" reads "$180" on cards), no cents when whole. */
export function money(amount: unknown, currency: unknown): string | null {
  const n = num(amount);
  if (n === null) return null;
  const cur = typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'CAD';
  const whole = Math.round(n * 100) % 100 === 0;
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

// ── series ───────────────────────────────────────────────────────────────────
// The dates, numbers and skips are soft tissue's (rules/series.ts), so the card,
// the page and the planner always list the same sessions with the same numbers.

export interface SessionLine {
  date: string;
  /** "Thu 19 Nov" */
  day: string;
  /** Its number on the site (rules/series.ts sessionNumbering); null when the rule gives none. */
  no: number | null;
  title: string;
  note: string;
  skipped: boolean;
  reason: string;
}

/** "19 Nov" */
export function dayMonth(date: string): string {
  const w = parseWallClock(date);
  return w ? `${w.d} ${MONTHS[w.mo - 1]}` : '';
}

/** Where a series meets, short, for its card: the place's first part ("Studio 4"), or online. */
export function wherePlaceShort(a: Answers): string {
  if (a.where_mode === 'talk') return 'Online, in a Talk room';
  if (a.where_mode === 'link') return 'Online';
  const place = text(a.location).split(',')[0]?.trim() ?? '';
  return place || (text(a.meeting_url) ? 'Online' : '');
}

/** "Thursdays" | "Every other Thursday" | "Every 3 weeks, Thursday". */
export function cadenceWord(w: WallClock, everyWeeks: number): string {
  const day = DAYS[new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay()]!;
  if (everyWeeks <= 1) return weekdayPlural(w);
  if (everyWeeks === 2) return `Every other ${day}`;
  return `Every ${everyWeeks} weeks, ${day}`;
}

export interface SeriesLines {
  /** "Series · Thursdays, 18:30" */
  kicker: string;
  /** "Starts 19 Nov", on the picture. */
  starts: string | null;
  /** "8 sessions, 19 Nov to 21 Jan · Studio 4" */
  span: string;
  /** "Monotype basics": the first held session with a title. */
  first: string | null;
  sessions: SessionLine[];
  /** Sessions held (skipped ones left out). */
  count: number;
}

export function seriesLines(a: Answers): SeriesLines {
  const sessions: SessionLine[] = seriesSessions(a).map((r) => {
    const w = parseWallClock(r.date);
    return { date: r.date, day: w ? shortDay(w) : r.date, no: r.number, title: r.title, note: r.note, skipped: r.skipped, reason: r.reason };
  });
  const on = sessions.filter((s) => !s.skipped);
  const w = parseWallClock(a.scheduled_at);
  const at = w ? clock(w) : '';
  const kicker = w ? ['Series', [cadenceWord(w, seriesEveryWeeks(a)), at].filter(Boolean).join(', ')].join(' · ') : 'Series';
  const firstOn = on[0];
  const lastOn = on[on.length - 1];
  const count = on.length;
  const range =
    firstOn && lastOn && lastOn !== firstOn ? `${dayMonth(firstOn.date)} to ${dayMonth(lastOn.date)}` : firstOn ? dayMonth(firstOn.date) : '';
  const head =
    seriesEnds(a) === 'open'
      ? firstOn
        ? `From ${dayMonth(firstOn.date)}, no last date`
        : ''
      : [count ? `${count} ${count === 1 ? 'session' : 'sessions'}` : '', range].filter(Boolean).join(', ');
  return {
    kicker,
    starts: firstOn ? `Starts ${dayMonth(firstOn.date)}` : null,
    span: [head, wherePlaceShort(a)].filter(Boolean).join(' · '),
    first: firstTitledSession(a) || null,
    sessions,
    count,
  };
}

// ── artwork ──────────────────────────────────────────────────────────────────
// The card's price and medium are the kind's own words (kinds/artwork priceLine,
// mediumShort), so the form's hint ("The card reads …") and the card agree.

/** The medium's first clause, for the page ("Etching and aquatint" from "Etching and aquatint on Hahnemühle, 300 gsm"). */
export function shortMedium(medium: unknown): string {
  const m = text(medium);
  return (m.split(/,| on /i)[0] ?? '').trim();
}

/** "40 × 50 cm", "40 × 50 × 3 cm": as typed, in the unit chosen (the adapter converts inches on save). */
export function sizeLine(a: Answers): string {
  const dims = [num(a.height_cm), num(a.width_cm)];
  if (dims[0] === null || dims[1] === null) return '';
  const d = num(a.depth_cm);
  const unit = a.unit === 'in' ? 'in' : 'cm';
  return `${[...dims, ...(d !== null && d > 0 ? [d] : [])].join(' × ')} ${unit}`;
}

/** "Edition of 25" | "One of a kind" | "Open edition" | "". */
export function editionLine(a: Answers): string {
  if (a.edition_type === 'edition') {
    const size = num(a.edition_size);
    return size ? `Edition of ${size}` : 'Limited edition';
  }
  if (a.edition_type === 'open') return 'Open edition';
  if (a.edition_type === 'unique') return 'One of a kind';
  return '';
}

export interface VariantLine {
  name: string;
  price: string | null;
  stock: number | null;
}

export function readVariants(a: Answers): VariantLine[] {
  const v = a.variants;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { name?: unknown; price?: unknown; stock?: unknown } => Boolean(x) && typeof x === 'object')
    .map((x) => ({ name: text(x.name), price: money(x.price, a.currency), stock: num(x.stock) }))
    .filter((x) => x.name || x.price);
}

/** People a credit's userId can name: the context's maker candidates, host candidates and the viewer. */
function peopleOf(ctx: FormContext | undefined): PersonOption[] {
  if (!ctx) return [];
  const f = ctx.fields;
  const out: PersonOption[] = [];
  for (const key of ['makerCandidates', 'hostCandidates']) {
    const list = f[key];
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const o = (p && typeof p === 'object' ? p : {}) as { userId?: unknown; displayName?: unknown };
      if (typeof o.userId === 'string' && typeof o.displayName === 'string') out.push({ value: o.userId, label: o.displayName });
    }
  }
  if (typeof f.viewerId === 'string' && typeof f.viewerName === 'string') out.push({ value: f.viewerId, label: f.viewerName });
  return out;
}

export interface ArtworkLines {
  pictures: string[];
  credits: CreditValue[];
  artist: string;
  /** "Mara Okafor · printed by Elkdonis Lab" */
  creditLine: string;
  /** "Mara Okafor · Etching, 2026" */
  makerLine: string;
  /** "Etching and aquatint · 40 × 50 cm · 2026 · Edition of 25" */
  detailsLine: string;
  /** "$180" | "From $180" (variants) | "Price on request" | "Not for sale" | "No price yet" */
  price: string;
  mode: 'price' | 'request' | 'nfs';
  /** "Available" | "Reserved" | "Sold", only when the form keeps an availability; null otherwise. */
  availability: { label: string; tone: 'accent' | 'neutral' } | null;
  variants: VariantLine[];
}

export function artworkLines(a: Answers, ctx?: FormContext): ArtworkLines {
  const pictures = readPictures(a.pictures).map((p) => p.url);
  const cover = mediaUrl(a.cover_image_url ?? null);
  if (!pictures.length && cover) pictures.push(cover);
  const people = peopleOf(ctx);
  const credits = readCredits(a.credits).filter((c) => creditName(c, people));
  const artistCredit = credits.find((c) => c.role === 'artist');
  const artist = artistCredit ? creditName(artistCredit, people) : text(a.artist_name);
  const others = credits.filter((c) => c !== artistCredit).map((c) => `${creditRoleLabel(c.role).toLowerCase()} ${creditName(c, people)}`);
  const year = text(String(a.year ?? ''));
  const mode = a.price_mode === 'request' ? 'request' : a.price_mode === 'nfs' ? 'nfs' : 'price';
  const variants = readVariants(a);
  const prices = (Array.isArray(a.variants) ? a.variants : [])
    .map((v) => (v && typeof v === 'object' ? num((v as { price?: unknown }).price) : null))
    .filter((p): p is number => p !== null);
  let priceText: string;
  if (mode === 'nfs') priceText = 'Not for sale';
  else if (mode === 'price' && prices.length) priceText = `${new Set(prices).size > 1 ? 'From ' : ''}${money(Math.min(...prices), a.currency) ?? ''}`;
  else if (ctx) priceText = priceLine(a, ctx);
  else priceText = mode === 'request' ? 'Price on request' : money(a.price, a.currency) ?? 'No price yet';
  const kept = typeof a.availability === 'string' && a.availability !== '';
  const avail = a.availability === 'sold' ? 'Sold' : a.availability === 'reserved' ? 'Reserved' : 'Available';
  return {
    pictures,
    credits,
    artist,
    creditLine: [artist, ...others].filter(Boolean).join(' · '),
    makerLine: [artist, [mediumShort(text(a.medium)), year].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    detailsLine: [shortMedium(a.medium), sizeLine(a), year, editionLine(a)].filter(Boolean).join(' · '),
    price: priceText,
    mode,
    availability: mode === 'nfs' || !kept ? null : { label: avail, tone: avail === 'Available' ? 'accent' : 'neutral' },
    variants,
  };
}

// ── offering (service) ──────────────────────────────────────────────────────
// The booking and price lines are the kind's own (kinds/service heldSummary,
// priceSummary): "One to one · 1h · Studio 4", "$40–$80, a sliding scale".

const STATUS: Record<string, string> = { waitlist: 'Waitlist only', full: 'Full', closed: 'Closed' };

/** "1 hour", "1½ hours", "45 minutes". */
export function hoursLabel(h: unknown): string {
  const n = num(h);
  if (n === null || n <= 0) return '';
  if (n < 1) return `${Math.round(n * 60)} minutes`;
  const whole = Math.floor(n);
  const half = Math.abs(n - whole - 0.5) < 0.01;
  if (half) return `${whole}½ hours`;
  if (Math.abs(n - whole) < 0.01) return `${whole} ${whole === 1 ? 'hour' : 'hours'}`;
  return `${n} hours`;
}

export interface ServiceLines {
  /** The line under the title, else the card summary, else the description's opening. */
  lede: string;
  /** "One to one · 1h · Studio 4 · $40–$80, a sliding scale" */
  meta: string;
  /** "$80" | "$40–$80, a sliding scale" | "Free" */
  price: string | null;
  /** "Book" while open, else the status ("Full"). */
  action: string;
  open: boolean;
}

export function serviceLines(a: Answers): ServiceLines {
  const price = priceSummary(a) || null;
  const status = typeof a.registration_status === 'string' ? a.registration_status : 'open';
  const opening = paragraphs(a.body, 1)[0] ?? '';
  return {
    lede: text(a.subtitle) || text(a.excerpt) || (opening.length > 160 ? `${opening.slice(0, 159)}…` : opening),
    meta: [heldSummary(a), price ?? ''].filter(Boolean).join(' · '),
    price,
    action: STATUS[status] ?? 'Book',
    open: !(status in STATUS),
  };
}
