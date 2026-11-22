// The shared sample world: import from "@/sample". See ./world.ts for what is in it and the rules.
//
// ADOPTION NOTES for the older per-app mock samples (left working, not refactored):
//   registry/mocks/sunjay/sample.ts    GUIDE -> PEOPLE[3] (Dov Tennant); THREADS -> GATHERINGS + WRITINGS;
//                                      SHELF -> WRITINGS (fields: title, lede = lede, coverImageUrl = cover, publishedAt);
//                                      IMAGES -> ARTWORKS[].image; its placeholder() -> picture() from ./art.
//   registry/mocks/elktours/data.ts    SAMPLE_TOUR -> TOUR (stops, departures, highlights, includes have the same shape);
//                                      SAMPLE_OTHER_TOURS -> SERVICES / GATHERINGS; SAMPLE_PEOPLE -> PEOPLE; art() -> picture().
// To adopt: replace the literal with an import and a small map of field names; the mock's component stays as it is.

export * from "./art";
export * from "./world";
export * from "./views";
