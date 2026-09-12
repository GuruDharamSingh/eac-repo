/**
 * Single-tenant config: this app serves exactly one org. Authorisation is not
 * configured here — it comes from user_organizations via getOrgRole() (see
 * src/lib/auth.ts).
 */
export const siteConfig = {
  orgId: "elastrocal",
  orgName: "Elastrocal",
  tagline: "Natal charts, calculated with the Swiss Ephemeris",

  /**
   * Where the "sky now" chart casts its houses. Greenwich, as the prototype
   * did: the planets are the same everywhere, only the houses need a place.
   */
  skyLocation: { name: "Greenwich", latitude: 51.4769, longitude: -0.0005 },

  /**
   * Nominatim (OpenStreetMap) geocoding for the birthplace search. Its usage
   * policy requires an identifying User-Agent, at most one request a second,
   * and forbids search-as-you-type — so the form searches on submit only, and
   * requests go through our /api/geocode, never straight from the browser.
   */
  geocoderUrl: "https://nominatim.openstreetmap.org/search",
  geocoderUserAgent: "Elastrocal/0.1 (+https://elkdonis-arts.org)",
} as const;

export type SiteConfig = typeof siteConfig;
