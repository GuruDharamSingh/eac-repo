import type { StudioKind } from './types';

/**
 * Every kind, under every org, including "Just me" (dev, 2026-09-27). Only
 * writing has an editor behind it yet; the rest show the tab and say so, so
 * the shape of the Studio is visible before the rest is built.
 */
export const STUDIO_KINDS: StudioKind[] = [
  { id: 'writing', label: 'Writing', noun: 'piece', ready: true },
  // Registered by the host as an extension (frame.tsx); href is the fallback for hosts that do not.
  { id: 'video', label: 'Video', noun: 'reel', ready: true, href: '/studio?kind=video' },
  // Posts for Facebook, Instagram and Threads (2026-10-31); an extension like Video.
  { id: 'post', label: 'Posts', noun: 'post', ready: true, href: '/studio?kind=post' },
  // Recordings: camera, screen or phone into your files (2026-11-01); an extension like Video.
  { id: 'recording', label: 'Recordings', noun: 'recording', ready: true, href: '/studio?kind=recording' },
  { id: 'artwork', label: 'Artwork', noun: 'work', ready: false },
  // Meetings and events are one shape (content-fields.ts) and the live rows are all meeting;
  // one tab, an extension like Post (2026-11-01).
  { id: 'meeting', label: 'Meetings', noun: 'meeting', ready: true, href: '/studio?kind=meeting' },
  { id: 'workshop', label: 'Workshops', noun: 'workshop', ready: false },
  { id: 'service', label: 'Services', noun: 'service', ready: false },
  { id: 'question', label: 'Questions', noun: 'questionnaire', ready: false },
];
