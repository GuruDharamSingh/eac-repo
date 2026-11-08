// ============================================================================
// Post rules (writing), with the README §7 copy.
//
//   design   a title (block)
//   mirrors  thread-listing.ts:148: only a PUBLIC post may be listed outside
//            its home, so Members + other sites in "Also show on" is refused
//            by setListing; say so before the save does
// ============================================================================

import type { FormRule } from '../contract';
import { list, text, trimmed } from './answers';

export const POST_RULES: FormRule[] = [
  {
    id: 'post.title',
    severity: 'block',
    fields: ['title'],
    section: 'title',
    test: (a) => !trimmed(a.title),
    message: 'Give it a title.',
    short: 'Title: missing',
  },
  {
    id: 'post.listing-public',
    severity: 'block',
    fields: ['also_on'],
    section: 'alsoOn',
    test: (a, ctx) => {
      const visibility = text(a.visibility) || 'PUBLIC';
      if (visibility === 'PUBLIC') return false;
      const home = text(ctx.fields.homeOrgId);
      return list(a.also_on).some((orgId) => orgId !== home);
    },
    message: 'Members-only posts stay on their own site. Make it Public, or untick the other sites.',
    short: 'Also show on: members-only stays home',
  },
];
