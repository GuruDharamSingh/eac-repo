// ============================================================================
// Gathering samples (README "Sample content": every name, org and date is made
// up), for the harness's canvas ids 1b (RSVP and Emails open), 1h (Publish
// pressed with errors), 1n (mobile), and Repeats on without the planner. The
// ids are not real rows; nothing here is ever saved.
// ============================================================================

import type { Answers, FormContext } from '../../contract';
import { untilForCount } from '../../rules/answers';
import { SAMPLE_NOW } from '../post/sample';
import { emptyGatheringAnswers } from './schema';

export const GATHERING_SAMPLE_CONTEXT: FormContext = {
  orgId: 'sample-eac',
  orgName: 'Elkdonis Arts Collective',
  timeZone: 'America/Toronto',
  now: SAMPLE_NOW,
  fields: {
    feeds: [
      { slug: 'lab-work', name: 'Lab work' },
      { slug: 'gatherings', name: 'Gatherings' },
    ],
    hostCandidates: [
      { userId: 'sample-mara', displayName: 'Mara Okafor' },
      { userId: 'sample-teo', displayName: 'Teo Lindqvist' },
    ],
    canCreateTalkRoom: true,
    canCreateDocument: true,
    canShareToNetwork: true,
    canRemind: true,
    canEdit: true,
    reason: null,
  },
};

/** 1b: "Open studio: printmaking night", Thu 19 Nov 2026 18:30 for 2 hours, Studio 4, 24 places. */
export const GATHERING_SAMPLE: Answers = {
  ...emptyGatheringAnswers(GATHERING_SAMPLE_CONTEXT),
  title: 'Open studio: printmaking night',
  scheduled_at: '2026-11-19T18:30',
  start_time: '18:30',
  duration_minutes: 120,
  time_zone: 'America/Toronto',
  where_mode: 'place',
  format: 'in_person',
  location: 'Studio 4, 120 Harbord St, Toronto',
  body: '<p>An evening on the presses. Bring a sketch or work from ours; relief and monotype will be set up, with someone on hand to help. All levels.</p>',
  host_user_id: 'sample-mara',
  is_rsvp_enabled: true,
  attendee_limit: 24,
  min_attendees: 6,
  rsvp_deadline: '',
  reminder_minutes_before: 1440,
  feed_slug: 'lab-work',
  visibility: 'PUBLIC',
};

/**
 * 1h: Publish pressed with two blocking problems and one warning, as the design:
 * "When: the date has passed" (Thu 5 Nov), "Where: no joining link", and
 * "Needs 12 to go ahead, but only 10 places".
 */
export const GATHERING_ERRORS_SAMPLE: Answers = {
  ...GATHERING_SAMPLE,
  scheduled_at: '2026-11-05T18:30',
  where_mode: 'link',
  format: 'online',
  location: '',
  meeting_url: '',
  attendee_limit: 10,
  min_attendees: 12,
};

const REPEAT_BASE: Answers = {
  ...GATHERING_SAMPLE,
  title: 'Thursday printmaking',
  recurrence_pattern: 'WEEKLY',
  'forms.repeat_count': 8,
};

/** Repeats on: "Every week on Thursday, 8 sessions" (the last on Thu 7 Jan). Not a series in pass 1. */
export const GATHERING_REPEAT_SAMPLE: Answers = {
  ...REPEAT_BASE,
  recurrence_until: untilForCount(REPEAT_BASE, GATHERING_SAMPLE_CONTEXT, 8),
};
