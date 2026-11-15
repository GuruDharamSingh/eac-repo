// The workshop kind's rules (2026-11-14): what upsertWorkshopOffering needs.
import type { FormRule } from '../contract';
import { datePart, num, trimmed } from './answers';

export const WORKSHOP_RULES: FormRule[] = [
  {
    id: 'workshop.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => trimmed(a.title).length < 2,
    message: 'Give the workshop a title.',
    short: 'Title: missing',
  },
  {
    id: 'workshop.when',
    severity: 'block',
    fields: ['scheduled_at'],
    section: 'when',
    test: (a) => !datePart(a.scheduled_at),
    message: 'Pick when it starts.',
    short: 'When: no date',
  },
  {
    id: 'workshop.price',
    severity: 'block',
    fields: ['price'],
    section: 'price',
    test: (a) => {
      const p = num(a.price);
      return p !== null && p < 0;
    },
    message: 'A price cannot be below zero. Leave it empty for free.',
    short: 'Price: below zero',
  },
  {
    id: 'workshop.min-over-cap',
    severity: 'warn',
    fields: ['min_attendees', 'attendee_limit'],
    section: 'rsvp',
    test: (a) => {
      const min = num(a.min_attendees);
      const cap = num(a.attendee_limit);
      return min !== null && cap !== null && min > cap;
    },
    message: 'It needs more people than it has places.',
    short: 'Places: minimum over the cap',
  },
];
