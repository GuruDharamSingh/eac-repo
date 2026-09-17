import { siteConfig } from "@/config/site";

// ============================================================================
// Whose site is this request for?
//
// One line today, and the seam that makes "one app, many sites" a change of
// implementation rather than a rewrite. Everything new reads the org through
// here instead of reaching for `siteConfig.orgId`, so when this app starts
// serving several organisations by hostname there is ONE function to change
// and no hunt through routes for a hard-coded id.
//
// The rest of the app still imports siteConfig directly. That is deliberate —
// retrofitting thirty files to prove a point would be a large diff with no
// behaviour in it. New surfaces come through here; the old ones move when they
// are touched for another reason.
//
// When it does become host-based it reads the `Host` header and resolves it
// through `org_domains`. Two things will matter then and are worth writing
// down before they are discovered the hard way: the header is attacker-
// controlled, so it selects a TENANT and must never grant a role; and an
// unknown host has to be a 404, not a fall-back to some default org, or every
// mis-pointed domain quietly serves someone else's site.
// ============================================================================

export function currentOrgId(): string {
  return siteConfig.orgId;
}
