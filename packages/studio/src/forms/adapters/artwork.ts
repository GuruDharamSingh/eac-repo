// ============================================================================
// Artwork → commerce's createArtwork / updateArtwork / setArtworkMedia /
// publishArtwork (pass 2, Ligament). PLAN §12. The store and the author come
// from the signed-in person: the host's action resolves them, never the form.
//
// Answer keys (PLAN §12) and where each goes:
//   title, description (HTML)           → title, descriptionHtml (sanitised by commerce)
//   pictures [{ url, alt }]             → images, in order; the first is the card picture
//   credits [{ role: 'artist', userId }]→ the first artist with a userId = creditedArtistUserId
//                                         (the host drops it when that is the seller)
//   price_mode 'price' | 'request'      → the Default variant's priceMinor; 'request' = 0,
//   price (major units), currency          commerce's "price on request" (publishArtwork doc)
//   medium, height_cm, width_cm, depth_cm, unit ('in' → cm), year
//   edition_type                        → kind: unique original / edition limited_edition / open open_edition
//                                         (commerce's own `kind` is read when edition_type is absent:
//                                         the platform preset "Editioned print" sets it)
//   certificateOfAuthenticity (boolean) → certificateOfAuthenticity (the same preset sets it)
//
// Dropped, with a warning (commerce has no place for them; evidence in PLAN §12 notes):
//   pictures[].focal, other credit roles and name-only credits, price_mode 'nfs'
//   (saved as price on request), availability 'reserved' / 'sold' (only orders set
//   them), edition_size / edition_proofs, variants, shows.store / shows.gallery,
//   any forms.* key.
// ============================================================================

import type { StudioResult } from '../../types';
import type { Answers, FormActions, FormPreset } from '../contract';
import { presetFromAnswers } from '../presets';

export type ArtworkCurrency = 'CAD' | 'USD' | 'EUR' | 'GBP';
export const ARTWORK_CURRENCIES: ArtworkCurrency[] = ['CAD', 'USD', 'EUR', 'GBP'];

export type ArtworkKindView = 'original' | 'limited_edition' | 'open_edition';

// ── the host's side ─────────────────────────────────────────────────────────

export interface ArtworkContextView {
  /** False without an active store: `reason` says why ("You don't have a store here yet."). */
  canEdit: boolean;
  reason: string | null;
  viewerId: string | null;
  viewerName: string;
  storeName: string | null;
  defaultCurrency: ArtworkCurrency;
  currencies: ArtworkCurrency[];
  /** Who may be credited as the artist. Pass 2: the viewer only (their own store). */
  makerCandidates: Array<{ userId: string; displayName: string }>;
}

export interface ArtworkInputView {
  title: string;
  descriptionHtml: string | null;
  kind: ArtworkKindView;
  yearCreated: number | null;
  medium: string | null;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  /** The Default variant's price in minor units; 0 = price on request. */
  priceMinor: number;
  currency: ArtworkCurrency;
  creditedArtistUserId: string | null;
  certificateOfAuthenticity: boolean;
  images: Array<{ url: string; alt: string | null }>;
}

export interface ArtworkRecordView {
  id: string;
  slug: string;
  title: string;
  /** In the form's words: 'published' = in the store (commerce available, reserved or sold). */
  status: 'draft' | 'published' | 'archived';
  /** Commerce's own status. */
  artworkStatus: 'draft' | 'available' | 'reserved' | 'sold' | 'archived';
  /** Commerce keeps no publish time: the last update of a listed piece stands in for it. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: ArtworkInputView;
  /** The piece's page on the marketplace. */
  href?: string | null;
}

export interface ArtworkActions {
  context(orgId: string): Promise<ArtworkContextView>;
  loadArtwork(id: string): Promise<ArtworkRecordView | null>;
  saveArtwork(
    orgId: string,
    input: ArtworkInputView,
    intent: 'draft' | 'published',
    id: string | null,
    opts?: { autosave?: boolean }
  ): Promise<StudioResult<{ record: ArtworkRecordView; warnings: string[]; notPublished: string | null }>>;
  /** The person's pieces, for "your last piece's settings". */
  listArtworks?(): Promise<Array<{ id: string; updatedAt: string }>>;
}

// ── answers ⇄ input ──────────────────────────────────────────────────────────

const CONSUMED = new Set([
  'kind',
  'title',
  'description',
  'pictures',
  'credits',
  'price_mode',
  'price',
  'currency',
  'availability',
  'medium',
  'height_cm',
  'width_cm',
  'depth_cm',
  'unit',
  'year',
  'edition_type',
  'edition_size',
  'edition_proofs',
  'variants',
  'shows',
  'certificateOfAuthenticity',
]);

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const EDITION_KIND: Record<string, ArtworkKindView> = { unique: 'original', edition: 'limited_edition', open: 'open_edition' };
const KIND_EDITION: Record<ArtworkKindView, string> = { original: 'unique', limited_edition: 'edition', open_edition: 'open' };

/** A length as typed, in cm (2 decimals), or null. */
function cm(v: unknown, unit: string): number | null {
  const n = optNum(v);
  if (n === null || n <= 0) return null;
  return Math.round((unit === 'in' ? n * 2.54 : n) * 100) / 100;
}

export function artworkInputFromAnswers(
  a: Answers,
  defaultCurrency: ArtworkCurrency = 'CAD'
): { ok: true; input: ArtworkInputView; warnings: string[] } | { ok: false; error: string } {
  const dropped: string[] = [];

  const title = str(a.title);
  if (title.length < 2) return { ok: false, error: 'Give the piece a title.' };

  const pictures = Array.isArray(a.pictures) ? a.pictures.map(obj) : [];
  const images = pictures
    .map((p) => ({ url: str(p.url), alt: str(p.alt) || null }))
    .filter((p) => p.url)
    .slice(0, 24);
  if (pictures.some((p) => p.focal != null)) dropped.push('the focal point of a picture');

  const credits = Array.isArray(a.credits) ? a.credits.map(obj) : [];
  const artist = credits.find((c) => str(c.role || 'artist') === 'artist' && str(c.userId));
  const creditedArtistUserId = artist ? str(artist.userId) : null;
  if (credits.some((c) => c !== artist)) dropped.push('credits other than the artist');

  const mode = str(a.price_mode) || 'price';
  let priceMinor = 0;
  if (mode === 'price') {
    const price = optNum(a.price);
    if (price !== null && price < 0) return { ok: false, error: 'The price cannot be below zero.' };
    priceMinor = Math.max(0, Math.round((price ?? 0) * 100));
  } else if (mode === 'nfs') {
    dropped.push('“not for sale” (it shows as price on request)');
  }
  const currencyRaw = str(a.currency).toUpperCase();
  const currency = (currencyRaw || defaultCurrency) as ArtworkCurrency;
  if (!ARTWORK_CURRENCIES.includes(currency)) return { ok: false, error: 'Pick the price in CAD, USD, EUR or GBP.' };

  const availability = str(a.availability);
  if (availability === 'reserved' || availability === 'sold') dropped.push(`“${availability}” (a piece becomes reserved or sold through its order)`);

  const unit = str(a.unit) === 'in' ? 'in' : 'cm';
  const yearN = optNum(a.year);
  const year = yearN !== null && Number.isInteger(yearN) && yearN > 0 && yearN < 10000 ? yearN : null;

  // edition_type is the §12 key; the platform preset "Editioned print" still sets commerce's own `kind`.
  const legacyKind = str(a.kind);
  const kind: ArtworkKindView =
    EDITION_KIND[str(a.edition_type)] ??
    (legacyKind === 'limited_edition' || legacyKind === 'open_edition' || legacyKind === 'original' ? legacyKind : 'original');
  if (optNum(a.edition_size) !== null || optNum(a.edition_proofs) !== null) dropped.push('the edition size and proofs');
  if (Array.isArray(a.variants) && a.variants.length > 0) dropped.push('variants (one price per piece for now)');
  const shows = obj(a.shows);
  if (shows.store === false || shows.gallery === true) dropped.push('where it shows');

  const otherForms = Object.keys(a).filter((k) => (k === 'forms' || k.startsWith('forms.')) && !CONSUMED.has(k) && a[k] !== undefined);

  const input: ArtworkInputView = {
    title: title.slice(0, 200),
    descriptionHtml: str(a.description) || null,
    kind,
    yearCreated: year,
    medium: str(a.medium).slice(0, 200) || null,
    heightCm: cm(a.height_cm, unit),
    widthCm: cm(a.width_cm, unit),
    depthCm: cm(a.depth_cm, unit),
    priceMinor,
    currency,
    creditedArtistUserId,
    certificateOfAuthenticity: a.certificateOfAuthenticity === true,
    images,
  };

  const warnings: string[] = [];
  if (dropped.length) warnings.push(`Not saved yet: ${dropped.join(', ')}.`);
  if (otherForms.length) warnings.push('Some choices are kept in this form but not saved yet: ' + otherForms.join(', ') + '.');
  return { ok: true, input, warnings };
}

/** A saved piece → the form's answers. */
export function artworkAnswers(r: ArtworkRecordView): Answers {
  const i = r.input;
  const listedState = r.artworkStatus === 'reserved' || r.artworkStatus === 'sold' ? r.artworkStatus : 'available';
  return {
    kind: 'artwork',
    title: i.title,
    description: i.descriptionHtml ?? '',
    pictures: i.images.map((p) => ({ url: p.url, ...(p.alt ? { alt: p.alt } : {}) })),
    credits: i.creditedArtistUserId ? [{ role: 'artist', userId: i.creditedArtistUserId }] : [],
    price_mode: i.priceMinor > 0 ? 'price' : 'request',
    price: i.priceMinor > 0 ? i.priceMinor / 100 : '',
    currency: i.currency,
    availability: listedState,
    medium: i.medium ?? '',
    height_cm: i.heightCm ?? '',
    width_cm: i.widthCm ?? '',
    depth_cm: i.depthCm ?? '',
    unit: 'cm',
    year: i.yearCreated ?? '',
    edition_type: KIND_EDITION[i.kind] ?? 'unique',
    certificateOfAuthenticity: i.certificateOfAuthenticity,
    shows: { store: true, gallery: false },
  };
}

// ── the adapter ─────────────────────────────────────────────────────────────

export function artworkActions(actions: ArtworkActions): FormActions<ArtworkRecordView> {
  const ctxCache = new Map<string, ArtworkContextView>();
  const context = async (orgId: string) => {
    const hit = ctxCache.get(orgId);
    if (hit) return hit;
    const c = await actions.context(orgId);
    ctxCache.set(orgId, c);
    return c;
  };

  return {
    async context(orgId) {
      const c = await context(orgId);
      return { ...c };
    },
    async load(id) {
      const record = await actions.loadArtwork(id);
      if (!record) return null;
      return { answers: artworkAnswers(record), record };
    },
    async save(orgId, answers, intent, id, saveOpts) {
      const c = await context(orgId).catch(() => null);
      const built = artworkInputFromAnswers(answers, c?.defaultCurrency ?? 'CAD');
      if (built.ok === false) return { ok: false, error: built.error };
      const res = await actions.saveArtwork(orgId, built.input, intent, id, { autosave: saveOpts?.autosave === true });
      if (res.ok === false) return res;
      const warnings = [...built.warnings, ...res.value.warnings];
      const stopped = res.value.notPublished;
      return {
        ok: true,
        value: { record: res.value.record, warnings, ...(stopped ? { fieldErrors: { pictures: [stopped] } } : {}) },
      };
    },
    async lastSettings(): Promise<FormPreset | null> {
      if (!actions.listArtworks) return null;
      const list = await actions.listArtworks();
      const latest = [...list].sort((x, y) => Date.parse(y.updatedAt) - Date.parse(x.updatedAt))[0];
      if (!latest) return null;
      const r = await actions.loadArtwork(latest.id);
      if (!r) return null;
      return presetFromAnswers('artwork', artworkAnswers(r), 'Your last piece’s settings');
    },
  };
}
