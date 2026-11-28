// Where each app lives on the web, for "Take me there" links (2026-11-27, rails desk lane A).
// Source: CLAUDE.md "Apps" table. Atlas side only (never shipped with an app): the seed and
// scripts/atlas-readiness.mts import it. `address.app` in the atlas is the directory name under apps/.
import type { Capability } from './types';

/** Public origin per app (no trailing slash); an app that has none is absent. */
export const APP_ORIGINS: Readonly<Record<string, string>> = {
  'arts-collective': 'https://arts-collective.com',
  sunjay: 'https://paratheater.arts-collective.com',
  forum: 'https://forum.arts-collective.com',
  'amrit-canada': 'https://amritcanada.ca',
  ifac: 'https://ifacgroup.com',
  'art-auction': 'https://market.arts-collective.com',
  'hidden-enneagram': 'https://hiddenenneagram.com',
  artdirect: 'https://directory.arts-collective.com',
  innergathering: 'https://elkdonis-arts.org',
  danamccool: 'https://danamccool.com',
  fourthwayBookreaders: 'https://elkdonis-arts.org/books',
  elktours: 'https://elkdonisexperiences.com',
  sophia: 'https://sophia.elkdonis-arts.org',
  development: 'https://arts-collective.com/development',
  'katie-the-potter': 'https://pottery.arts-collective.com',
};

/** Plain names for where a thing is done, used when an address has no `how` line. */
export const APP_NAMES: Readonly<Record<string, string>> = {
  'arts-collective': 'the network hub',
  sunjay: 'the Paratheater site',
  forum: 'the Grand Forum',
  'amrit-canada': 'the Amrit Canada site',
  ifac: 'the IFAC site',
  'art-auction': 'the market',
  'hidden-enneagram': 'the Hidden Enneagram site',
  artdirect: 'the directory',
  innergathering: 'the Elkdonis Arts site',
  danamccool: 'the Dana McCool site',
  fourthwayBookreaders: 'the Books site',
  elktours: 'the Elkdonis Experiences site',
  sophia: 'Sophia',
  development: 'the development desk',
  'katie-the-potter': 'the pottery site',
  admin: 'the central admin app',
};

/**
 * A full URL for an atlas address, or null when the app has no public origin. A path with a `{placeholder}`
 * (an organisation, a post) is cut back to the part before it, so the link opens a real page and the "where"
 * line tells the person what to look for. Query strings are dropped for the same reason.
 */
export function placeUrl(app: string, path: string | undefined | null): string | null {
  const origin = APP_ORIGINS[app];
  if (!origin) return null;
  if (!path || !path.startsWith('/')) return origin;
  const segs = path.split('?')[0].split('/').filter(Boolean);
  const keep: string[] = [];
  for (const s of segs) {
    if (s.includes('{')) break;
    keep.push(s);
  }
  return keep.length ? `${origin}/${keep.join('/')}` : origin;
}

/** The address the atlas gives for where a capability is done: app, path and a short "how". */
export interface PlaceAddress { app: string; path: string; how?: string; surface?: string; anchor?: string }

/**
 * Person-level capabilities whose atlas hosts all sit on one org site, but whose home for a person is the hub
 * (the profile card). Kept short and checked by hand: add a row only when the hub control really exists.
 */
const PLACE_OVERRIDES: Readonly<Record<string, PlaceAddress>> = {
  'upload-profile-photo': { app: 'arts-collective', path: '/hub/network', how: 'The photo button in your profile card' },
  'profile-section-toggle': { app: 'arts-collective', path: '/hub/network', how: 'The Where you show switches in your profile card' },
};

/**
 * The first usable address of a capability. A host on the network hub (arts-collective) wins, because that is
 * where the dock and most people live; otherwise the first host with an address on an app that has a public origin.
 */
export function pickAddress(c: Pick<Capability, 'hosts'> & { id?: string }): PlaceAddress | null {
  if (c.id && PLACE_OVERRIDES[c.id]) return PLACE_OVERRIDES[c.id];
  const all: PlaceAddress[] = [];
  for (const h of c.hosts) {
    const a = h.address;
    if (a && a.app && a.path) all.push({ app: a.app, path: a.path, ...(a.how ? { how: a.how } : {}), ...(a.surface ? { surface: a.surface } : {}), ...(a.anchor ? { anchor: a.anchor } : {}) });
  }
  return all.find((a) => a.app === 'arts-collective') ?? all.find((a) => APP_ORIGINS[a.app]) ?? all[0] ?? null;
}

/**
 * A `how` line from the atlas is written for developers. Keep its plain first part (before a bracket, a semicolon
 * or a dash) when it reads as words a person would say; otherwise nothing.
 */
export function plainHow(how: string | undefined): string | null {
  if (!how) return null;
  const t = how.split(/ \(|;| — |\. (?=[A-Z])/)[0].replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  if (t.length < 6 || t.length > 120) return null;
  if (/[\/`_]|\.tsx?\b|\b(api|sql|route)\b/i.test(t) || /\b[a-z]+[A-Z]\w*/.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
