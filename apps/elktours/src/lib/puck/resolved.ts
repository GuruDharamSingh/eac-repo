// What the page blocks' resolvers fill in (2026-11-06). No imports: the save action, the landing page and the harness
// read it. The save action removes these with the shared stripResolvedKeys (@elkdonis/blocks/record), which replaced
// this file's own walker on 2026-11-06: it walks the whole document and covers every case the old one did
// (packages/direct-edit/harness/featured/strip.mts).

/** What the resolvers fill in, by block type. Stripped before a page is saved: only a block's settings are stored. */
export const RESOLVED_KEYS: Readonly<Record<string, readonly string[]>> = {
  "featured-person": ["who", "opened"],
  "link-button": ["opened"],
  "feature-card": ["bound", "opened"],
  // Phone blocks (G2): what their resolvers fill in.
  "m-page-title": ["count", "cover"],
  "m-tour-list": ["rows", "count"],
  // G3a: Discover and the tour template.
  "m-masthead": ["viewer"],
  "m-featured-tour": ["featured"],
  "m-places-shelf": ["places", "placesCount"],
  "m-experiences-panel": ["experiences"],
  "m-guides": ["guides"],
  "m-link-rows": ["feed", "placesCount", "viewer"],
  // 2026-11-21: page buttons, phone menu, desktop tour cards.
  "m-page-buttons": ["shown", "afterFeed"],
  "m-phone-menu": ["shown"],
  "tour-cards": ["cards"],
  "m-tour-topbar": ["tour"],
  "m-tour-hero": ["tour"],
  "m-tour-head": ["tour"],
  "m-tour-blurb": ["tour"],
  "m-tour-meet": ["tour"],
  "m-tour-route": ["tour"],
  "m-tour-dates": ["tour"],
  "m-tour-bookbar": ["tour"],
  // G5/G6.
  "m-places-catalogue": ["rows", "tags", "favouriteCount"],
  "m-feed-list": ["rows"],
  // G4.
  "m-experience-list": ["experiences"],
  "m-artists-row": ["artists"],
  "m-people-grid": ["people"],
  "m-people-slider": ["people"],
  "m-exp-hero": ["exp"],
  "m-exp-facts": ["exp"],
  "m-exp-body": ["exp"],
  "m-exp-tours": ["exp"],
  "m-exp-dates": ["exp"],
  "m-exp-private": ["exp"],
};
