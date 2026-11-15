// ============================================================================
// Make into (2026-11-14, widened 2026-11-15): which kinds a piece can be made into, and the
// one URL that opens one. Shared by Create's Library and the piece summary; a site's Channel
// links the same route on arts-collective.
//
//   <makeBase>?from=<thread|artwork>:<id>&to=<kind>&org=<org>
//
// `to` is any kind the Studio opens as a new draft (`/studio?kind=<id>`): post, writing, video,
// meeting, artwork-form, service-form, wordart (recording opens too, but is a capture tool, so
// it is never offered). `makeBase` is the host's route (arts-collective: /studio/make).
// `makeIntoFor` lists every sensible target for a source type, most likely first, and leaves
// out the source's own kind unless it means something (a meeting into the next meeting).
// Nothing carries over yet (docs/open/MAKE_INTO_CARRY_2026-11-11.md).
// ============================================================================

const PERSONAL_ORG_ID = 'oad';

/** A kind to make a piece into; `to` is the route's `to`. */
export interface MakeIntoTarget {
  to: string;
  label: string;
}

const POST: MakeIntoTarget = { to: 'post', label: 'Social post' };
const ESSAY: MakeIntoTarget = { to: 'writing', label: 'Essay' };
const VIDEO: MakeIntoTarget = { to: 'video', label: 'Video clip' };
const ARTWORK: MakeIntoTarget = { to: 'artwork-form', label: 'Artwork' };
const OFFERING: MakeIntoTarget = { to: 'service-form', label: 'Offering' };
const MEETING: MakeIntoTarget = { to: 'meeting', label: 'Meeting' };
const WORDART: MakeIntoTarget = { to: 'wordart', label: 'Word art' };

/** Targets by the source's content type (@elkdonis/content ContentType). */
export function makeIntoFor(type: string): MakeIntoTarget[] {
  switch (type) {
    case 'writing':
      return [POST, ARTWORK, VIDEO, MEETING, OFFERING, WORDART];
    case 'meeting':
    case 'event':
    case 'workshop':
    case 'series':
      return [{ to: 'post', label: 'Reminder post' }, { to: 'meeting', label: 'Next meeting' }, ESSAY, VIDEO, OFFERING, WORDART];
    case 'artwork':
      return [POST, ESSAY, VIDEO, OFFERING, MEETING, WORDART];
    case 'product':
      return [POST, ARTWORK, ESSAY, VIDEO, OFFERING, WORDART];
    case 'video':
      return [POST, ESSAY, MEETING, WORDART];
    default:
      return [POST, ESSAY, VIDEO, ARTWORK, MEETING, OFFERING];
  }
}

/** The Make into route for a piece (`<store>:<id>`), a target and the acting org (`oad` adds none). */
export function makeIntoHref(makeBase: string, from: string, to: string, orgId: string | null): string {
  const q = new URLSearchParams({ from, to });
  if (orgId && orgId !== PERSONAL_ORG_ID) q.set('org', orgId);
  return `${makeBase}?${q.toString()}`;
}
