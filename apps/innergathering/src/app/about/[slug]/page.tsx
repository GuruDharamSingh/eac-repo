import { notFound } from "next/navigation";
import { sanitizeRichText } from "@elkdonis/utils";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPersonPage, personThreadHref, type PersonThread } from "@elkdonis/services";
import { PersonPage, PersonThreadList } from "@elkdonis/cms-ui/profile";
import { getGuideBySlug } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { formatDate, formatDateTime, toPlainText } from "@/lib/format";

interface MemberPageProps {
  params: Promise<{ slug: string }>;
}

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013").replace(/\/$/, "");
const NETWORK_URL =
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  `https://${process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com"}`;

export async function generateMetadata({ params }: MemberPageProps): Promise<Metadata> {
  const { slug } = await params;
  const member = await getGuideBySlug(slug);
  if (!member) return {};
  return { title: member.displayName, description: member.roleTitle ?? toPlainText(member.bio, 160) };
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
 * A member's page.
 *
 * Read from the member's network profile through getPersonPage
 * (docs/open/PERSON_PAGES_BRIEF_2026-09-26.md): `users` plus this org's
 * `org_profiles` row, edited on ArtDirect. This page has no editor; the owner
 * sees a link to ArtDirect. Which sections show is the member's per-org
 * choice; posts include those listed here from other orgs, which link out.
 */
export default async function MemberPage({ params }: MemberPageProps) {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  const page = await getPersonPage(slug, { orgId: siteConfig.orgId, viewerId: viewer?.userId ?? null });
  if (!page) notFound();

  const { profile, orgProfile } = page;
  const memberSlug = profile.slug ?? slug;
  const isOwner = page.isSelf;
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
    // Writing reads at /artists/<slug>/writing/<piece>; drafts open the
    // owner's shelf, since the reader shows published pieces only.
    blog:
      page.show.blog || (page.canEdit && page.writing.length > 0) ? (
        <PersonThreadList
          title="Writing"
          items={page.writing.map((w) => ({
            href:
              w.status === "published"
                ? `/artists/${memberSlug}/writing/${w.slug}`
                : `/artists/${memberSlug}/writing#${w.slug}`,
            title: w.title,
            meta: w.publishedAt ? formatDate(w.publishedAt) : null,
            excerpt: w.lede,
            draft: w.status !== "published",
          }))}
          empty={page.canEdit ? "Nothing written yet." : null}
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
      back={{ href: "/about", label: "← The Collective" }}
      intro={
        isOwner || viewer?.canEdit ? (
          <a className="ig-edit-link" href={`${ARTDIRECT_URL}/${memberSlug}`} target="_blank" rel="noreferrer">
            {isOwner ? "Edit your profile on ArtDirect →" : "Open on ArtDirect →"}
          </a>
        ) : null
      }
      portfolio={page.portfolio.map((p) => ({ url: p.url, title: p.title }))}
      emptyFeatured={null}
      order={page.sections.map((s) => s.key)}
      slots={slots}
      networkLink={ARTDIRECT_URL ? { href: `${ARTDIRECT_URL}/${memberSlug}` } : null}
    />
  );
}
