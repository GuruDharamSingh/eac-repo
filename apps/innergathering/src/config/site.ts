/**
 * Single-tenant config. This app serves exactly one org — InnerGathering,
 * the Elkdonis Arts Collective's own gathering site — one domain per
 * container, so orgId is fixed rather than resolved from the Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * hasOrgRole() — see src/lib/auth.ts.
 *
 * The landing page's admin-set copy (featured artist, initiative, fundraising,
 * image spaces) still lives under the `elkdonis` org in `site_config`, where
 * the previous site's admin screens wrote it; `landingConfigOrgId` says so in
 * one place rather than scattering the literal.
 */
export const siteConfig = {
  orgId: "inner_group",
  orgName: "InnerGathering",
  shortName: "EAC",
  tagline: "Elkdonis Arts Collective — a mutual aid society for objective arts, education and cultural exchange",
  city: "Toronto",
  landingConfigOrgId: "elkdonis",
  /** Fallback recipient for guest RSVP and contact notifications. */
  fallbackNotifyEmail: process.env.INNERGATHERING_OWNER_EMAIL ?? "info@elkdonis-arts.org",
} as const;

export type SiteConfig = typeof siteConfig;
