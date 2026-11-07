import type { FeaturedWho } from "@elkdonis/blocks";
import { resolveFeaturedPerson } from "@elkdonis/services/featured-people";
import { siteConfig } from "@/config/site";

// ============================================================================
// Featured person on Para Theater (2026-11-07, as on elktours 2026-11-06): the shared resolver
// (@elkdonis/services/featured-people) bound to this deployment's org, and the
// person's page here (/about/<slug>). Server only: it reaches the database.
// The org comes from the deployment, never from a request.
// ============================================================================

export async function featuredWho(ref: unknown): Promise<FeaturedWho | null> {
  const p = await resolveFeaturedPerson(siteConfig.orgId, ref);
  if (!p) return null;
  return {
    displayName: p.displayName,
    roleTitle: p.roleTitle,
    bio: p.bio,
    photoUrl: p.photoUrl,
    href: p.slug ? `/about/${encodeURIComponent(p.slug)}` : null,
    via: p.via ?? null,
  };
}
