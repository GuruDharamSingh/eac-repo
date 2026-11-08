// ============================================================================
// Post sample (README "Sample content": every name, org and date is made up),
// for the harness's canvas ids 1a, 2a, 2b, 1j and 1l/1m. The org ids are not
// real rows; nothing here is ever saved.
// ============================================================================

import type { Answers, FormContext } from '../../contract';
import { emptyPostAnswers } from './schema';

/** The design's dot-screen placeholder picture, as an image the media field can show. */
export const SAMPLE_PICTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><defs><pattern id='d' width='4' height='4' patternUnits='userSpaceOnUse'><circle cx='2' cy='2' r='1.2' fill='#201e1d' fill-opacity='0.2'/></pattern></defs><rect width='100%' height='100%' fill='#d7d3d3'/><rect width='100%' height='100%' fill='url(#d)'/></svg>"
  );

/** 12:04 in Toronto on Tue 10 Nov 2026, the design's "Draft saved 12:04". */
export const SAMPLE_NOW = new Date('2026-11-10T17:04:00Z');

export const POST_SAMPLE_CONTEXT: FormContext = {
  orgId: 'sample-eac',
  orgName: 'Elkdonis Arts Collective',
  timeZone: 'America/Toronto',
  now: SAMPLE_NOW,
  fields: {
    // The site binding's look ("Lab work · Elkdonis Arts Collective"). The Studio's network
    // binding passes feeds: [] and canSetVisibility: false instead.
    feeds: [
      { slug: 'lab-work', name: 'Lab work' },
      { slug: 'news', name: 'News' },
    ],
    listingOrgs: [
      { orgId: 'sample-eac', name: 'Elkdonis Arts Collective' },
      { orgId: 'sample-inner', name: 'Inner Gathering' },
    ],
    homeOrgId: 'sample-eac',
    viewerName: 'Mara Okafor',
  },
};

const BODY = [
  '<p>Two days, four presses and about a kilo of soy ink. We set out to learn whether the lab could give up solvent clean-up for good.</p>',
  '<p>The short answer is yes, with two catches. Soy inks stay open longer on the slab, which is lovely for monotype and a nuisance for anything that needs a crisp second colour.</p>',
  '<blockquote><p>Nobody missed the smell of white spirit.</p></blockquote>',
  '<figure><img src="' + SAMPLE_PICTURE + '" alt=""><figcaption>The second-colour pass on the Albion.</figcaption></figure>',
].join('');

export const POST_SAMPLE: Answers = {
  ...emptyPostAnswers(POST_SAMPLE_CONTEXT),
  title: 'Notes from the first press weekend',
  body: BODY,
  cover_image_url: SAMPLE_PICTURE,
  feed_slug: 'lab-work',
  visibility: 'PUBLIC',
  also_on: [],
};
