/**
 * Single-tenant config. This app serves exactly one org; the deployment is one
 * domain per container, so orgId is fixed rather than resolved from the Host
 * header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * getOrgRole() — see src/lib/auth.ts.
 */
export const siteConfig = {
  orgId: "pigeonshoot",
  orgName: "Pigeonshoot",
  tagline: "Toronto's street pigeons, catalogued as trading cards",
  /** The city a visitor lands on when they haven't chosen one. */
  defaultCity: "toronto",

  /**
   * The anonymous author of record.
   *
   * threads.author_id and media.uploaded_by are both NOT NULL FKs to users,
   * and anonymous contributors have no users row by design (see src/lib/guest.ts
   * for why). Every anonymous submission is owned by this seeded sentinel;
   * real attribution lives in pigeon_cards.guest_id.
   *
   * Seeded in migration 077. Changing this constant without changing the
   * migration will break every anonymous write with a foreign-key violation.
   */
  sentinelUserId: "9e1e0b7a-1f4d-4c1a-9f2e-6b7c8d9e0f01",

  /**
   * Map tiles. OpenStreetMap needs no API key and its usage policy tolerates a
   * low-traffic hobby site; the attribution below is mandatory under ODbL.
   * Kept in config so swapping to CARTO or Stadia later is one string, not a
   * hunt through components.
   */
  tileUrl: process.env.NEXT_PUBLIC_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  tileMaxZoom: 19,

  /** Largest accepted upload, before re-encoding. Mirrored in the submit UI copy. */
  maxUploadMb: 25,
  /** Long edge of the stored original after re-encode. */
  fullImageEdge: 2000,
  /** Long edge of the card-sized derivative. */
  cardImageEdge: 800,
} as const;

export type SiteConfig = typeof siteConfig;
