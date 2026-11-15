import { db } from "@elkdonis/db";
import { getProfileBySlug } from "@elkdonis/services";
import { resolveFeaturedPerson } from "@elkdonis/services/featured-people";
import { getGuideBySlug, getGuides } from "@/lib/data";
import type { Guide } from "@/lib/types";
import { siteConfig } from "@/config/site";

// ============================================================================
// Whose profile "Profile card" (pt-profile) shows (2026-11-14, editing landscape round 2: danamccool's artist-profile
// pattern). The block stores at most a reference; with none it shows the site's guide, found from the organisation
// rather than from a slug typed into the block.
//
//   ""                 the site's guide: an OWNER of this organisation with a public profile here. Para Theater has two
//                      owners, so the deployment's `siteConfig.guideSlug` only breaks the tie between owners (it was
//                      the whole rule before). With no owner profile, the first public profile.
//   "user:<uuid>"      that person (a public profile here, as Featured person requires);
//   "thread:<id>:author|next-host|next-guide"
//                      whoever that gathering or series names today (@elkdonis/services/featured-people).
// ============================================================================

const ORG = siteConfig.orgId;

async function ownerIds(): Promise<string[]> {
  try {
    const rows = await db<Array<{ user_id: string }>>`
      SELECT user_id FROM user_organizations WHERE org_id = ${ORG} AND role = 'owner'
    `;
    return rows.map((r) => r.user_id);
  } catch (err) {
    console.error("[sunjay] ownerIds:", err);
    return [];
  }
}

/** The site's guide: see the header. Null only when the site has no public profile at all. */
export async function siteGuide(): Promise<Guide | null> {
  const [guides, owners] = await Promise.all([getGuides().catch(() => [] as Guide[]), ownerIds()]);
  const ownerProfiles = guides.filter((g) => owners.includes(g.userId));
  const pick =
    ownerProfiles.find((g) => g.slug === siteConfig.guideSlug) ??
    [...ownerProfiles].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName))[0] ??
    guides[0] ??
    null;
  // Read again by slug: that read carries the site's own bio (getGuideBySlug's bio_override).
  return pick ? getGuideBySlug(pick.slug).catch(() => pick) : null;
}

/** The guide a stored reference names, or the site's guide for none. Null: the reference names no one shown here. */
export async function guideFor(ref: unknown): Promise<Guide | null> {
  const r = typeof ref === "string" ? ref.trim() : "";
  if (!r) return siteGuide();
  const p = await resolveFeaturedPerson(ORG, r).catch(() => null);
  return p?.slug ? getGuideBySlug(p.slug).catch(() => null) : null;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** The guide and the links row beside them, as the landing page built them. */
export async function loadProfileFor(ref: unknown): Promise<{ guide: Guide | null; links: Array<{ label: string; url: string; emphasis?: boolean }> }> {
  const guide = await guideFor(ref);
  if (!guide) return { guide: null, links: [] };

  // The network profile is the source for the links row: someone who wrote
  // their links on ArtDirect or any other EAC surface arrives here complete.
  const person = await getProfileBySlug(guide.slug).catch(() => null);
  const collectiveHost = hostOf(siteConfig.collectiveUrl);

  const links = [
    ...(person?.socialLinks ?? [])
      .filter((l) => l.url && (!collectiveHost || hostOf(l.url) !== collectiveHost))
      .map((l) => ({
        // A row entered as a bare URL has no label; the host says where the
        // link goes without inventing a name.
        label: l.label?.trim() || hostOf(l.url) || l.url,
        url: l.url,
      })),
    // Elkdonis is not one of their profiles, so it is marked `emphasis`.
    { label: "Elkdonis Arts", url: siteConfig.collectiveUrl, emphasis: true },
  ];
  return { guide, links };
}
