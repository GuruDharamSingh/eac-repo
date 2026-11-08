// ============================================================================
// Pass-2 cases for rules/check.ts: Artwork and Offering (soft tissue). Pure:
// no DOM, no data. check.ts passes its own `eq` and `cases`, so one run counts
// everything.
// ============================================================================

import type { Answers, FormContext, FormKindSchema, FormRule } from '../contract';
import { computeIssues, visibleSections } from '../state';
import { ARTWORK_SAMPLE, ARTWORK_SAMPLE_CONTEXT, artworkKind, descriptionSummary, detailsSummary, editionSummary, mediumShort, priceLine } from '../kinds/artwork';
import { SERVICE_SAMPLE, SERVICE_SAMPLE_CONTEXT, bookingSummary, cardSummarySummary, heldSummary, priceSummary, serviceKind, subtitleSummary } from '../kinds/service';
import { ARTWORK_RULES, pictureCount } from './artwork';
import { SERVICE_RULES } from './service';

export interface CheckTools {
  eq: (name: string, got: unknown, want: unknown) => void;
  cases: (rules: FormRule[], id: string, ctx: FormContext, base: Answers, list: Array<[string, Partial<Answers>, boolean]>) => void;
}

function issueIds(schema: FormKindSchema, a: Answers, ctx: FormContext): string[] {
  return computeIssues(schema, a, ctx).map((i) => `${i.severity}:${i.ruleId}`);
}

/** The structural checks check.ts runs on every kind. */
export function checkSchema({ eq }: CheckTools, schema: FormKindSchema, ctx: FormContext) {
  const ids = schema.sections.map((s) => s.id);
  eq(`${schema.id}: section ids unique`, new Set(ids).size, ids.length);
  for (const r of schema.rules) eq(`${schema.id}: rule ${r.id} points at a section`, ids.includes(r.section), true);
  for (const s of schema.sections) if (s.render) eq(`${schema.id}: ${s.id} render "${s.render}" has a component`, Boolean(schema.components?.[s.render]), true);
  for (const d of schema.deferred ?? []) {
    eq(`${schema.id}: deferred ${d.id} is not drawn`, ids.includes(d.id), false);
    eq(`${schema.id}: deferred ${d.id} cites code or the plan`, /:\d|PLAN|DEBRIEF/.test(d.reason), true);
  }
  for (const id of schema.defaultOpen(schema.empty(ctx))) eq(`${schema.id}: default-open ${id} exists`, ids.includes(id), true);
}

export function checkKinds(t: CheckTools) {
  const { eq, cases } = t;

  // ── artwork ────────────────────────────────────────────────────────────────
  const A = ARTWORK_SAMPLE_CONTEXT;
  const art = ARTWORK_SAMPLE;

  cases(ARTWORK_RULES, 'artwork.title', A, art, [
    ['empty', { title: '' }, true],
    ['spaces', { title: '  ' }, true],
    ['a title', { title: 'Low tide, No. 1' }, false],
  ]);
  cases(ARTWORK_RULES, 'artwork.pictures', A, art, [
    ['none', { pictures: [] }, true],
    ['not a list', { pictures: undefined }, true],
    ['an empty url', { pictures: [{ url: '' }] }, true],
    ['one object', { pictures: [{ url: 'https://example.org/a.jpg' }] }, false],
    ['one URL string', { pictures: ['https://example.org/a.jpg'] }, false],
  ]);
  cases(ARTWORK_RULES, 'artwork.price', A, art, [
    ['$180', {}, false],
    ['empty', { price: undefined }, true],
    ['0 in Price mode (would read as on request)', { price: 0 }, true],
    ['a string from the input', { price: '180' }, false],
    ['on request, no price', { price_mode: 'request', price: undefined }, false],
    ['not for sale is deferred, reads as Price', { price_mode: 'nfs', price: undefined }, true],
  ]);
  cases(ARTWORK_RULES, 'artwork.currency', A, art, [
    ['CAD', {}, false],
    ['lower case gbp', { currency: 'gbp' }, false],
    ['JPY', { currency: 'JPY' }, true],
    ['on request ignores it', { price_mode: 'request', currency: 'JPY' }, false],
  ]);
  cases(ARTWORK_RULES, 'artwork.store', A, art, [['an approved store', {}, false]]);
  eq('artwork.store: no store', ARTWORK_RULES.find((r) => r.id === 'artwork.store')!.test(art, { ...A, fields: { ...A.fields, canEdit: false, reason: 'Your store is not approved yet.' } }), true);

  eq('pictureCount', [pictureCount(art), pictureCount({ pictures: [{ src: 'x' }, '', { url: '' }] })], [4, 1]);
  eq('details summary', detailsSummary(art), 'Etching · 40 × 50 cm · 2026');
  eq('details summary, inches with depth', detailsSummary({ medium: 'Bronze', height_cm: 12, width_cm: 8, depth_cm: 6.25, unit: 'in' }), 'Bronze · 12 × 8 × 6.3 in');
  eq('details summary, empty', detailsSummary({}), 'Medium, size and year');
  eq('medium short', [mediumShort('Etching and aquatint on Hahnemühle, 300 gsm'), mediumShort('Oil on linen'), mediumShort('')], ['Etching', 'Oil', '']);
  eq('edition summary', [editionSummary(art), editionSummary({ edition_type: 'open' }), editionSummary({})], ['A limited edition', 'An open edition', 'One of a kind']);
  eq('description summary', [descriptionSummary(art), descriptionSummary({ description: '<p>Pulled on the Albion.</p>' })], ['None yet', 'Pulled on the Albion.']);
  eq('price line', [priceLine(art, A), priceLine({ ...art, price_mode: 'request' }, A), priceLine({ ...art, price: undefined }, A)], ['$180', 'Price on request', 'No price yet']);

  eq('artwork sample is ready', issueIds(artworkKind, art, A), []);
  eq('blank artwork asks for a title, a picture and a price', issueIds(artworkKind, artworkKind.empty(A), A), ['block:artwork.title', 'block:artwork.pictures', 'block:artwork.price']);
  eq('blank artwork: the seller is the artist', artworkKind.empty(A).credits, [{ role: 'artist', userId: 'sample-mara' }]);
  eq('artwork label and code kind', [artworkKind.label(art), artworkKind.codeKind(art)], ['New artwork', 'artwork']);
  eq('artwork default open', artworkKind.defaultOpen(art), ['details', 'edition']);
  eq('artwork sections', visibleSections(artworkKind, art, A).map((s) => `${s.tier}:${s.id}`), [
    'essentials:pictures',
    'essentials:title',
    'essentials:maker',
    'essentials:price',
    'more:details',
    'more:edition',
    'more:description',
  ]);
  eq('artwork has its own title spec', artworkKind.specs?.title?.input, 'text');
  checkSchema(t, artworkKind, A);

  // ── offering ───────────────────────────────────────────────────────────────
  const V = SERVICE_SAMPLE_CONTEXT;
  const svc = SERVICE_SAMPLE;

  cases(SERVICE_RULES, 'service.title', V, svc, [
    ['empty', { title: '' }, true],
    ['a title', { title: 'A reading' }, false],
  ]);
  cases(SERVICE_RULES, 'service.sliding-floor', V, svc, [
    ['40 under 80', {}, false],
    ['90 over 80', { price_sliding_min: 90 }, true],
    ['equal', { price_sliding_min: 80 }, false],
    ['over, but the scale is off', { sliding_scale: false, price_sliding_min: 90 }, false],
    ['a floor, no price (saves as 0)', { price: undefined, price_sliding_min: 10 }, true],
    ['strings from inputs', { price: '80', price_sliding_min: '90' }, true],
  ]);
  cases(SERVICE_RULES, 'service.price-free', V, svc, [
    ['$80', {}, false],
    ['empty', { price: undefined }, true],
    ['0', { price: 0 }, true],
    ['negative saves as 0', { price: -5 }, true],
  ]);

  eq('held summary', heldSummary(svc), 'One to one · 1h · Studio 4');
  eq('held summary, a group online', heldSummary({ booking_type: 'group', format: 'online', session_duration_hrs: 1.5, session_count: 4 }), 'A group · 4 sessions of 1½h · online');
  eq('held summary, not live', heldSummary({ booking_type: 'async', format: 'online' }), 'Not live');
  eq('price summary', [priceSummary(svc), priceSummary({ ...svc, sliding_scale: false }), priceSummary({ ...svc, price: undefined })], ['$40–$80, a sliding scale', '$80', 'Free']);
  eq('booking summary', [bookingSummary(svc), bookingSummary({ registration_status: 'full' })], ['Open: people can book and pay', 'Full: nobody can book it now']);
  eq('subtitle summary', [subtitleSummary(svc), subtitleSummary({})], ['An hour on your prints with a working printmaker', 'None']);
  eq('card summary summary', [cardSummarySummary(svc), cardSummarySummary({})], ['From the opening of the description', 'From the description, once there is one']);

  eq('offering sample is ready', issueIds(serviceKind, svc, V), []);
  eq('blank offering: a title, and a price warning', issueIds(serviceKind, serviceKind.empty(V), V), ['block:service.title', 'warn:service.price-free']);
  eq('blank offering files under Services', serviceKind.empty(V).feed_slug, 'services');
  eq('blank offering, no services feed: the first feed', serviceKind.empty({ ...V, fields: { feeds: [{ slug: 'lab-work', name: 'Lab work' }] } }).feed_slug, 'lab-work');
  eq('offering label and code kind', [serviceKind.label(svc), serviceKind.codeKind(svc)], ['New offering', 'service']);
  eq('offering sections', visibleSections(serviceKind, svc, V).map((s) => `${s.tier}:${s.id}`), [
    'essentials:title',
    'essentials:held',
    'essentials:price',
    'essentials:description',
    'more:subtitle',
    'more:excerpt',
    'more:booking',
    'more:picture',
    'more:publishing',
  ]);
  checkSchema(t, serviceKind, V);
}
