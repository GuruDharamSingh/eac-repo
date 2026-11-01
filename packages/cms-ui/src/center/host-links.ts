import type { CenterData, CenterLinks, CenterOrgLink, CenterThread } from "./types";

// ============================================================================
// CenterLinks for a single-org site (the template apps: innergathering,
// amrit-canada, sunjay, fourthwayBookreaders).
//
// The four hosts computed the same links with the same rules and drifted on
// one line each. This is the common part; a host supplies what only it knows
// (its basePath, how it carries a sign-in across sites, its env URLs).
// Pure: no data layer, no auth — both arrive as values or functions.
// ============================================================================

export interface OrgSiteHome {
  orgSlug: string;
  /** Verified primary custom domain, or null. */
  primaryDomain: string | null;
}

export interface OrgSiteCenterLinksInput {
  data: CenterData;
  /** Every org's home (`listOrgHomes`), to resolve other orgs' links. */
  homes: OrgSiteHome[];
  /** The network's origin, e.g. `https://arts-collective.com`. */
  networkUrl: string;
  /** ArtDirect's origin, no trailing slash. */
  artdirectUrl: string;
  marketplaceUrl: string | null;
  /**
   * Where "Account" goes. Defaults to this site's /account; a site without
   * one passes the network's (`<network>/account`, through crossSite).
   */
  accountHref?: string | null;
  forumHref: string | null;
  composeHref: string | null;
  /** Wrap an absolute URL so the sign-in travels with it (the SSO hop). */
  crossSite: (url: string) => string;
  /** Prefix a same-site path with the app's basePath. Identity by default. */
  path?: (p: string) => string;
}

/**
 * Where another org can be reached. Its own domain when verified; otherwise
 * the network hub's page for that org. The `<slug>.<network>` subdomains are
 * not emitted: no column records whether a subdomain's certificate is live
 * (`organizations.subdomain_confirmed` is the intake gate, not that), and
 * the sprint log records them failing TLS. (claude, 2026-10-08)
 */
export function orgDoorUrl(home: OrgSiteHome | undefined, slug: string, networkUrl: string): string {
  if (home?.primaryDomain) return `https://${home.primaryDomain}`;
  return `${networkUrl}/hub/organization?org=${encodeURIComponent(slug)}`;
}

export function buildOrgSiteCenterLinks(input: OrgSiteCenterLinksInput): CenterLinks {
  const { data, homes, networkUrl, artdirectUrl, crossSite } = input;
  const path = input.path ?? ((p: string) => p);
  const homeBySlug = new Map(homes.map((h) => [h.orgSlug, h] as const));
  const door = (slug: string) => orgDoorUrl(homeBySlug.get(slug), slug, networkUrl);
  const slug = data.person?.slug ?? null;

  return {
    threadHref: (t: CenterThread) => path(`/${t.section ?? "feed"}/${t.slug}`),
    // A thread on an org with its own domain is at /<slug> there; without
    // one, the hub page for that org is as close as a link can get.
    networkThreadHref: (t: CenterThread) => {
      const home = homeBySlug.get(t.orgSlug);
      return crossSite(home?.primaryDomain ? `https://${home.primaryDomain}/${t.slug}` : door(t.orgSlug));
    },
    orgHref: (o: CenterOrgLink) => {
      if (o.isCurrent) return null;
      const home = homeBySlug.get(o.orgSlug);
      const staff = o.role === "owner" || o.role === "guide" || o.role === "member";
      // Staff go to that org's hub; a follower to its center. Only an org on
      // its own domain answers those routes; the rest go to the network hub.
      if (!home?.primaryDomain) return crossSite(door(o.orgSlug));
      return crossSite(`https://${home.primaryDomain}${staff ? "/hub" : "/center"}`);
    },
    profileHref: slug ? crossSite(`${artdirectUrl}/${slug}`) : null,
    editProfileHref: slug ? crossSite(`${artdirectUrl}/${slug}`) : path("/account"),
    accountHref: input.accountHref ?? path("/account"),
    notificationsHref: null,
    filesHref: null,
    // The Studio lives on the network host; the org rides along as the acting org (2026-10-31).
    studioHref: crossSite(`${networkUrl}/studio?org=${encodeURIComponent(data.org?.orgId ?? "")}`),
    forumHref: input.forumHref,
    artistHref: (s: string) => crossSite(`${artdirectUrl}/${s}`),
    marketplaceUrl: input.marketplaceUrl,
    // The person's store on the marketplace, by their slug (art-auction's /artists/<slug>).
    storeHref: (handle: string) =>
      input.marketplaceUrl ? crossSite(`${input.marketplaceUrl.replace(/\/$/, "")}/artists/${encodeURIComponent(handle)}`) : null,
    followEndpoint: path("/api/center/follow"),
    loginHref: path("/login?next=/center"),
    homeUrl: path("/"),
    homePreviewUrl: path("/"),
    orgProfileHref: path("/about"),
    composeHref: input.composeHref,
    // Shown until the person is an artist of the collective (oad member).
    gainSpaceHref: data.orgs.some((o) => o.orgId === "oad" && o.role !== "viewer")
      ? null
      : crossSite(`${networkUrl}/wizard`),
  };
}
