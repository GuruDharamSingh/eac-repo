'use client';

// ============================================================================
// Offering's own sections (code kind `service`, soft tissue, pass 2): How it's
// held, Price, Booking, Publishing, with the closed-row summaries.
//
// The keys are cms-ui content-fields' `service` groups (booking, pricing),
// unchanged (PLAN §12), saved by serviceInputFromAnswers → upsertServiceOffering
// (packages/services/src/service-offerings.ts:391-430, :243), which drops none
// of them (Ligament). The shape follows hidden-enneagram's service-kind.tsx:
// the kind of session, its length and count, where, the price with a sliding
// scale, whether it can be booked, the picture, who sees it.
//
// Copy checked against the code (owner ruling 7):
//   - only an open offering can be booked: a booking refuses any other
//     registration_status (commerce/src/server/service-orders.ts:99-100)
//   - a booking needs a price above 0 (:106), so an empty price is a warning
//     (rules/service.ts service.price-free)
//   - people pay what they choose between the floor and the price
//     (servicePriceLabel prints "CA$40–80", service-offerings.ts:462-475)
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { clip, durationLabel, num, plainText, text, trimmed } from '../../rules/answers';
import { servicePrice, slidingOn } from '../../rules/service';
import { Cell, GoesOnFields, Hint, Row, Stack, placementSummary } from '../post/parts';

// ── How it's held ────────────────────────────────────────────────────────────

const BOOKING_TYPES = [
  { value: 'one_on_one', label: 'One to one' },
  { value: 'group', label: 'A group' },
  { value: 'async', label: 'Not live' },
];

const FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Either' },
];

/** The lengths offered, in minutes; the answer is hours (session_duration_hrs). */
export const SERVICE_LENGTHS = [30, 45, 60, 90, 120];

function minutesOf(a: Answers): number | null {
  const h = num(a.session_duration_hrs);
  return h !== null && h > 0 ? Math.round(h * 60) : null;
}

export function ServiceHeld({ answers: a, patch, field }: SectionProps) {
  const type = text(a.booking_type) || 'one_on_one';
  const live = type !== 'async';
  const format = text(a.format) || 'online';
  const minutes = minutesOf(a);
  const [other, setOther] = React.useState(minutes !== null && !SERVICE_LENGTHS.includes(minutes));
  return (
    <Stack gap={14}>
      {field('booking_type', { input: 'radio', label: 'Who it is for', hideLabel: true, options: BOOKING_TYPES })}
      {!live && <Hint>Written or recorded: nobody meets at a time.</Hint>}
      {live && (
        <>
          <Row name="service-length" gap={10} align="flex-end">
            <Cell flex="0 1 auto">
              {field('service_length', {
                input: 'radio',
                label: 'Length',
                options: [...SERVICE_LENGTHS.map((m) => ({ value: String(m), label: durationLabel(m) })), { value: 'other', label: 'Other' }],
                value: other ? 'other' : minutes !== null ? String(minutes) : '',
                onChange: (v) => {
                  if (v === 'other') return setOther(true);
                  setOther(false);
                  patch({ session_duration_hrs: Number(v) / 60 });
                },
              })}
            </Cell>
            {other && (
              <Cell flex="0 0 120px">{field('session_duration_hrs', { input: 'number', label: 'Hours', min: 0, step: 0.25, placeholder: '1' })}</Cell>
            )}
            <Cell flex="0 0 110px">{field('session_count', { input: 'number', label: 'Sessions', min: 1, placeholder: '1' })}</Cell>
          </Row>
          <Row name="service-where" gap={10} align="flex-end">
            <Cell flex="0 1 auto">{field('format', { input: 'radio', label: 'Where', options: FORMATS })}</Cell>
            {format !== 'online' && (
              <Cell flex="1 1 220px">{field('location', { input: 'text', label: 'Place', placeholder: 'An address or a room' })}</Cell>
            )}
          </Row>
        </>
      )}
      {field('recurrence_label', { input: 'text', label: 'How often', placeholder: 'Weekly, by arrangement, once…' })}
    </Stack>
  );
}

/** "One to one · 1h · online" | "A group · 4 sessions of 1½h · Studio 4" | "Not live". */
export function heldSummary(a: Answers): string {
  const type = BOOKING_TYPES.find((t) => t.value === (text(a.booking_type) || 'one_on_one'))?.label ?? 'One to one';
  if (text(a.booking_type) === 'async') return type;
  const minutes = minutesOf(a);
  const count = num(a.session_count);
  const length = minutes ? durationLabel(minutes) : '';
  const sessions = count && count > 1 ? `${count} sessions${length ? ` of ${length}` : ''}` : length;
  const format = text(a.format) || 'online';
  // The place's first part, as the cards print it ("Studio 4").
  const place = (trimmed(a.location).split(',')[0] ?? '').trim();
  const where = format === 'online' ? 'online' : place ? clip(place, 32) : format === 'hybrid' ? 'online or in person' : 'in person';
  return [type, sessions, where].filter(Boolean).join(' · ');
}

// ── Price ────────────────────────────────────────────────────────────────────

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];
const SYMBOL: Record<string, string> = { CAD: '$', USD: '$', EUR: '€', GBP: '£' };

export function ServicePrice({ answers: a, field }: SectionProps) {
  const currency = (text(a.currency) || 'CAD').toUpperCase();
  const options = CURRENCIES.map((c) => ({ value: c, label: c }));
  if (!CURRENCIES.includes(currency)) options.push({ value: currency, label: currency });
  return (
    <Stack gap={14}>
      <Row name="service-price" gap={10} align="flex-end">
        <Cell flex="0 0 150px">
          {field('price', { input: 'number', label: 'Price', hideLabel: true, min: 0, step: 'any', prefix: SYMBOL[currency] ?? '', placeholder: '80' })}
        </Cell>
        <Cell flex="0 0 110px">{field('currency', { input: 'select', label: 'Currency', hideLabel: true, options })}</Cell>
      </Row>
      {field('sliding_scale', { input: 'toggle', label: 'Sliding scale', placeholder: 'people choose what they pay, down to a floor' })}
      {slidingOn(a) && (
        <Row name="service-sliding" gap={10} align="flex-start">
          <Cell flex="0 0 150px">
            {field('price_sliding_min', { input: 'number', label: 'Lowest amount', min: 0, step: 'any', prefix: SYMBOL[currency] ?? '' })}
          </Cell>
          <Cell flex="1 1 220px">
            {field('sliding_scale_note', { input: 'text', label: 'A note about the scale', placeholder: 'Pay what you can; the full price supports someone else' })}
          </Cell>
        </Row>
      )}
    </Stack>
  );
}

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** "$80" | "$40–80, a sliding scale" | "Free": the card's price line, as servicePriceLabel prints it. */
export function priceSummary(a: Answers): string {
  const price = servicePrice(a);
  const currency = (text(a.currency) || 'CAD').toUpperCase();
  if (price === 0) return 'Free';
  const floor = slidingOn(a) ? num(a.price_sliding_min) : null;
  if (floor !== null && floor >= 0 && floor < price) return `${money(floor, currency)}–${money(price, currency)}, a sliding scale`;
  return money(price, currency);
}

// ── Booking ──────────────────────────────────────────────────────────────────

const REGISTRATION = [
  { value: 'open', label: 'Open' },
  { value: 'waitlist', label: 'Waitlist only' },
  { value: 'full', label: 'Full' },
  { value: 'closed', label: 'Closed' },
];

export function ServiceBooking({ field }: SectionProps) {
  return field('registration_status', {
    input: 'radio',
    label: 'Booking is',
    hideLabel: true,
    options: REGISTRATION,
    hint: 'Only an open offering can be booked and paid for.',
  });
}

/** "Open: people can book and pay" | "Full" | … */
export function bookingSummary(a: Answers): string {
  const s = text(a.registration_status) || 'open';
  if (s === 'open') return 'Open: people can book and pay';
  return `${REGISTRATION.find((r) => r.value === s)?.label ?? 'Closed'}: nobody can book it now`;
}

// ── Line under the title, Card summary, Picture ──────────────────────────────

export function subtitleSummary(a: Answers): string {
  return trimmed(a.subtitle) ? clip(trimmed(a.subtitle)) : 'None';
}

/** The card's line (threads.excerpt; left empty, deriveExcerpt takes it from the body: service-offerings.ts upsert). */
export function ServiceExcerpt({ field }: SectionProps) {
  return field('excerpt', {
    input: 'textarea',
    label: 'Card summary',
    hideLabel: true,
    placeholder: 'One or two sentences for the card. Left empty, the start of the description is used.',
  });
}

export function cardSummarySummary(a: Answers): string {
  return trimmed(a.excerpt) ? clip(trimmed(a.excerpt)) : plainText(a.body) ? 'From the opening of the description' : 'From the description, once there is one';
}

export function pictureSummary(a: Answers): string {
  return trimmed(a.cover_image_url) ? 'A picture' : 'None yet';
}

// ── Publishing ───────────────────────────────────────────────────────────────

export function ServicePublishing(props: SectionProps) {
  // forum.ts:12: ORGANIZATION threads are seen by that org's members only.
  return <GoesOnFields {...props} label="Goes on" network visibilityHint="Members-only offerings are seen only by this organisation’s members." />;
}

export function servicePublishingSummary(a: Answers, ctx: FormContext): string {
  return placementSummary(a, ctx);
}
