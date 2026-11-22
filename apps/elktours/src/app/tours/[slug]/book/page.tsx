import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookView } from "@/components/mobile/book-view";
import { BackButton } from "@/components/mobile";
import "@/blocks/mobile/flow.css";
import { getTourBySlug, formatDeparture } from "@/lib/tours";
import { listTourSlots, quoteBooking } from "@/lib/tour-slots";
import { getViewer } from "@/lib/auth";
import { getBookerDefaults } from "@/lib/booker";

export const metadata: Metadata = { title: "Book", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Screen 05 (G3b): quote first (refuses closed, full or cancelled dates in Jay's words), then the pay form. */
export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ slot?: string; party?: string }> }) {
  const { slug } = await params;
  const { slot, party } = await searchParams;
  const tour = await getTourBySlug(slug);
  if (!tour) notFound();
  const n = Math.max(1, Math.floor(Number(party) || 1));
  const quote = slot ? await quoteBooking({ slotId: slot, partySize: n }) : ({ ok: false, error: "Pick a date first." } as const);

  if (quote.ok === false) {
    return (
      <div className="elk-m m-flow">
        <div className="m-flow-top">
          <BackButton href={`/tours/${slug}/dates`} />
          <div className="m-flow-top-text"><span className="m-kicker">Booking</span><span className="m-flow-top-title">{tour.title}</span></div>
        </div>
        <p className="m-flow-error" role="alert">{quote.error}</p>
        <p className="m-flow-empty"><Link href={`/tours/${slug}/dates${slot ? `?slot=${slot}` : ""}`}>Choose another date</Link></p>
      </div>
    );
  }

  const [slots, viewer, booker] = await Promise.all([listTourSlots(tour.id).catch(() => []), getViewer().catch(() => null), getBookerDefaults().catch(() => ({ name: null, email: null }))]);
  const s = slots.find((x) => x.slotId === quote.slotId);
  return (
    <BookView
      slug={tour.slug}
      title={tour.title}
      slotId={quote.slotId}
      party={quote.partySize}
      whenLabel={s ? formatDeparture(s.startsAt, { withYear: true }) : ""}
      guide={s?.guide?.name ?? null}
      meetAt={tour.location}
      perPersonMinor={quote.perPersonMinor}
      totalMinor={quote.totalMinor}
      currency={quote.currency}
      policyText={quote.policyText}
      ruleText={quote.ruleText}
      defaultName={booker.name ?? ""}
      defaultEmail={booker.email ?? viewer?.email ?? ""}
    />
  );
}
