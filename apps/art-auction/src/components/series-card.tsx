import Link from "next/link";
import type { AuctionSeries } from "@elkdonis/commerce/queries";

const PHASE: Record<string, string> = {
  announced: "Bidding opens",
  silent: "Bidding open · closes",
  live: "Live close under way",
  closed: "Closed",
};

/** The featured series on the marketplace home: its card, phase and the link to its landing page. */
export function SeriesCard({ series }: { series: AuctionSeries }) {
  const when = series.phase === "announced" ? series.silentOpensAt : series.liveAt;
  return (
    <Link
      href={`/series/${series.slug}`}
      className="grid gap-6 rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/30 md:grid-cols-[14rem_1fr]"
    >
      <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
        {series.card.imageUrl && <img src={series.card.imageUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-col">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{series.card.eyebrow ?? "Auction series"}</p>
        <h2 className="mt-1 font-serif text-3xl leading-tight tracking-tight">{series.title}</h2>
        {series.subtitle && <p className="mt-1 text-muted-foreground">{series.subtitle}</p>}
        {series.card.blurb && <p className="mt-3 max-w-2xl text-sm">{series.card.blurb}</p>}
        <p className="mt-auto pt-4 text-sm">
          <strong>{PHASE[series.phase] ?? ""}</strong>
          {when && series.phase !== "closed" && series.phase !== "live"
            ? ` ${new Date(when).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" })}`
            : ""}
          {series.presenterName ? ` · presented by ${series.presenterName}` : ""}
          <span className="ml-3 underline underline-offset-4">See the series →</span>
        </p>
      </div>
    </Link>
  );
}
