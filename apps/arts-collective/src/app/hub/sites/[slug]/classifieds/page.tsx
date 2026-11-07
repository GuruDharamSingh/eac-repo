import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug, getOrgFeed } from "@/lib/org";
import { loadClassifieds } from "@/lib/classifieds/store";
import { FONTS_HREF, starterDoc } from "@/lib/classifieds/catalog";
import { ClassifiedsEditor } from "@/components/classifieds/ClassifiedsEditor";

/**
 * Edit an org's classifieds page: `/hub/sites/<slug>/classifieds`.
 * Gated here (owners and guides, `canEditOrgSite`; everyone else gets a 404)
 * and again in saveClassifiedsAction. Opens on a starter sheet when the org
 * has none; nothing is stored until Save.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit classifieds", robots: { index: false, follow: false } };

export default async function OrgClassifiedsEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/login?next=${encodeURIComponent(`/hub/sites/${slug}/classifieds`)}`);
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  if (!(await canEditOrgSite(user.id, org.id))) notFound();

  const doc = (await loadClassifieds(org.id)) ?? starterDoc(org.name);
  const threads = (await getOrgFeed(org.id, 100)).map((t) => ({ id: String(t.id), title: t.title || "(untitled)" }));

  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const viewUrl = `${proto}://${slug}.${host.replace(/^www\./, "")}/classifieds`;

  return (
    <>
      <link rel="stylesheet" href={FONTS_HREF} precedence="default" />
      <ClassifiedsEditor orgSlug={slug} orgName={org.name} doc={doc} threads={threads} viewUrl={viewUrl} />
    </>
  );
}
