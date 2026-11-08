// ============================================================================
// Offering rules (code kind `service`; people see "Offering", PLAN §8.1), with
// the README §7 voice. The client runs these; the server stays the authority.
//
//   mirrors   validateServiceInput (packages/services/src/service-offerings.ts:431-437),
//             which the save path runs before upsertServiceOffering
//             (artist-offerings.ts:243, elastrocal hub/services/actions.ts:45):
//               a title (:432); a sliding floor not above the price (:433-435)
//   warns     an empty price saves as 0 (serviceInputFromAnswers, :395), which
//             cards print as "Free" (servicePriceLabel, :468) and which a booking
//             refuses: "This has no price set." (commerce/src/server/service-orders.ts:106)
// ============================================================================

import type { FormRule } from '../contract';
import { num, trimmed } from './answers';

/** The price serviceInputFromAnswers saves: the number typed, never below 0, and 0 when empty (:395). */
export function servicePrice(a: Record<string, unknown>): number {
  return Math.max(0, num(a.price) ?? 0);
}

export function slidingOn(a: Record<string, unknown>): boolean {
  return a.sliding_scale === true || a.sliding_scale === 'true';
}

export const SERVICE_RULES: FormRule[] = [
  {
    id: 'service.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => !trimmed(a.title),
    message: 'Give it a title.',
    short: 'Title: missing',
  },
  {
    id: 'service.sliding-floor',
    severity: 'block',
    fields: ['price_sliding_min'],
    section: 'price',
    test: (a) => {
      if (!slidingOn(a)) return false;
      const floor = num(a.price_sliding_min);
      return floor !== null && floor >= 0 && floor > servicePrice(a);
    },
    message: 'The lowest amount is above the price. Lower it, or raise the price.',
    short: 'Price: the lowest amount is above the price',
  },
  {
    id: 'service.price-free',
    severity: 'warn',
    fields: ['price'],
    section: 'price',
    test: (a) => servicePrice(a) === 0,
    message: 'With no price it shows as Free, and nobody can book it here.',
    short: 'Price: shows as Free, and can’t be booked',
  },
];
