// ============================================================================
// Artwork rules, with the README §7 copy. The client runs these; commerce
// stays the authority (createArtwork / updateArtwork / publishArtwork,
// packages/commerce/src/server/index.ts).
//
//   design   a title; at least one picture; a price unless it is On request (block)
//   mirrors  publishArtwork refuses a piece with no image (server/index.ts:1334);
//            a 0 price is "price on request" (:1319-1321), so Price mode needs
//            more than 0; the currency is CAD | USD | EUR | GBP (types/index.ts:9;
//            the adapter refuses another); the store gate: requireActiveStore
//            (:1014, :1016) and canActForStore (:1058) refuse a person with no
//            approved store (ctx.fields.canEdit false, its reason shown under Maker)
//
// Since commerce 7d6540c0 (editions sell every copy):
//   artwork.edition-size   an edition's size is a whole number ≥ 1 (editionTotal,
//                          positiveInt, server/index.ts:1088-1090, :1170)
//   artwork.stock          copies on hand: a whole number ≥ 0 (inventoryQty)
//   artwork.stock-over     warn: more on hand than the edition has
//   artwork.available-none setArtworkAvailability refuses 'available' with nothing
//                          to sell (server/index.ts:1438-1442); the form sees stock,
//                          not held copies, so the server still has the last word
//
// Not here, with their fields deferred (kinds/artwork/schema.ts): proofs (no
// column) and the variants' numbers (one Default variant, :1097).
// ============================================================================

import type { Answers, FormRule } from '../contract';
import { num, text, trimmed } from './answers';

export const ARTWORK_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const;

/** How many pictures the answer holds: objects with a url (or src), or URL strings, as PicturesField reads them. */
export function pictureCount(a: Answers): number {
  const v = a.pictures;
  if (!Array.isArray(v)) return 0;
  return v.filter((p) => {
    if (typeof p === 'string') return p.trim() !== '';
    if (p && typeof p === 'object') {
      const o = p as { url?: unknown; src?: unknown };
      return (typeof o.url === 'string' && o.url !== '') || (typeof o.src === 'string' && o.src !== '');
    }
    return false;
  }).length;
}

/** 'price' | 'request': what the price seg holds ('nfs' is deferred and reads as Price). */
export function priceMode(a: Answers): 'price' | 'request' {
  return text(a.price_mode) === 'request' ? 'request' : 'price';
}

export type EditionType = 'unique' | 'edition' | 'open';

export function editionType(a: Answers): EditionType {
  const t = text(a.edition_type);
  return t === 'edition' || t === 'open' ? t : 'unique';
}

function wholeOrNull(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** edition_size as a whole number, or null (empty or not whole). */
export function editionSize(a: Answers): number | null {
  return wholeOrNull(a.edition_size);
}

/** stock (copies on hand) as a whole number, or null. */
export function stockOf(a: Answers): number | null {
  return wholeOrNull(a.stock);
}

/** The piece is listed (commerce available, reserved or sold): set on load by the adapter. */
export function isListed(a: Answers): boolean {
  return a['forms.listed'] === true;
}

/**
 * Copies on hand are asked for an edition and an open edition. A one-of-a-kind
 * piece has one; it is asked only when it has none left (sold, or loaded at 0),
 * so it can be put back on sale.
 */
export function stockDrawn(a: Answers): boolean {
  const t = editionType(a);
  return t !== 'unique' || stockOf(a) === 0;
}

export type Availability = 'available' | 'reserved' | 'sold';

export function availabilityOf(a: Answers): Availability {
  const v = text(a.availability);
  return v === 'reserved' || v === 'sold' ? v : 'available';
}

export const ARTWORK_RULES: FormRule[] = [
  {
    id: 'artwork.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => !trimmed(a.title),
    message: 'Give the piece a title.',
    short: 'Title: missing',
  },
  {
    id: 'artwork.pictures',
    severity: 'block',
    fields: ['pictures'],
    section: 'pictures',
    test: (a) => pictureCount(a) === 0,
    message: 'Add at least one picture. The first is the one on cards.',
    short: 'Pictures: none yet',
  },
  {
    id: 'artwork.price',
    severity: 'block',
    fields: ['price'],
    section: 'price',
    test: (a) => {
      if (priceMode(a) === 'request') return false;
      const n = num(a.price);
      return n === null || n <= 0;
    },
    message: 'Add the price, or choose On request.',
    short: 'Price: missing',
  },
  {
    id: 'artwork.currency',
    severity: 'block',
    fields: ['currency'],
    section: 'price',
    test: (a) => {
      if (priceMode(a) === 'request') return false;
      const c = text(a.currency).toUpperCase();
      return c !== '' && !(ARTWORK_CURRENCIES as readonly string[]).includes(c);
    },
    message: 'The store takes Canadian or US dollars, euros or pounds. Pick one of those.',
    short: 'Price: the currency',
  },
  {
    id: 'artwork.edition-size',
    severity: 'block',
    fields: ['edition_size'],
    section: 'edition',
    test: (a) => {
      if (editionType(a) !== 'edition') return false;
      const n = editionSize(a);
      return n === null || n < 1;
    },
    message: 'Say how many there are in the edition: a whole number, 1 or more.',
    short: 'Edition: the size',
  },
  {
    id: 'artwork.stock',
    severity: 'block',
    fields: ['stock'],
    section: 'edition',
    test: (a) => {
      if (!stockDrawn(a)) return false;
      const n = stockOf(a);
      return n === null || n < 0;
    },
    message: 'Say how many copies are on hand: a whole number, 0 or more.',
    short: 'Edition: copies on hand',
  },
  {
    id: 'artwork.stock-over',
    severity: 'warn',
    fields: ['stock', 'edition_size'],
    section: 'edition',
    test: (a) => {
      if (editionType(a) !== 'edition') return false;
      const stock = stockOf(a);
      const size = editionSize(a);
      return stock !== null && size !== null && size >= 1 && stock > size;
    },
    message: 'There are more copies on hand than the edition has.',
    short: 'Edition: more on hand than the edition',
  },
  {
    id: 'artwork.available-none',
    severity: 'block',
    fields: ['availability'],
    section: 'availability',
    test: (a) => isListed(a) && availabilityOf(a) === 'available' && stockOf(a) === 0,
    message: 'Raise the copies on hand before putting it back on sale.',
    short: 'Availability: none left to sell',
  },
  {
    id: 'artwork.store',
    severity: 'block',
    fields: [],
    section: 'maker',
    test: (_a, ctx) => ctx.fields.canEdit === false,
    message: 'You can list work here once you have an approved store.',
    short: 'Maker: no store to list it in',
  },
];
