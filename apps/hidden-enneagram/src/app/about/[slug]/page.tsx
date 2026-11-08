import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@elkdonis/auth-server";
import { getPersonPage } from "@elkdonis/services";
import { getGuideBySlug } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { PuckPage, pageData } from "@/lib/puck/render";
import { PERSON_SLUG } from "@/lib/puck/store";
import { withRouteProps } from "@/lib/puck/route-props";
import { DEFAULT_PERSON_PAGE } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
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

/**
 * A person's page on this site, from their network profile (getPersonPage;
 * docs/open/PERSON_PAGES_BRIEF_2026-09-26.md). Round 6: the studio document
 * `person` (one template for every person; DEFAULT_PERSON_PAGE until
 * published) around he-person in its whole-page shape, which draws the
 * person in the address (lib/record-blocks.ts loadPersonPage, the same read
 * as here). The 404 stays here: no person page, no template. No ArtDirect
 * link: this app has no NEXT_PUBLIC_ARTDIRECT_URL configured.
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const session = await getServerSession();
  const viewerId = session.user?.db_user_id ?? session.user?.id ?? null;

  const page = await getPersonPage(slug, { orgId: siteConfig.orgId, viewerId });
  if (!page) notFound();

  const data = await pageData(PERSON_SLUG, DEFAULT_PERSON_PAGE);
  if (!data) notFound();
  return <PuckPage slug={PERSON_SLUG} data={withRouteProps(data, "he-person", { routeSlug: slug })} />;
}
