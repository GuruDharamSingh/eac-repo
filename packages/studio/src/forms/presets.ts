// ============================================================================
// @elkdonis/studio/forms: presets ("Start from…"), pass 1 (the bone's).
// Plan: docs/open/publishing-forms-handoff/PLAN.md §4.
//
// Pass 1 has no store: platform presets live here, and "your last one's
// settings" is derived from the person's latest record of the kind. When the
// content_prefs / lane A2 preset store exists (a migration, pass 4), it feeds
// FormActions.presets() and nothing here changes. The cascade (item → org →
// person → platform) is resolved by that loader, not re-invented here; this
// file only orders what it is given.
//
// A preset carries SETTINGS, never content: no title, body, date or picture.
// ============================================================================

import type { Answers, FormKindId, FormPreset, PresetSource } from './contract';

/** The answer keys a preset may carry, per kind. Content (title, body, dates, media) is never among them. */
export const PRESET_KEYS: Record<FormKindId, string[]> = {
  post: ['feed_slug', 'visibility', 'layout', 'share_to_network'],
  gathering: [
    'duration_minutes',
    'format',
    'location',
    'time_zone',
    'start_time', // the wall-clock time of day ("18:30"), not the date
    'is_rsvp_enabled',
    'attendee_limit',
    'min_attendees',
    'notify_on_min_attendees',
    'create_talk_room',
    'create_document',
    'feed_slug',
    'visibility',
    'host_user_id',
    'co_host_user_id',
  ],
  artwork: ['kind', 'currency', 'listAsOrg', 'certificateOfAuthenticity', 'edition', 'variants', 'shows'],
  service: [
    'booking_type',
    'format',
    'location',
    'session_duration_hrs',
    'session_count',
    'currency',
    'sliding_scale',
    'price_sliding_min',
    'sliding_scale_note',
    'registration_status',
    'feed_slug',
    'visibility',
  ],
};

/** Shipped with the platform. Writing layouts are the Studio's own (types.ts STUDIO_LAYOUTS). */
export const PLATFORM_PRESETS: FormPreset[] = [
  { id: 'platform:post:blank', name: 'Blank post', note: 'Nothing set. Or start from your last post’s settings.', kind: 'post', source: 'platform', values: {} },
  {
    id: 'platform:post:announcement',
    name: 'Announcement',
    note: 'Title on a coloured band, public, shared to the network.',
    kind: 'post',
    source: 'platform',
    values: { layout: 'announcement', visibility: 'PUBLIC', share_to_network: true },
  },
  { id: 'platform:post:note', name: 'Short note', note: 'No cover, a small title.', kind: 'post', source: 'platform', values: { layout: 'note' } },
  {
    id: 'platform:gathering:evening',
    name: 'An evening gathering',
    note: '2 hours from 18:30, RSVPs on, in person.',
    kind: 'gathering',
    source: 'platform',
    values: { duration_minutes: 120, start_time: '18:30', format: 'in_person', is_rsvp_enabled: true },
  },
  {
    id: 'platform:gathering:online',
    name: 'An online hour',
    note: '1 hour, a Talk room made when you publish, RSVPs on.',
    kind: 'gathering',
    source: 'platform',
    values: { duration_minutes: 60, format: 'online', create_talk_room: true, is_rsvp_enabled: true },
  },
  {
    id: 'platform:artwork:print',
    name: 'Editioned print',
    note: 'A limited edition with a certificate.',
    kind: 'artwork',
    source: 'platform',
    values: { kind: 'limited_edition', certificateOfAuthenticity: true },
  },
  { id: 'platform:service:one', name: 'One-to-one session', note: 'One person, online, booking open.', kind: 'service', source: 'platform', values: { booking_type: 'one_on_one', format: 'online', registration_status: 'open' } },
];

const SOURCE_ORDER: PresetSource[] = ['item', 'org', 'person', 'last', 'platform'];

/** The "Start from" list: item, org, person, the last one's settings, then platform, without duplicate ids. */
export function orderPresets(kind: FormKindId, given: FormPreset[], last: FormPreset | null): FormPreset[] {
  const all = [...given, ...(last ? [last] : []), ...PLATFORM_PRESETS].filter((p) => p.kind === kind);
  const seen = new Set<string>();
  return all
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
}

/** "Your last post's settings": the preset keys of a saved record's answers. */
export function presetFromAnswers(kind: FormKindId, answers: Answers, label: string): FormPreset {
  const values: Answers = {};
  for (const k of PRESET_KEYS[kind]) {
    const v = answers[k];
    if (v !== undefined && v !== null && v !== '') values[k] = v;
  }
  // A gathering's time of day travels; its date does not.
  if (kind === 'gathering' && !values.start_time && typeof answers.scheduled_at === 'string') {
    const m = /T(\d{2}:\d{2})/.exec(answers.scheduled_at);
    if (m) values.start_time = m[1];
  }
  const noun = kind === 'gathering' ? 'gathering' : kind === 'artwork' ? 'piece' : kind === 'service' ? 'offering' : 'post';
  return { id: `last:${kind}`, name: label || `Your last ${noun}’s settings`, note: summarise(kind, values), kind, source: 'last', values };
}

/** One line for the preset note, from what the values set. */
export function summarise(kind: FormKindId, v: Answers): string {
  const bits: string[] = [];
  if (kind === 'gathering') {
    if (typeof v.duration_minutes === 'number') bits.push(v.duration_minutes % 60 === 0 ? `${v.duration_minutes / 60} hours` : `${v.duration_minutes} minutes`);
    if (typeof v.location === 'string' && v.location) bits.push(v.location);
    if (typeof v.attendee_limit === 'number') bits.push(`${v.attendee_limit} places`);
    if (v.create_talk_room) bits.push('a Talk room');
  } else if (kind === 'post') {
    if (typeof v.layout === 'string') bits.push(`${v.layout} layout`);
    if (v.visibility === 'ORGANIZATION') bits.push('members only');
  }
  return bits.length ? bits.join(', ') + '.' : 'The same settings as last time.';
}
