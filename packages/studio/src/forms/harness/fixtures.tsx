'use client';

// ============================================================================
// Harness fixtures (Tendons, pass 2): stand-in kinds for Artwork and Offering,
// so the pass 2 joints (GridRows, PicturesField, CreditRows, the artwork and
// offering previews) can be drawn before soft tissue's kinds land. Harness
// only: never exported from ./forms. When kinds/{artwork,service} land,
// pages.ts switches to them and these go. (Series uses soft tissue's own
// gathering kind and GATHERING_SERIES_SAMPLE since c77d0526.)
//
// They draw every control through SectionProps.field(), the way a kind does,
// and use GridRows for the lists, so they also show how a kind holds the joints.
// Sample content is made up (README "Sample content").
// ============================================================================

import * as React from 'react';
import { emptyContentAnswers, type ContentFieldContext, type ContentFieldSpec } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema, FormRule, SectionProps } from '../contract';
import { GridRows, type GridRow } from '../fields/GridRows';
import { artworkLines, editionLine, shortMedium, sizeLine } from '../preview/kind-lines';
import { GATHERING_SAMPLE_CONTEXT } from '../kinds/gathering';
import { Cell, Hint, Row, Stack, Words } from '../kinds/post/parts';
import { SAMPLE_NOW, SAMPLE_PICTURE } from '../kinds/post';
import { text } from '../rules/answers';
import { Icon } from '../theme/context';

// ── Artwork (1f, 1p) ────────────────────────────────────────────────────────

function dotPicture(fill: string, w: number, h: number): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><pattern id='d' width='4' height='4' patternUnits='userSpaceOnUse'><circle cx='2' cy='2' r='1.2' fill='#201e1d' fill-opacity='0.2'/></pattern></defs><rect width='100%' height='100%' fill='${fill}'/><rect width='100%' height='100%' fill='url(#d)'/></svg>`
    )
  );
}

const ART_SPECS: Record<string, ContentFieldSpec> = {
  title: { name: 'title', label: 'Title', input: 'text', required: true, placeholder: 'Title of the piece' },
  pictures: { name: 'pictures', label: 'Pictures', input: 'custom', required: true },
  credits: { name: 'credits', label: 'Maker and credits', input: 'custom' },
  price_mode: {
    name: 'price_mode',
    label: 'Price',
    input: 'radio',
    options: [
      { value: 'price', label: 'Price' },
      { value: 'request', label: 'On request' },
      { value: 'nfs', label: 'Not for sale' },
    ],
  },
  price: { name: 'price', label: 'Price', input: 'number', min: 0, step: 'any' },
  availability: {
    name: 'availability',
    label: 'Availability',
    input: 'radio',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'reserved', label: 'Reserved' },
      { value: 'sold', label: 'Sold' },
    ],
  },
  medium: { name: 'medium', label: 'Medium', input: 'text', placeholder: 'Etching on paper' },
  height_cm: { name: 'height_cm', label: 'Height', input: 'number', min: 0, step: 'any', placeholder: 'H' },
  width_cm: { name: 'width_cm', label: 'Width', input: 'number', min: 0, step: 'any', placeholder: 'W' },
  depth_cm: { name: 'depth_cm', label: 'Depth', input: 'number', min: 0, step: 'any', placeholder: 'depth' },
  unit: {
    name: 'unit',
    label: 'Unit',
    input: 'radio',
    options: [
      { value: 'cm', label: 'cm' },
      { value: 'in', label: 'in' },
    ],
  },
  year: { name: 'year', label: 'Year', input: 'number', min: 1000, max: 3000 },
  edition_type: {
    name: 'edition_type',
    label: 'Edition',
    input: 'radio',
    options: [
      { value: 'unique', label: 'One of a kind' },
      { value: 'edition', label: 'Edition' },
      { value: 'open', label: 'Open' },
    ],
  },
  edition_size: { name: 'edition_size', label: 'Edition size', input: 'number', min: 1 },
  edition_proofs: { name: 'edition_proofs', label: 'Proofs', input: 'number', min: 0 },
  description: { name: 'description', label: 'Description', input: 'richtext', placeholder: 'The story of the piece, how it was made, how to care for it.' },
};

function variantsOf(a: Answers): Array<{ name: string; price: number | null; stock: number | null }> {
  const v = a.variants;
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    const o = (x && typeof x === 'object' ? x : {}) as { name?: unknown; price?: unknown; stock?: unknown };
    return {
      name: typeof o.name === 'string' ? o.name : '',
      price: typeof o.price === 'number' ? o.price : null,
      stock: typeof o.stock === 'number' ? o.stock : null,
    };
  });
}

function ArtPrice({ answers: a, field }: SectionProps) {
  const mode = a.price_mode === 'request' ? 'request' : a.price_mode === 'nfs' ? 'nfs' : 'price';
  const card = artworkLines(a).price;
  const cur = typeof a.currency === 'string' && a.currency ? a.currency : 'CAD';
  return (
    <Stack gap={8}>
      {field('price_mode', { label: 'Price', hideLabel: true })}
      {mode === 'price' && (
        <>
          <Row name="art-price" align="center">
            <Cell flex="0 0 150px">{field('price', { label: 'Price', hideLabel: true, prefix: '$', width: 150 })}</Cell>
            <Words>{cur}</Words>
          </Row>
          <Hint>{variantsOf(a).length ? `Variants below set their own prices. The card reads “${card}”.` : `The card reads “${card}”.`}</Hint>
        </>
      )}
      {mode === 'request' && <Hint>The page shows “Price on request” and an Ask button that emails you.</Hint>}
      {mode === 'nfs' && <Hint>Shown in the gallery with no price and no button.</Hint>}
    </Stack>
  );
}

function ArtAvailability({ answers: a, field }: SectionProps) {
  const size = typeof a.edition_size === 'number' ? a.edition_size : null;
  const left = variantsOf(a).reduce((n, v) => n + (v.stock ?? 0), 0);
  const hint =
    a.edition_type === 'edition' && size
      ? `${Math.min(left, size)} of ${size} left. Turns to Sold by itself when the last one goes.`
      : a.edition_type === 'unique'
        ? 'One piece. Turns to Sold by itself when it sells.'
        : 'Turns to Sold by itself when the stock runs out.';
  return (
    <Stack gap={8}>
      {field('availability', { label: 'Availability', hideLabel: true })}
      <Hint>{hint}</Hint>
    </Stack>
  );
}

function ArtDetails({ field }: SectionProps) {
  return (
    <Stack gap={16}>
      {field('medium', { size: 'sub' })}
      <Row name="art-size" align="flex-end" gap={14}>
        <Cell flex="1 1 220px">
          <div className="frm-field" data-size="sub" role="group" aria-labelledby="frm-fx-size">
            <span className="frm-label" id="frm-fx-size">
              Size
            </span>
            <Row name="art-size-hwd" align="center" gap={6}>
              <Cell flex="1 1 0">{field('height_cm', { hideLabel: true })}</Cell>
              <Words>×</Words>
              <Cell flex="1 1 0">{field('width_cm', { hideLabel: true })}</Cell>
              <Words>×</Words>
              <Cell flex="1 1 0">{field('depth_cm', { hideLabel: true })}</Cell>
            </Row>
          </div>
        </Cell>
        <Cell flex="0 0 auto">{field('unit', { hideLabel: true })}</Cell>
        <Cell flex="0 0 90px">{field('year', { size: 'sub' })}</Cell>
      </Row>
    </Stack>
  );
}

function ArtEdition({ answers: a, patch, field }: SectionProps) {
  const variants = variantsOf(a);
  const addRef = React.useRef<HTMLButtonElement>(null);
  const setVariant = (i: number, change: Partial<{ name: string; price: number | null; stock: number | null }>) =>
    patch({ variants: variants.map((v, j) => (j === i ? { ...v, ...change } : v)) });
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const rows: GridRow[] = variants.map((v, i) => ({
    key: String(i),
    cells: {
      name: field(`variants.${i}.name`, {
        input: 'text',
        label: `Variant ${i + 1}, name`,
        hideLabel: true,
        placeholder: 'Unframed sheet',
        value: v.name,
        onChange: (x) => setVariant(i, { name: text(x) }),
      }),
      price: field(`variants.${i}.price`, {
        input: 'number',
        label: `Variant ${i + 1}, price`,
        hideLabel: true,
        prefix: '$',
        value: v.price ?? '',
        onChange: (x) => setVariant(i, { price: num(x) }),
      }),
      stock: field(`variants.${i}.stock`, {
        input: 'number',
        label: `Variant ${i + 1}, in stock`,
        hideLabel: true,
        min: 0,
        value: v.stock ?? '',
        onChange: (x) => setVariant(i, { stock: num(x) }),
      }),
    },
    action: { icon: 'close', label: `Remove ${v.name || `variant ${i + 1}`}`, onClick: () => patch({ variants: variants.filter((_, j) => j !== i) }) },
  }));
  return (
    <Stack gap={16}>
      <Row name="art-edition" align="center" gap={12}>
        <Cell flex="0 1 auto">{field('edition_type', { hideLabel: true })}</Cell>
        {a.edition_type === 'edition' && (
          <>
            <Words>of</Words>
            <Cell flex="0 0 64px">{field('edition_size', { hideLabel: true })}</Cell>
            <Words>+</Words>
            <Cell flex="0 0 52px">{field('edition_proofs', { hideLabel: true })}</Cell>
            <Words>proofs</Words>
          </>
        )}
      </Row>
      <GridRows
        id="frm-f-variants"
        label="Variants"
        columns={[
          { id: 'name', label: 'Variant' },
          { id: 'price', label: 'Price', narrow: 'stack' },
          { id: 'stock', label: 'In stock', narrow: 'stack' },
        ]}
        template="minmax(0,1fr) 84px 64px"
        rows={rows}
        afterRef={addRef}
        empty="No variants: the piece sells at the price above."
      />
      <button ref={addRef} type="button" className="frm-btn frm-btn--ghost" style={{ alignSelf: 'flex-start', marginLeft: -5, fontSize: 13 }} onClick={() => patch({ variants: [...variants, { name: '', price: null, stock: null }] })}>
        <Icon name="plus" size={14} />
        Add a variant
      </button>
    </Stack>
  );
}

function ArtShows({ answers: a, patch, field }: SectionProps) {
  const shows = (a.shows && typeof a.shows === 'object' ? a.shows : {}) as { store?: unknown; gallery?: unknown };
  const set = (k: 'store' | 'gallery', v: unknown) => patch({ shows: { store: shows.store !== false, gallery: shows.gallery !== false, [k]: v === true } });
  return (
    <Stack gap={12}>
      {field('shows.store', { input: 'boolean', label: 'Store', value: shows.store !== false, onChange: (v) => set('store', v) })}
      {field('shows.gallery', { input: 'boolean', label: 'Gallery on your profile', value: shows.gallery !== false, onChange: (v) => set('gallery', v) })}
    </Stack>
  );
}

const ART_RULES: FormRule[] = [
  {
    id: 'artwork.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => !text(a.title),
    message: 'Give the piece a title.',
    short: 'Title: missing',
  },
  {
    id: 'artwork.pictures',
    severity: 'block',
    fields: ['pictures'],
    section: 'pictures',
    test: (a) => !Array.isArray(a.pictures) || a.pictures.length === 0,
    message: 'Add at least one picture. The first is the one on cards.',
    short: 'Pictures: none yet',
  },
  {
    id: 'artwork.price',
    severity: 'block',
    fields: ['price'],
    section: 'price',
    test: (a) => (a.price_mode ?? 'price') === 'price' && typeof a.price !== 'number' && variantsOf(a).every((v) => v.price === null),
    message: 'Add a price, or choose On request or Not for sale.',
    short: 'Price: not set',
  },
];

export const artworkFixtureKind: FormKindSchema = {
  id: 'artwork',
  label: () => 'New artwork',
  codeKind: () => 'artwork',
  specKind: () => null,
  specs: ART_SPECS,
  sections: [
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    { id: 'pictures', label: 'Pictures', tier: 'essentials', fields: ['pictures'], quick: true },
    { id: 'credits', label: 'Maker and credits', tier: 'essentials', fields: ['credits'] },
    { id: 'price', label: 'Price', tier: 'essentials', fields: ['price_mode', 'price'], render: 'artPrice', quick: true },
    { id: 'availability', label: 'Availability', tier: 'essentials', fields: ['availability'], render: 'artAvailability' },
    {
      id: 'details',
      label: 'Details',
      tier: 'more',
      fields: ['medium', 'height_cm', 'width_cm', 'depth_cm', 'unit', 'year'],
      render: 'artDetails',
      summary: (a) => [shortMedium(a.medium).split(' and ')[0], sizeLine(a), text(String(a.year ?? ''))].filter(Boolean).join(' · '),
    },
    {
      id: 'edition',
      label: 'Edition and variants',
      tier: 'more',
      fields: ['edition_type', 'edition_size', 'edition_proofs', 'variants'],
      render: 'artEdition',
      summary: (a) => {
        const n = variantsOf(a).length;
        return [editionLine(a), n ? `${n} ${n === 1 ? 'variant' : 'variants'}` : ''].filter(Boolean).join(' · ');
      },
    },
    { id: 'description', label: 'Description', tier: 'more', fields: ['description'], summary: (a) => (text(a.description) ? 'Written' : 'None yet') },
    {
      id: 'shows',
      label: 'Where it shows',
      tier: 'more',
      fields: ['shows'],
      render: 'artShows',
      summary: (a, ctx) => {
        const s = (a.shows && typeof a.shows === 'object' ? a.shows : {}) as { store?: unknown; gallery?: unknown };
        const where = [s.store !== false ? 'Store' : '', s.gallery !== false ? 'gallery' : ''].filter(Boolean).join(' and ');
        return [where ? where.charAt(0).toUpperCase() + where.slice(1) : 'Nowhere yet', ctx.orgName].join(' · ');
      },
      done: () => true,
    },
  ],
  components: { artPrice: ArtPrice, artAvailability: ArtAvailability, artDetails: ArtDetails, artEdition: ArtEdition, artShows: ArtShows },
  rules: ART_RULES,
  defaultOpen: () => ['details', 'edition'],
  empty: () => ({
    title: '',
    pictures: [],
    credits: [],
    price_mode: 'price',
    price: null,
    currency: 'CAD',
    availability: 'available',
    unit: 'cm',
    edition_type: 'unique',
    variants: [],
    description: '',
    shows: { store: true, gallery: true },
  }),
};

export const ART_CONTEXT: FormContext = {
  orgId: 'sample-eac',
  orgName: 'Elkdonis Arts Collective',
  timeZone: 'America/Toronto',
  now: SAMPLE_NOW,
  fields: {
    hostCandidates: [
      { userId: 'sample-mara', displayName: 'Mara Okafor' },
      { userId: 'sample-teo', displayName: 'Teo Lindqvist' },
    ],
  },
};

/** 1f: "Tidewater, No. 3", an etching in an edition of 25, two variants. */
export const ARTWORK_FIXTURE: Answers = {
  ...artworkFixtureKind.empty(ART_CONTEXT),
  title: 'Tidewater, No. 3',
  pictures: [
    { url: dotPicture('#d7d3d3', 400, 500), alt: 'Tidewater, No. 3: a low estuary under a grey sky, etched in fine lines' },
    { url: dotPicture('#cfcaca', 300, 300), alt: 'Detail of the aquatint sky' },
    { url: dotPicture('#dcd8d7', 300, 300), alt: 'The print framed in oak' },
    { url: dotPicture('#c9c4c3', 300, 300), alt: 'The signature and the edition number' },
  ],
  credits: [
    { role: 'artist', userId: 'sample-mara', name: 'Mara Okafor' },
    { role: 'printer', name: 'Elkdonis Lab' },
  ],
  price: 180,
  medium: 'Etching and aquatint on Hahnemühle, 300 gsm',
  height_cm: 40,
  width_cm: 50,
  year: 2026,
  edition_type: 'edition',
  edition_size: 25,
  edition_proofs: 3,
  variants: [
    { name: 'Unframed sheet', price: 180, stock: 14 },
    { name: 'Framed in oak', price: 320, stock: 4 },
  ],
};

// ── Offering (service) ──────────────────────────────────────────────────────

export const SERVICE_CONTEXT: FormContext = {
  ...GATHERING_SAMPLE_CONTEXT,
  fields: { ...GATHERING_SAMPLE_CONTEXT.fields, feeds: [{ slug: 'offerings', name: 'Offerings' }, ...((GATHERING_SAMPLE_CONTEXT.fields.feeds as unknown[]) ?? [])] },
};

export const serviceFixtureKind: FormKindSchema & { layout: NonNullable<FormKindSchema['layout']> } = {
  id: 'service',
  label: () => 'New offering',
  codeKind: () => 'service',
  sections: [
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    { id: 'booking', label: 'The booking', tier: 'essentials', groups: ['booking'] },
    { id: 'pricing', label: 'Price', tier: 'essentials', groups: ['pricing'], quick: true },
    { id: 'description', label: 'Description', tier: 'essentials', fields: ['body'] },
    { id: 'summary', label: 'Summary', tier: 'more', fields: ['excerpt'], summary: (a) => (text(a.excerpt) ? text(a.excerpt) : 'From the description') },
    { id: 'cover', label: 'Cover', tier: 'more', fields: ['cover_image_url'], summary: (a) => (text(a.cover_image_url) ? 'A cover picture' : 'None yet') },
    {
      id: 'publishing',
      label: 'Publishing',
      tier: 'more',
      groups: ['placement'],
      summary: (a, ctx) => [a.visibility === 'PUBLIC' ? 'Public' : 'Members', ctx.orgName].join(' · '),
    },
  ],
  rules: [
    { id: 'service.title', severity: 'block', fields: ['title'], section: 'title', test: (a) => !text(a.title), message: 'Name the offering.', short: 'Title: missing' },
  ],
  defaultOpen: () => [],
  empty: (ctx) => emptyContentAnswers('service', ctx.fields as ContentFieldContext),
  layout: { body: { section: 'description', field: 'body', editor: 'toolbar' }, rows: [] },
};

/** An offering: one-to-one sessions on the presses, sliding scale. */
export const SERVICE_FIXTURE: Answers = {
  ...serviceFixtureKind.empty(SERVICE_CONTEXT),
  title: 'One-to-one printmaking',
  subtitle: 'An hour and a half on the presses, at your pace',
  booking_type: 'one_on_one',
  format: 'in_person',
  session_duration_hrs: 1.5,
  session_count: 1,
  location: 'Studio 4, 120 Harbord St, Toronto',
  recurrence_label: 'By arrangement',
  price: 120,
  currency: 'CAD',
  sliding_scale: true,
  price_sliding_min: 60,
  sliding_scale_note: 'Pay what you can; the full price supports someone else',
  registration_status: 'open',
  body: '<p>Bring a drawing or a plate. We set up relief or intaglio and work through it together, from inking to the first proof.</p>',
  cover_image_url: SAMPLE_PICTURE,
  feed_slug: 'offerings',
  visibility: 'PUBLIC',
};
