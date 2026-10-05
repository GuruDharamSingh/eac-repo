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
  { id: 'artwork', label: 'Artwork', noun: 'work', ready: false },
  { id: 'event', label: 'Events', noun: 'event', ready: false },
  { id: 'meeting', label: 'Meetings', noun: 'meeting', ready: false },
  { id: 'workshop', label: 'Workshops', noun: 'workshop', ready: false },
  { id: 'service', label: 'Services', noun: 'service', ready: false },
  { id: 'question', label: 'Questions', noun: 'questionnaire', ready: false },
];
