import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { templateDocument } from "@elkdonis/blocks";
import { getOrgIdentity } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";
import { loadOrgHome } from "@/lib/puck/store";
import { KNOWN_TYPES } from "@/lib/puck/config.server";
import { blankOrgTemplate, orgHomeTemplate } from "@/lib/puck/template";
import { OrgPageEditor } from "@/components/studio/OrgPageEditor";

/**
 * Design an org's landing page: `/hub/sites/<slug>/design`.
 *
 * Gated twice on purpose: here, so someone without the role never loads the
 * editor at all, and again in `saveOrgHomeAction`, because a client
 * component is not an authorisation boundary. The org is the one in the URL;
 * owners and guides of that org (`canEditOrgSite`) may edit, everyone else
 * gets a 404 rather than a hint that the page exists.
 *
 * A page that has not been designed yet opens as a document built from the
 * org's identity (name, headline, logo, statement, links) rather than an
 * empty canvas. Nothing is stored until Publish; until then the subdomain
 * root keeps showing the offering or the default page.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Design your landing page", robots: { index: false, follow: false } };

export default async function OrgDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { slug } = await params;
  const { start } = await searchParams;
  const user = await requireUser(`/login?next=${encodeURIComponent(`/hub/sites/${slug}/design`)}`);
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  if (!(await canEditOrgSite(user.id, org.id))) notFound();

  const identity = await getOrgIdentity(slug);
  const seed = {
    orgName: identity?.orgName ?? org.name,
    headline: identity?.headline ?? null,
    bio: identity?.bio ?? org.description ?? null,
    avatarUrl: identity?.avatarUrl ?? null,
    socialLinks: identity?.socialLinks ?? [],
  };
  const templates = [orgHomeTemplate(seed), blankOrgTemplate(seed.orgName)];

  const stored = await loadOrgHome(org.id, KNOWN_TYPES);
  const initial = stored
    ? (stored.data as Data)
    : (templateDocument(start === "blank" ? templates[1] : templates[0], org.name) as unknown as Data);

  return (
    <OrgPageEditor
      orgId={org.id}
      orgSlug={slug}
      orgName={org.name}
      initial={initial}
      templates={templates}
    />
  );
}
