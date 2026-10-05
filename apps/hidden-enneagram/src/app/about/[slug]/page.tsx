import { notFound } from "next/navigation";
import { sanitizeRichText } from "@elkdonis/utils";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getServerSession } from "@elkdonis/auth-server";
import { getPersonPage, personThreadHref, type PersonThread } from "@elkdonis/services";
import { PersonPage, PersonThreadList } from "@elkdonis/cms-ui/profile";
import { SiteNav } from "@/components/site-nav";
import { getGuideBySlug } from "@/lib/data";
import { siteConfig } from "@/config/site";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

const NETWORK_URL =
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  `https://${process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com"}`;

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function formatDay(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/Toronto",
  });
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.displayName,
    description: guide.roleTitle ?? plain(guide.bio),
  };
}

/** Posts homed here open on this site's `/<feed>/<slug>` route. */
function threadHref(t: PersonThread): string {
  return personThreadHref(t, {
    networkUrl: NETWORK_URL,
    localOrgId: siteConfig.orgId,
    localHref: (x) => (x.section ? `/${x.section}/${x.slug}` : null),
  });
}

/**
 * A person's page on this site, from their network profile
 * (getPersonPage; docs/open/PERSON_PAGES_BRIEF_2026-09-26.md). No ArtDirect
 * link: this app has no NEXT_PUBLIC_ARTDIRECT_URL configured.
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const session = await getServerSession();
  const viewerId = session.user?.db_user_id ?? session.user?.id ?? null;

  const page = await getPersonPage(slug, { orgId: siteConfig.orgId, viewerId });
  if (!page) notFound();

  const { profile, orgProfile } = page;
  const bio = profile.bio;
  const bioIsHtml = Boolean(bio && bio.includes("<"));

  const slots: Record<string, ReactNode> = {
    posts: page.show.posts ? (
      <PersonThreadList
        title="Posts"
        items={page.posts.map((t) => {
          const foreign = t.orgId !== siteConfig.orgId;
          return {
            href: threadHref(t),
            title: t.title,
            meta: [t.publishedAt ? formatDay(t.publishedAt) : null, foreign ? `on ${t.orgName}` : null]
              .filter(Boolean)
              .join(" · ") || null,
            excerpt: t.excerpt ? (plain(t.excerpt, 200) ?? null) : null,
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
            meta: [t.scheduledAt ? formatDay(t.scheduledAt, true) : null, t.location, foreign ? `on ${t.orgName}` : null]
              .filter(Boolean)
              .join(" · ") || null,
            external: foreign,
            draft: t.status !== "published",
          };
        })}
        empty={page.canEdit ? "No events yet." : null}
      />
    ) : null,
  };

  return (
    <>
      <SiteNav />
      <main className="font-sans">
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
        />
      </main>
    </>
  );
}
