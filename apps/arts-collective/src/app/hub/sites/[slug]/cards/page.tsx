import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug, getOrgFeed } from "@/lib/org";
import { FONTS_HREF } from "@/lib/classifieds/catalog";
import { SAMPLE_ITEMS, feedItem, starterCards } from "@/lib/cards/catalog";
import { loadCards } from "@/lib/cards/store";
import { CardsEditor } from "@/components/cards/CardsEditor";

/**
 * Design an org's feed cards: `/hub/sites/<slug>/cards` (pass 3). One card,
 * drawn for each of the org's newest public posts while it is designed, then
 * for every post on the org's landing page ("What's on"). Gated here (owners
 * and guides, `canEditOrgSite`; everyone else gets a 404) and again in
 * saveCardsAction. Opens on a starter design; nothing is stored until Save.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Design feed cards", robots: { index: false, follow: false } };

export default async function OrgCardsEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/login?next=${encodeURIComponent(`/hub/sites/${slug}/cards`)}`);
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  if (!(await canEditOrgSite(user.id, org.id))) notFound();

  const doc = (await loadCards(org.id)) ?? starterCards();
  const feed = (await getOrgFeed(org.id, 24)).map((t) => feedItem(t));
  const live = feed.length > 0;

  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const viewUrl = `${proto}://${slug}.${host.replace(/^www\./, "")}/`;

  return (
    <>
      <link rel="stylesheet" href={FONTS_HREF} precedence="default" />
      <CardsEditor orgSlug={slug} orgName={org.name} doc={doc} items={live ? feed : SAMPLE_ITEMS} live={live} viewUrl={viewUrl} />
    </>
  );
}
