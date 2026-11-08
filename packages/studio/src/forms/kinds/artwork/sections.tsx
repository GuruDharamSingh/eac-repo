'use client';

// ============================================================================
// Artwork's sections (soft tissue, pass 2): Pictures, Maker, Price, Details,
// Edition, with the closed-row summaries. Design: README §5, 1f, 1p.
//
// Keys are PLAN §12's, saved by forms/adapters/artwork.ts (Ligament) through
// commerce createArtwork / updateArtwork / setArtworkMedia:
//   pictures      → images[] {url, alt}; the first is the card picture
//   credits       → credits[0] artist with a userId = creditedArtistUserId (named,
//                   not paid), unless it is the seller, who is the artist already
//   price_mode    'price' | 'request' ('request' = price 0, "price on request",
//                   commerce/src/server/index.ts:1279-1281)
//   price, currency, medium, height_cm, width_cm, depth_cm, unit ('in' → cm), year,
//   edition_type  → kind original / limited_edition / open_edition
//   description   → descriptionHtml
// Every control is the shell's, through field(); what is here is layout and copy.
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { ARTWORK_CURRENCIES, priceMode } from '../../rules/artwork';
import { clip, num, plainText, text } from '../../rules/answers';
import { Cell, Hint, Row, Stack, Words, type Person } from '../post/parts';

// ── context ──────────────────────────────────────────────────────────────────

/** Who may be credited as the artist (adapters/artwork.ts context: in pass 2 the viewer only). */
export function makerCandidatesOf(ctx: FormContext): Person[] {
  const v = ctx.fields.makerCandidates;
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object' && typeof (x as Person).userId === 'string') as Person[]) : [];
}

function currenciesOf(ctx: FormContext): string[] {
  const v = ctx.fields.currencies;
  const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[A-Z]{3}$/.test(x)) : [];
  return list.length ? list : [...ARTWORK_CURRENCIES];
}

const SYMBOL: Record<string, string> = { CAD: '$', USD: '$', EUR: '€', GBP: '£' };

export function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

// ── Pictures ─────────────────────────────────────────────────────────────────

export function ArtworkPictures({ field }: SectionProps) {
  // The design's hint sits beside the section heading (the section's summary).
  // No focal point: commerce keeps a picture's url and alt only (ArtworkMediaInput,
  // commerce/src/types/index.ts:218-224), so it is not offered (deferred: pictures.focal).
  return field('pictures', { control: 'pictures', label: 'Pictures', hideLabel: true, pictures: { aspect: '4 / 5', firstTag: 'On cards', focal: false } });
}

export const PICTURES_HINT = 'Drag to reorder. The first is the one on cards.';

// ── Maker ────────────────────────────────────────────────────────────────────

/**
 * The artist. In pass 2 a piece lists in the signed-in person's own store, so
 * the maker is them (makerCandidates holds only the viewer) and this is a fixed
 * line; a select appears only where the context offers other people (credited,
 * not paid). Other roles ("Printed by") and names without an account are not
 * stored (deferred: credits.roles).
 */
export function ArtworkMaker({ answers: a, patch, ctx, field }: SectionProps) {
  const viewerId = text(ctx.fields.viewerId);
  const viewerName = text(ctx.fields.viewerName);
  const store = text(ctx.fields.storeName);
  const reason = text(ctx.fields.reason);
  const people = makerCandidatesOf(ctx);
  const credits = Array.isArray(a.credits) ? (a.credits as Array<{ role?: unknown; userId?: unknown }>) : [];
  const artistId = text(credits.find((c) => c && c.role === 'artist')?.userId) || viewerId;

  if (ctx.fields.canEdit === false) {
    // requireActiveStore / canActForStore (commerce/src/server/index.ts:1000, :1002, :1044).
    return <Hint>{reason || 'A piece belongs to a store, and you don’t have an approved one here yet.'}</Hint>;
  }

  const others = people.filter((p) => p.userId !== viewerId);
  if (!others.length) {
    return (
      <Stack gap={6}>
        <p style={{ margin: 0, fontSize: 14 }}>
          <span style={{ color: 'var(--frm-muted)' }}>Artist </span>
          {viewerName || 'You'}
          {viewerName ? <span style={{ color: 'var(--frm-muted)' }}> (you)</span> : null}
        </p>
        <Hint>{store ? `It goes into your store, ${store}.` : 'It goes into your store.'}</Hint>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      {field('forms.artist', {
        input: 'select',
        label: 'Artist',
        options: people.map((p) => ({ value: p.userId, label: p.userId === viewerId ? `${p.displayName} (you)` : p.displayName })),
        value: artistId,
        onChange: (v) => patch({ credits: [{ role: 'artist', userId: text(v) || viewerId }] }),
      })}
      <Hint>{artistId && artistId !== viewerId ? 'Named as the artist. The sale is paid to your store.' : store ? `It goes into your store, ${store}.` : 'It goes into your store.'}</Hint>
    </Stack>
  );
}

// ── Price ────────────────────────────────────────────────────────────────────

export function ArtworkPrice({ answers: a, ctx, patch, field }: SectionProps) {
  const mode = priceMode(a);
  const currency = (text(a.currency) || text(ctx.fields.defaultCurrency) || 'CAD').toUpperCase();
  const list = currenciesOf(ctx);
  const options = list.map((c) => ({ value: c, label: c }));
  if (!list.includes(currency)) options.push({ value: currency, label: currency });
  const price = num(a.price);
  return (
    <Stack gap={10}>
      {field('price_mode', {
        input: 'radio',
        label: 'Price',
        hideLabel: true,
        options: [
          { value: 'price', label: 'Price' },
          { value: 'request', label: 'On request' },
        ],
        value: mode,
        onChange: (v) => patch({ price_mode: v === 'request' ? 'request' : 'price' }),
      })}
      {mode === 'price' ? (
        <>
          <Row name="artwork-price" gap={10} align="center">
            <Cell flex="0 0 150px">
              {field('price', { input: 'number', label: 'Price', hideLabel: true, min: 0, step: 'any', prefix: SYMBOL[currency] ?? '', placeholder: '180' })}
            </Cell>
            <Cell flex="0 0 110px">{field('currency', { input: 'select', label: 'Currency', hideLabel: true, options })}</Cell>
          </Row>
          <Hint>{price !== null && price > 0 ? `The card reads “${money(price, currency)}”.` : 'What it sells for.'}</Hint>
        </>
      ) : (
        // A 0 price: shown, can't go in a cart, buyers pointed to message the artist (server/index.ts:1279-1281).
        <Hint>The page shows “Price on request” and points buyers to message you. It can’t be added to a cart.</Hint>
      )}
    </Stack>
  );
}

export function priceLine(a: Answers, ctx: FormContext): string {
  if (priceMode(a) === 'request') return 'Price on request';
  const n = num(a.price);
  const currency = (text(a.currency) || text(ctx.fields.defaultCurrency) || 'CAD').toUpperCase();
  return n !== null && n > 0 ? money(n, currency) : 'No price yet';
}

// ── Details ──────────────────────────────────────────────────────────────────

export function ArtworkDetails({ answers: a, ctx, field }: SectionProps) {
  const unit = text(a.unit) === 'in' ? 'in' : 'cm';
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: ctx.timeZone || 'UTC', year: 'numeric' }).format(ctx.now);
  const dim = (name: string, label: string, placeholder: string) => (
    <Cell flex="1 1 70px">{field(name, { input: 'number', label, hideLabel: true, min: 0, step: 'any', placeholder })}</Cell>
  );
  return (
    <Stack gap={16}>
      {field('medium', { input: 'text', label: 'Medium', size: 'sub', placeholder: 'Oil on linen, bronze, etching on paper…' })}
      <Row name="artwork-size" gap={14} align="flex-end">
        <Cell flex="1 1 220px">
          <Stack gap={6}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Size</span>
            <Row name="artwork-dims" gap={6} align="center">
              {dim('height_cm', `Height, in ${unit}`, 'Height')}
              <Words>×</Words>
              {dim('width_cm', `Width, in ${unit}`, 'Width')}
              <Words>×</Words>
              {dim('depth_cm', `Depth, in ${unit} (optional)`, 'depth')}
            </Row>
          </Stack>
        </Cell>
        <Cell flex="0 0 auto">
          {field('unit', {
            input: 'radio',
            label: 'Unit',
            hideLabel: true,
            options: [
              { value: 'cm', label: 'cm' },
              { value: 'in', label: 'in' },
            ],
          })}
        </Cell>
        <Cell flex="0 0 90px">{field('year', { input: 'number', label: 'Year', size: 'sub', min: 0, max: 9999, step: 1, placeholder: year })}</Cell>
      </Row>
      {/* The gallery hangs work at true scale from these numbers (ArtPieceComposer); inches are stored as cm. */}
      <Hint>{unit === 'in' ? 'Kept in centimetres; inches are converted when you save.' : 'Height × width, and depth for anything that stands out from the wall.'}</Hint>
    </Stack>
  );
}

/** The medium's first part: "Etching and aquatint on Hahnemühle" → "Etching" (the design's "Etching · 40 × 50 cm · 2026"). */
export function mediumShort(medium: string): string {
  const m = medium.trim();
  if (!m) return '';
  return (m.split(/,| and | on | with /i)[0] ?? m).trim();
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** "Etching · 40 × 50 cm · 2026". */
export function detailsSummary(a: Answers): string {
  const unit = text(a.unit) === 'in' ? 'in' : 'cm';
  const h = num(a.height_cm);
  const w = num(a.width_cm);
  const d = num(a.depth_cm);
  const dims = [h, w, d].filter((x): x is number => x !== null && x > 0);
  const size = h !== null && w !== null && h > 0 && w > 0 ? `${dims.map(fmtNum).join(' × ')} ${unit}` : '';
  const year = num(a.year);
  const parts = [mediumShort(text(a.medium)), size, year !== null && year > 0 ? String(year) : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Medium, size and year';
}

// ── Edition ──────────────────────────────────────────────────────────────────

const EDITION_TYPES = [
  { value: 'unique', label: 'One of a kind' },
  { value: 'edition', label: 'Edition' },
  { value: 'open', label: 'Open' },
];

/**
 * One of a kind | Edition | Open → commerce `kind`. The size ("of 25 + 3 proofs")
 * and the variants are not drawn: edition_total is never written and there is
 * one Default variant (deferred: edition.size, variants). Copy says what a buyer
 * meets today: the store sells one copy, then the piece shows as sold
 * (commerce/src/server/orders.ts:325, :666).
 */
export function ArtworkEdition({ answers: a, field }: SectionProps) {
  const type = text(a.edition_type) || 'unique';
  return (
    <Stack gap={8}>
      {field('edition_type', { input: 'radio', label: 'Edition', hideLabel: true, options: EDITION_TYPES })}
      <Hint>
        {type === 'unique'
          ? 'One of one.'
          : 'Say the edition size in the description. For now the store sells one copy, then shows the piece as sold.'}
      </Hint>
    </Stack>
  );
}

export function editionSummary(a: Answers): string {
  const type = text(a.edition_type) || 'unique';
  return type === 'edition' ? 'A limited edition' : type === 'open' ? 'An open edition' : 'One of a kind';
}

// ── Description ──────────────────────────────────────────────────────────────

export function descriptionSummary(a: Answers): string {
  const t = plainText(a.description);
  return t ? clip(t) : 'None yet';
}
