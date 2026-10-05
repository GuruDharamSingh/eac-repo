import { notFound } from "next/navigation";
import { sanitizeRichText } from "@elkdonis/utils";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getServerSession } from "@elkdonis/auth-server";
import { getPersonPage, personThreadHref, type PersonThread } from "@elkdonis/services";
import { PersonPage, PersonThreadList } from "@elkdonis/cms-ui/profile";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
import { getGuideBySlug } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { formatDate, formatDateTime, toPlainText } from "@/lib/format";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const NETWORK_URL =
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  `https://${process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com"}`;

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.displayName,
    description: guide.roleTitle ?? toPlainText(guide.bio, 160),
  };
}

/** Posts homed here open on this site's `/<feed>/<slug>` route (ThreadCard's convention). */
function threadHref(t: PersonThread): string {
  return personThreadHref(t, {
    networkUrl: NETWORK_URL,
    localOrgId: siteConfig.orgId,
    localHref: (x) => (x.section ? `/${x.section}/${x.slug}` : null),
  });
}

/**
 * A person's page on this site, from their network profile
 * (getPersonPage; docs/open/PERSON_PAGES_BRIEF_2026-09-26.md). Which sections
 * show is the person's per-org choice; posts include those listed here from
 * other orgs, which link out to their home site.
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const session = await getServerSession();
  const viewerId = session.user?.db_user_id ?? session.user?.id ?? null;

  // getGuideBySlug applies this site's org_profiles.bio_override; the
  // network bio is the fallback (see readBioOverride in lib/data.ts).
  const [page, guide] = await Promise.all([
    getPersonPage(slug, { orgId: siteConfig.orgId, viewerId }),
    getGuideBySlug(slug),
  ]);
  if (!page) notFound();

  const { profile, orgProfile } = page;
  const store = page.show.store ? await getStoreShowcaseForUser(profile.userId, { limit: 6 }).catch(() => null) : null;

  const bio = guide?.bio ?? profile.bio;
  const bioIsHtml = Boolean(bio && bio.includes("<"));
  // The site's own guide has a given short name (site config); for anyone
  // else the first word of the display name stands in, as before.
  const firstName = profile.slug === siteConfig.guideSlug ? siteConfig.guideShortName : profile.displayName.split(" ")[0];

  const slots: Record<string, ReactNode> = {
    posts: page.show.posts ? (
      <PersonThreadList
        title="Posts"
        items={page.posts.map((t) => {
          const foreign = t.orgId !== siteConfig.orgId;
          return {
            href: threadHref(t),
            title: t.title,
            meta: [t.publishedAt ? formatDate(t.publishedAt) : null, foreign ? `on ${t.orgName}` : null]
              .filter(Boolean)
              .join(" · ") || null,
            excerpt: t.excerpt ? toPlainText(t.excerpt, 200) : null,
            external: foreign,
            draft: t.status !== "published",
          };
        })}
        empty={page.canEdit ? "Nothing posted here yet." : null}
      />
    ) : null,
    events: page.show.events ? (
      <PersonThreadList
        title="Events"
        items={page.events.map((t) => {
          const foreign = t.orgId !== siteConfig.orgId;
          return {
            href: threadHref(t),
            title: t.title,
            meta: [t.scheduledAt ? formatDateTime(t.scheduledAt) : null, t.location, foreign ? `on ${t.orgName}` : null]
              .filter(Boolean)
              .join(" · ") || null,
            external: foreign,
            draft: t.status !== "published",
          };
        })}
        empty={page.canEdit ? "No events yet." : null}
      />
    ) : null,
    // Their marketplace store: a window, not a checkout.
    store: store ? (
      <StoreShowcase
        store={store.store}
        artworks={store.artworks}
        marketplaceUrl={siteConfig.marketplaceUrl}
        from={siteConfig.orgId}
        heading={`From ${firstName}’s store`}
        density="normal"
      />
    ) : null,
  };

  return (
    <PersonPage
      person={{
        displayName: profile.displayName,
        role: orgProfile?.roleTitle ?? profile.headline,
        bio: bioIsHtml ? null : bio,
        // Sanitised here: PersonPage renders bioHtml as given.
        bioHtml: bioIsHtml ? sanitizeRichText(bio) : null,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        verified: profile.verified,
        socialLinks: profile.socialLinks,
      }}
      back={{ href: "/about", label: "← About" }}
      portfolio={page.portfolio.map((p) => ({ url: p.url, title: p.title }))}
      emptyFeatured={null}
      order={page.sections.map((s) => s.key)}
      slots={slots}
      networkLink={ARTDIRECT_URL && profile.slug ? { href: `${ARTDIRECT_URL}/${profile.slug}` } : null}
    />
  );
}
