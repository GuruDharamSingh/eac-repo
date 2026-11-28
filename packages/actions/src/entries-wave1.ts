// Catalogue entries of wiring wave 1 (2026-11-27, rails desk lane F). One in-dock action each: a runner in
// ./server/runners-wave1.ts, a status check in ./server/checks-wave1.ts, registry data in atlas/entries.ts.
// Spread into ACTION_CATALOGUE by ./catalogue.ts. The form for each is declared in ./forms-wave1.ts.
import type { ActionMeta } from './types';

const e = (id: string, label: string, describe: string, area: ActionMeta['area'], performs?: string): ActionMeta => ({
  id, label, describe, scope: 'person', area, derived: true, runnable: true, ...(performs ? { performs } : {}),
});

export const ENTRIES_WAVE1: readonly ActionMeta[] = [
  e('profile-photo', 'Your profile photo', 'A picture of you, shown on your page and in the directory.', 'profile',
    'Sets the person’s own profile photo to a picture from the media library (an /api/media/ path or an https address).'),
  e('profile-sections', 'Parts of your own page', 'Switch the blog or the store on your own page on or off.', 'profile',
    'Turns the blog or the store section of the person’s own page on or off (services setPresence, the Where you show switch).'),
  e('pen-name-retire', 'Retire a pen name', 'Hide a pen name: its page and byline. It can be brought back.', 'profile',
    'Retires one of the person’s own pen names (services retirePseudonym). Reversible. The name is chosen from the person’s active pen names.'),
  e('pen-name-restore', 'Bring back a pen name', 'Show a retired pen name again.', 'profile',
    'Restores one of the person’s own retired pen names (services restorePseudonym).'),
  e('post-anywhere', 'Post to a site', 'Write a short post and send it to your own blog or to a feed of an organisation you belong to.', 'writing',
    'Publishes one short post at once (services createPostAnywhere): to the person’s own blog, or to a feed of an organisation they belong to, which checks their role.'),
];
