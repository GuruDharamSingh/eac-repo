// ============================================================================
// Offering sample (README "Sample content": every name, org and price is made
// up), for the harness. The design has no offering canvas; this one sits in
// the same collective as the others. The ids are not real rows; nothing here
// is ever saved.
// ============================================================================

import type { Answers, FormContext } from '../../contract';
import { SAMPLE_NOW, SAMPLE_PICTURE } from '../post/sample';
import { emptyServiceAnswers } from './schema';

export const SERVICE_SAMPLE_CONTEXT: FormContext = {
  orgId: 'sample-eac',
  orgName: 'Elkdonis Arts Collective',
  timeZone: 'America/Toronto',
  now: SAMPLE_NOW,
  fields: {
    feeds: [
      { slug: 'services', name: 'Services' },
      { slug: 'lab-work', name: 'Lab work' },
    ],
    canShareToNetwork: true,
    viewerId: 'sample-mara',
    viewerName: 'Mara Okafor',
  },
};

/** "Portfolio review": an hour, one to one, online or at the studio, $80 on a sliding scale down to $40. */
export const SERVICE_SAMPLE: Answers = {
  ...emptyServiceAnswers(SERVICE_SAMPLE_CONTEXT),
  title: 'Portfolio review',
  subtitle: 'An hour on your prints with a working printmaker',
  excerpt: '',
  body: '<p>Bring ten prints, finished or not. We look at them together, talk through what is working, and leave you with two or three things to try on the next plate.</p><p>Online, or at the studio if you can bring the prints in person.</p>',
  booking_type: 'one_on_one',
  format: 'hybrid',
  location: 'Studio 4, 120 Harbord St, Toronto',
  session_duration_hrs: 1,
  session_count: 1,
  recurrence_label: 'By arrangement',
  price: 80,
  currency: 'CAD',
  sliding_scale: true,
  price_sliding_min: 40,
  sliding_scale_note: 'Pay what you can; the full price supports someone else’s review.',
  registration_status: 'open',
  cover_image_url: SAMPLE_PICTURE,
  feed_slug: 'services',
  visibility: 'PUBLIC',
};
