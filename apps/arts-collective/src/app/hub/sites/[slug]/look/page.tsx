import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { canEditOrgIdentity } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import { FALLBACK_LOOK, readOfferLook } from "@/lib/offer-site";
import { LookForm } from "./LookForm";

/**
 * Look of the single-offer page: `/hub/sites/<slug>/look`. Owners and guides
 * (and global admins, `canEditOrgIdentity`); everyone else gets a 404. Gated
 * again in saveOfferLookAction. The new page shows only when "Use the new
 * page" is on; with no saved row the site keeps its current page.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page look", robots: { index: false, follow: false } };

export default async function OfferLookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/login?next=${encodeURIComponent(`/hub/sites/${slug}/look`)}`);
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  if (!(await canEditOrgIdentity(user.id, org.id))) notFound();

  const row = await readOfferLook(org.id);
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const viewUrl = `${proto}://${slug}.${host.replace(/^www\./, "")}/`;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="font-serif text-2xl">Page look</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        How {org.name}&apos;s page draws its featured offer and the windows that open over it.
      </p>
      <LookForm orgSlug={slug} initial={{ ...(row?.look ?? FALLBACK_LOOK), enabled: row?.enabled ?? false }} viewUrl={viewUrl} />
    </main>
  );
}
