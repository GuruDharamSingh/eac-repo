// What the page blocks' resolvers fill in (2026-11-06). No imports: the save action, the landing page and the harness
// read it. The save action removes these with the shared stripResolvedKeys (@elkdonis/blocks/record), which replaced
// this file's own walker on 2026-11-06: it walks the whole document and covers every case the old one did
// (packages/direct-edit/harness/featured/strip.mts).

/** What the resolvers fill in, by block type. Stripped before a page is saved: only a block's settings are stored. */
export const RESOLVED_KEYS: Readonly<Record<string, readonly string[]>> = {
  "featured-person": ["who", "opened"],
  "link-button": ["opened"],
  "feature-card": ["bound", "opened"],
};
