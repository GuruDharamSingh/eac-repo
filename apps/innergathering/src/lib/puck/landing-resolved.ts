// What the landing page's blocks' resolvers fill in (2026-11-21), by block type. No imports: the save action
// (actions.ts), the landing editor's mount and the harness all read it. Stripped before a page is saved: only a
// block's settings are stored, and the page reads the rest again on every request.
export const LANDING_RESOLVED_KEYS: Readonly<Record<string, readonly string[]>> = {
  "offerings-band": ["items", "rows", "signedIn", "nextcloudUrl"],
  "grand-forum": ["embed", "question", "signedIn", "preview"],
};
