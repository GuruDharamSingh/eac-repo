// ============================================================================
// Anchors (2026-11-16, DOCK_LOOP_SLICE1 §3.1): `data-eac-anchor="<registry entry id>"` on the
// real control, so the dock can outline it after "Take me there". Client-safe, no imports.
//
// Apps spread it: <button {...anchorProps('store')}>. packages/cms-ui and packages/studio do not
// depend on this package (it already imports cms-ui types, and a new dependency needs an install),
// so they write the attribute literally (`SurfaceAction.anchor`, or `data-eac-anchor="..."`);
// check:registry greps source for every address.anchor in both spellings.
// One visible match per id on a page; the dock outlines the first visible one.
// ============================================================================

export const EAC_ANCHOR = 'data-eac-anchor';

export function anchorProps(id: string, opts: { subject?: string } = {}): Record<string, string> {
  return { [EAC_ANCHOR]: id, ...(opts.subject ? { 'data-eac-subject': opts.subject } : {}) };
}
