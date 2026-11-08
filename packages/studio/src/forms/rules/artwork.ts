// ============================================================================
// Artwork rules, with the README §7 copy. The client runs these; commerce
// stays the authority (createArtwork / updateArtwork / publishArtwork,
// packages/commerce/src/server/index.ts).
//
//   design   a title; at least one picture; a price unless it is On request (block)
//   mirrors  publishArtwork refuses a piece with no image (server/index.ts:1293);
//            a 0 price is "price on request" (:1279-1281), so Price mode needs
//            more than 0; the currency is CAD | USD | EUR | GBP (types/index.ts:9;
//            the adapter refuses another); the store gate: requireActiveStore
//            (:1000, :1002) and canActForStore (:1044) refuse a person with no
//            approved store (ctx.fields.canEdit false, its reason shown under Maker)
//
// Not here, with their fields deferred (kinds/artwork/schema.ts): the edition
// size (edition_total is never written, :1072-1081) and the variants' numbers
// (one Default variant, :1077).
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
    id: 'artwork.store',
    severity: 'block',
    fields: [],
    section: 'maker',
    test: (_a, ctx) => ctx.fields.canEdit === false,
    message: 'You can list work here once you have an approved store.',
    short: 'Maker: no store to list it in',
  },
];
