import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeriesBySlug } from "@elkdonis/commerce/queries";
import { canEditSeries } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { LiveBoard } from "./live-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return { title: s ? `${s.title} — live` : "Live auction" };
}

/**
 * The presenter page (ORG_STORE_BRIEF R5): the lot next to close, its
 * countdown, the bid feed, and the lots after it. Polls the live route; the
 * board advances itself as lots close. Anyone may watch; bidding happens on
 * the lot pages.
 */
export default async function SeriesLivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  // Editors preview the board before the series is published.
  const userId = await getCurrentUserId();
  const editor = userId ? await canEditSeries(userId, series.id) : false;
  if (series.status !== "published" && !editor) notFound();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {series.status !== "published" && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm">Preview: this series is a draft, so only its editors see this board.</p>
      )}
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Live close</p>
      <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">{series.title}</h1>
      <LiveBoard slug={series.slug} />
    </main>
  );
}
