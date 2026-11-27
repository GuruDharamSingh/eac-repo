import type { Area, Capability, Host, HostKey } from '../types';

// elktours standing listings: a tour kept open for registration on chosen weekdays, with runs made up to six months
// ahead. 2026-11-24, claude (added). Migration 291 (booking_standing_rules; unapplied at the time of writing).
// Read: lib/standing-actions.ts, lib/standing-rules.ts, lib/overlap-actions.ts, lib/slot-overlaps.ts, instrumentation.ts (hourly top-up), packages/booking/src/server/slots.ts createSlots.
//
// Gate: requireOrgEditor, then a guide acts on tours whose author_id is the viewer; owners on all (the same rule as
// slot-actions). The hourly top-up (topUpStandingRules) runs as the system, with no viewer, for every active rule.

const APP = 'elktours';
const SRC = 'apps/elktours/src/lib/';
const V = '2026-11-24 read lib/standing-actions.ts, lib/standing-rules.ts, lib/overlap-actions.ts, lib/slot-overlaps.ts, instrumentation.ts; SQL probed in a rolled-back transaction; standingStarts run with tsx (count, DST, end date)';
const sa = (f: string, fn: string): HostKey => `sa:${SRC}${f}#${fn}` as HostKey;
const sq = (f: string, fn: string): HostKey => `sql:${SRC}${f}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, ...(note ? { note } : {}) });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `sql twin of ${of}` });

const capabilities: Capability[] = [
  {
    id: 'elktours-standing-listing-open',
    area: 'elktours.standing',
    label: 'Keep a tour open for registration on chosen weekdays',
    does: "Saves a standing rule (weekdays, up to four start times, places, guide, how far ahead up to six months, optional end date) and makes the matching runs now. The runs are topped up every hour as days pass. They are ordinary runs: the tour's minimum to run and the guide's run-or-cancel decision apply. An overlap with the guide's other runs is allowed.",
    class: 'person',
    actors: ['owner', 'guide', 'system'],
    scope: 'org',
    hosts: [
      host(sa('standing-actions.ts', 'saveStandingRule'), ['requireOrgEditor', 'INSERT booking_standing_rules', 'materialiseRule -> @elkdonis/booking createSlots (allowClash)'], '/hub', "the 'Open for registration' button on the Standing listing tab of the Offer a tour popup (components/office/standing-panel.tsx)"),
      twin(sq('standing-actions.ts', 'saveStandingRule'), sa('standing-actions.ts', 'saveStandingRule')),
      host(sq('standing-rules.ts', 'materialiseRule'), ['UPDATE booking_standing_rules (generated_through)', '@elkdonis/booking createSlots'], '/hub', 'inner writer: the rule save and the hourly top-up from instrumentation.ts (topUpStandingRules)'),
    ],
    entry: null,
    status: 'booking_slots rows with source rule and standing_rule_id exist for the rule at its weekdays and times, through its horizon',
    risk: ['public'],
    confirm: { text: 'Open “{title}” for registration on {when}, up to {count} months ahead? The runs go on sale to visitors at once.', status: 'draft' },
    inputs: 'tour id, weekdays, times, places, guide user id, days ahead (1-183), optional end date',
    drift: 'Runs made by hand (slot-actions createSlots) and by a rule are the same rows; source and standing_rule_id tell them apart.',
    canonical: 'standing-actions saveStandingRule, then lib/standing-rules materialiseRule',
    open: "Migration 291 applied 2026-11-24 (by hand, alone) and elktours rebuilt the same day; not yet used signed in. A rule keeps making runs after the tour is unpublished (the top-up skips only an offer whose status is not open). The top-up creates runs with no viewer, so a guide's later loss of access to the tour does not stop their rule.",
    verified: V,
    added: '2026-11-24',
  },
  {
    id: 'elktours-standing-listing-stop',
    area: 'elktours.standing',
    label: 'Stop a standing listing',
    does: "Stops a standing rule so no more runs are made. Runs already made stay, with their bookings. Optionally deletes the rule's future runs that nobody has booked.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('standing-actions.ts', 'stopStandingRule'), ['requireOrgEditor', 'UPDATE booking_standing_rules active = false', 'DELETE booking_slots (optional, future, no bookings)'], '/hub', "the Stop and Stop and remove empty runs buttons of the Standing listings list (components/office/standing-panel.tsx)"),
      twin(sq('standing-actions.ts', 'stopStandingRule'), sa('standing-actions.ts', 'stopStandingRule')),
    ],
    entry: null,
    status: 'booking_standing_rules.active is false for the rule',
    risk: ['irreversible', 'public'],
    confirm: { text: 'Stop the standing listing for “{title}”? Runs already made stay.', status: 'draft' },
    inputs: 'rule id, remove empty runs (yes or no)',
    drift: 'None: single copy.',
    open: "The removal deletes booking_slots rows that have no bookings row of any status (bookings.slot_id is ON DELETE RESTRICT, so a booked run cannot be deleted). A cancelled run is not touched (status must be scheduled). The removal has a confirm in the panel (window.confirm), not the dock's wording.",
    verified: V,
    added: '2026-11-24',
  },
  {
    id: 'elktours-overlap-dismiss',
    area: 'elktours.standing',
    label: 'Dismiss an overlap notice',
    does: "Two runs of one guide that overlap in time are allowed and listed as a notice (hub card, /manage/overlaps, Needs you). Dismissing records the pair of runs as seen so the notice stops showing. The schedule keeps flagging the overlap itself.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('overlap-actions.ts', 'dismissOverlap'), ['requireOrgEditor', 'listOverlaps (must be a current overlap of the viewer)', 'INSERT booking_clash_dismissals'], '/hub', "the Dismiss button of the Overlapping runs popup and of /manage/overlaps (components/office/overlap-list.tsx)"),
      host(sa('overlap-actions.ts', 'dismissAllOverlaps'), ['requireOrgEditor', 'listOverlaps', 'INSERT booking_clash_dismissals'], '/hub', 'the Dismiss all button of the same list'),
      host(sq('overlap-actions.ts', 'insertDismissals'), ['raw INSERT booking_clash_dismissals'], '/hub', 'inner writer of the two actions above'),
    ],
    entry: null,
    status: 'booking_clash_dismissals has a row for the pair of slots',
    risk: ['none'],
    confirm: { text: 'Dismiss this overlap notice? The runs stay as they are.', status: 'draft' },
    inputs: 'two slot ids (or none, for all)',
    drift: 'None: single copy.',
    open: "A dismissal hides the notice for everyone on the site, not only the person who dismissed it. A guide dismisses only their own overlaps (listOverlaps is scoped to them); an owner any. Migration 291 is applied (2026-11-24).",
    verified: V,
    added: '2026-11-24',
  },
];

const ignored: Area['ignored'] = [
  { key: sa('overlap-actions.ts', 'listOverlapsAction'), why: 'read exposed as a server action: the overlap notices the viewer may see (a guide sees their own)' },
  { key: sa('standing-actions.ts', 'listStandingRules'), why: "read exposed as a server action: the standing listings a guide or owner may manage (a guide sees their own tours' rules)" },
  { key: sa('standing-actions.ts', 'previewStandingRule'), why: 'read exposed as a server action: what a rule would make today, with overlaps; writes nothing' },
];

const area: Area = { capabilities, ignored };
export default area;
