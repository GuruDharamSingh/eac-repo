import Link from "next/link";
import type { TourDeparture } from "@elkdonis/commerce/server";
import { formatDeparture, formatDuration, formatPrice, type Tour } from "@/lib/tours";

/** A tour on the index and the landing page. */
export function TourCard({ tour, next }: { tour: Tour; next?: TourDeparture | null }) {
  const length = formatDuration(tour.durationMinutes);
  return (
    <Link href={`/tours/${tour.slug}`} className="tour-card group block overflow-hidden border border-border bg-card">
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {tour.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tour.coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <div className="p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          {[length, tour.details.languages[0]].filter(Boolean).join(" · ") || "Tour"}
        </p>
        <h3 className="mt-1 font-serif text-xl leading-snug group-hover:underline">{tour.title}</h3>
        {tour.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{tour.excerpt}</p>}
        <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">{formatPrice(tour.price, tour.currency)}</span>
          <span className="text-muted-foreground">
            {next ? `Next: ${formatDeparture(next.startsAt)}` : "Dates coming"}
          </span>
        </div>
      </div>
    </Link>
  );
}
