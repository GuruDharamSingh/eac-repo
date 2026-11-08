// ============================================================================
// Offering (code kind `service`; people see "Offering", PLAN §8.1), pass 2,
// soft tissue. Reference: hidden-enneagram components/publish/service-kind.tsx
// (read only); fields: cms-ui content-fields' `service` groups (identity,
// summary, booking, pricing, media, placement), keys unchanged (PLAN §12).
//
// Saved by forms/adapters/service.ts: serviceInputFromAnswers →
// upsertServiceOffering, with the signed-in person as the author (the payee:
// resolveSettlement pays a service's author; HE migration 253).
//
//   Essentials  Title · How it's held · Price · Description
//   More        Line under the title · Card summary · Booking · Picture · Publishing
//
// Nothing deferred: every key the design names for an offering saves
// (serviceInputFromAnswers drops none, service-offerings.ts:391-430).
// ============================================================================

import { emptyContentAnswers, type ContentFieldContext } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema, KindLayout } from '../../contract';
import { SERVICE_RULES } from '../../rules/service';
import {
  ServiceBooking,
  ServiceExcerpt,
  ServiceHeld,
  ServicePrice,
  ServicePublishing,
  bookingSummary,
  cardSummarySummary,
  pictureSummary,
  servicePublishingSummary,
  subtitleSummary,
} from './sections';

export function serviceFieldContext(ctx: FormContext): ContentFieldContext {
  return { ...(ctx.fields as ContentFieldContext), defaultTimeZone: ctx.timeZone };
}

/**
 * content-fields' service defaults (one to one, online, open, CAD), filed under the
 * org's "services" feed when it has one: with no feed at all the save files it there
 * anyway (upsertServiceOffering, service-offerings.ts:250).
 */
export function emptyServiceAnswers(ctx: FormContext): Answers {
  const a = emptyContentAnswers('service', serviceFieldContext(ctx));
  const feeds = Array.isArray(ctx.fields.feeds) ? (ctx.fields.feeds as Array<{ slug?: unknown }>) : [];
  const services = feeds.find((f) => f && f.slug === 'services');
  return services ? { ...a, feed_slug: 'services' } : a;
}

export const SERVICE_LAYOUT: KindLayout = {
  body: { section: 'description', field: 'body', editor: 'toolbar' },
  rows: [
    // 390px: the length seg takes the line; Hours and Sessions drop under it.
    { section: 'held', row: 'service-length', cells: { service_length: '0 1 auto', session_duration_hrs: '0 0 120px', session_count: '0 0 110px' } },
    { section: 'held', row: 'service-where', cells: { format: '0 1 auto', location: '1 1 220px' } },
    { section: 'price', row: 'service-price', cells: { price: '0 0 150px', currency: '0 0 110px' } },
    { section: 'price', row: 'service-sliding', cells: { price_sliding_min: '0 0 150px', sliding_scale_note: '1 1 220px' } },
    { section: 'publishing', row: 'goes-on', cells: { feed_slug: '1 1 260px', visibility: '0 1 auto' } },
  ],
};

export const serviceKind: FormKindSchema & { layout: KindLayout } = {
  id: 'service',
  label: () => 'New offering',
  codeKind: () => 'service',
  sections: [
    // ── Essentials ──
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    {
      id: 'held',
      label: 'How it’s held',
      tier: 'essentials',
      fields: ['booking_type', 'format', 'location', 'session_duration_hrs', 'session_count', 'recurrence_label'],
      render: 'serviceHeld',
    },
    {
      id: 'price',
      label: 'Price',
      tier: 'essentials',
      fields: ['price', 'currency', 'sliding_scale', 'price_sliding_min', 'sliding_scale_note'],
      render: 'servicePrice',
      quick: true,
    },
    { id: 'description', label: 'Description', tier: 'essentials', fields: ['body'], quick: true },
    // ── More ──
    { id: 'subtitle', label: 'Line under the title', tier: 'more', fields: ['subtitle'], summary: (a) => subtitleSummary(a) },
    { id: 'excerpt', label: 'Card summary', tier: 'more', fields: ['excerpt'], render: 'serviceExcerpt', summary: (a) => cardSummarySummary(a) },
    {
      id: 'booking',
      label: 'Booking',
      tier: 'more',
      fields: ['registration_status'],
      render: 'serviceBooking',
      summary: (a) => bookingSummary(a),
      done: () => true,
    },
    { id: 'picture', label: 'Picture', tier: 'more', fields: ['cover_image_url'], summary: (a) => pictureSummary(a) },
    {
      id: 'publishing',
      label: 'Publishing',
      tier: 'more',
      fields: ['feed_slug', 'visibility', 'share_to_network'],
      render: 'servicePublishing',
      summary: servicePublishingSummary,
    },
  ],
  components: {
    serviceHeld: ServiceHeld,
    servicePrice: ServicePrice,
    serviceBooking: ServiceBooking,
    serviceExcerpt: ServiceExcerpt,
    servicePublishing: ServicePublishing,
  },
  rules: SERVICE_RULES,
  defaultOpen: () => [],
  empty: emptyServiceAnswers,
  deferred: [],
  layout: SERVICE_LAYOUT,
};
