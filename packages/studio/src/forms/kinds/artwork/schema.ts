// ============================================================================
// Artwork (code kind `artwork`), pass 2, soft tissue. Design: README §5, 1f, 1p;
// Publish Form.dc.html renderVals() (rail lists, default open). Reference:
// cms-ui compose/ArtPieceComposer.tsx (the marketplace's own vocabulary).
//
//   Essentials  Pictures · Title · Maker · Price · Availability
//   More        Details (open) · Edition (open) · Description
//
// content-fields has no artwork list (state.ts contentKindOf → null), so the
// kind supplies its own specs (FormKindSchema.specs, c59dcee7). Saved by
// forms/adapters/artwork.ts (Ligament) through commerce createArtwork /
// updateArtwork / setArtworkMedia / setArtworkAvailability; the store and the
// seller are the signed-in person's.
//
// Since commerce 7d6540c0 (editions sell every copy) the edition size, the
// copies on hand and Availability are drawn. Show only what works (owner
// ruling 7): Not for sale, the Ask button, other credits, the focal point,
// proofs, the variants grid and Where it shows have no commerce path yet. They
// are in `deferred` with the code that shows why, and are not drawn.
// ============================================================================

import type { ContentFieldSpec } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema, KindLayout } from '../../contract';
import { ARTWORK_RULES } from '../../rules/artwork';
import { text } from '../../rules/answers';
import {
  ArtworkAvailability,
  ArtworkDetails,
  ArtworkEdition,
  ArtworkMaker,
  ArtworkPictures,
  ArtworkPrice,
  PICTURES_HINT,
  descriptionSummary,
  detailsSummary,
  editionSummary,
} from './sections';

/** The fields the shell draws for artwork by name (content-fields declares none). */
export const ARTWORK_SPECS: Record<string, ContentFieldSpec> = {
  title: { name: 'title', label: 'Title', input: 'text', required: true, quick: true, placeholder: 'Title of the piece' },
  pictures: { name: 'pictures', label: 'Pictures', input: 'custom', required: true, quick: true },
  price_mode: { name: 'price_mode', label: 'Price', input: 'radio', quick: true, options: [{ value: 'price', label: 'Price' }, { value: 'request', label: 'On request' }] },
  price: { name: 'price', label: 'Price', input: 'number', min: 0, quick: true },
  currency: { name: 'currency', label: 'Currency', input: 'select', options: ['CAD', 'USD', 'EUR', 'GBP'].map((c) => ({ value: c, label: c })) },
  medium: { name: 'medium', label: 'Medium', input: 'text' },
  height_cm: { name: 'height_cm', label: 'Height', input: 'number', min: 0 },
  width_cm: { name: 'width_cm', label: 'Width', input: 'number', min: 0 },
  depth_cm: { name: 'depth_cm', label: 'Depth', input: 'number', min: 0 },
  unit: { name: 'unit', label: 'Unit', input: 'radio', options: [{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }] },
  year: { name: 'year', label: 'Year', input: 'number', min: 0 },
  edition_type: { name: 'edition_type', label: 'Edition', input: 'radio', options: [{ value: 'unique', label: 'One of a kind' }, { value: 'edition', label: 'Edition' }, { value: 'open', label: 'Open' }] },
  edition_size: { name: 'edition_size', label: 'Edition of', input: 'number', min: 1, step: 1 },
  stock: { name: 'stock', label: 'Copies on hand', input: 'number', min: 0, step: 1 },
  availability: { name: 'availability', label: 'Availability', input: 'radio', options: [{ value: 'available', label: 'Available' }, { value: 'reserved', label: 'Reserved' }, { value: 'sold', label: 'Sold' }] },
  description: { name: 'description', label: 'Description', input: 'richtext', placeholder: 'The story of the piece, how it was made, how to care for it.' },
};

/** A blank piece: the seller as its artist, priced in the store's currency, one of a kind, in cm. */
export function emptyArtworkAnswers(ctx: FormContext): Answers {
  const viewerId = text(ctx.fields.viewerId);
  return {
    title: '',
    pictures: [],
    credits: viewerId ? [{ role: 'artist', userId: viewerId }] : [],
    price_mode: 'price',
    price: undefined,
    currency: (text(ctx.fields.defaultCurrency) || 'CAD').toUpperCase(),
    medium: '',
    height_cm: undefined,
    width_cm: undefined,
    depth_cm: undefined,
    unit: 'cm',
    year: undefined,
    edition_type: 'unique',
    // An edition's size, and its copies on hand (filled from the size on a new piece).
    edition_size: undefined,
    stock: undefined,
    // What publishing sets; changed once it is listed.
    availability: 'available',
    description: '',
  };
}

export const ARTWORK_LAYOUT: KindLayout = {
  // The description is the toolbar editor (README §5 "Description"); the contract names the key `body`, the answer is `description`.
  body: { section: 'description', field: 'body', editor: 'toolbar' },
  rows: [
    { section: 'price', row: 'artwork-price', cells: { price: '0 0 150px', currency: '0 0 110px' } },
    // "Edition of [25]  Copies on hand [18]": side by side, both narrow, so they keep a line at 390px.
    { section: 'edition', row: 'artwork-edition', cells: { edition_size: '0 0 110px', stock: '0 0 110px' } },
    // 390px: the three sizes keep a line; cm | in and the year drop under them.
    { section: 'details', row: 'artwork-size', cells: { unit: '0 0 auto', year: '0 0 90px' } },
    { section: 'details', row: 'artwork-dims', cells: { height_cm: '1 1 70px', width_cm: '1 1 70px', depth_cm: '1 1 70px' } },
  ],
};

export const artworkKind: FormKindSchema & { layout: KindLayout } = {
  id: 'artwork',
  label: () => 'New artwork',
  codeKind: () => 'artwork',
  specs: ARTWORK_SPECS,
  sections: [
    // ── Essentials (the design's rail order: the pictures first) ──
    {
      id: 'pictures',
      label: 'Pictures',
      tier: 'essentials',
      fields: ['pictures'],
      render: 'artworkPictures',
      // Beside the heading, as the design prints it.
      summary: () => PICTURES_HINT,
      quick: true,
    },
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    {
      id: 'maker',
      label: 'Maker',
      tier: 'essentials',
      fields: ['credits'],
      render: 'artworkMaker',
      // The seller is the artist until someone else is chosen.
      done: (_a, ctx) => ctx.fields.canEdit !== false,
    },
    { id: 'price', label: 'Price', tier: 'essentials', fields: ['price_mode', 'price', 'currency'], render: 'artworkPrice', quick: true },
    {
      // setArtworkAvailability, on a listed piece only (commerce/src/server/index.ts:1417-1447); drawn disabled on a draft.
      id: 'availability',
      label: 'Availability',
      tier: 'essentials',
      fields: ['availability'],
      render: 'artworkAvailability',
      done: () => true,
    },
    // ── More ──
    {
      id: 'details',
      label: 'Details',
      tier: 'more',
      fields: ['medium', 'height_cm', 'width_cm', 'depth_cm', 'year'],
      render: 'artworkDetails',
      summary: (a) => detailsSummary(a),
    },
    {
      id: 'edition',
      label: 'Edition',
      tier: 'more',
      fields: ['edition_type', 'edition_size', 'stock'],
      render: 'artworkEdition',
      summary: (a) => editionSummary(a),
      done: () => true,
    },
    { id: 'description', label: 'Description', tier: 'more', fields: ['description'], summary: (a) => descriptionSummary(a) },
  ],
  components: {
    artworkPictures: ArtworkPictures,
    artworkMaker: ArtworkMaker,
    artworkPrice: ArtworkPrice,
    artworkAvailability: ArtworkAvailability,
    artworkDetails: ArtworkDetails,
    artworkEdition: ArtworkEdition,
  },
  rules: ARTWORK_RULES,
  // README "Interactions": Artwork opens Details, and Edition and variants.
  defaultOpen: () => ['details', 'edition'],
  empty: emptyArtworkAnswers,
  deferred: [
    {
      id: 'price.nfs',
      label: 'Not for sale',
      reason: 'ArtworkStatus has no such state (packages/commerce/src/types/index.ts:19-24), and a 0 price means "price on request" (commerce/src/server/index.ts:1319-1321).',
      pass: 4,
    },
    {
      id: 'price.inquiries',
      label: 'An Ask button that emails you',
      reason:
        'Commerce has no inquiry write path, only the table (packages/db/migrations/042_commerce_and_auction.sql:294); a price on request points buyers at messaging the artist (commerce/src/server/index.ts:1319-1321), which is what the hint says.',
      pass: 4,
    },
    {
      id: 'credits.roles',
      label: 'Another credit ("Printed by"), a name without an account',
      reason:
        'A piece stores one credited artist by account, creditedArtistUserId (packages/commerce/src/types/index.ts:242, :298); other roles and typed names have no column. In pass 2 the maker is the seller (makerCandidates holds the viewer only).',
      pass: 4,
    },
    {
      id: 'pictures.focal',
      label: 'Focal point',
      reason: 'A picture is url, Nextcloud ids, alt and role (ArtworkMediaInput, packages/commerce/src/types/index.ts:218-224): there is no focal column. Alt text is kept.',
      pass: 4,
    },
    {
      id: 'edition.proofs',
      label: '+ [3] proofs',
      reason:
        'Proofs have no column: a variant has an edition number and total but no proofs (ArtworkVariant, packages/commerce/src/types/index.ts:422-437). The edition size itself is drawn (editionTotal, commerce/src/server/index.ts:1088-1098).',
      pass: 4,
    },
    {
      id: 'variants',
      label: 'Variants (Unframed sheet, Framed in oak)',
      reason: 'A piece has one Default variant (createArtwork, packages/commerce/src/server/index.ts:1097) and updateArtwork edits the first only (:1194).',
      pass: 4,
    },
    {
      id: 'shows',
      label: 'Where it shows (Store, Gallery on your profile)',
      reason:
        'Listing in the store is the publish itself, and there is no per-piece gallery flag: the profile shows a person’s store section as a whole (hasProfileSection, packages/commerce/src/queries/index.ts:940).',
      pass: 4,
    },
  ],
  layout: ARTWORK_LAYOUT,
};
