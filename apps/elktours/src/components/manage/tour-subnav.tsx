import Link from "next/link";

export type TourSubnavKey = "details" | "stops" | "assets" | "flyover" | "departures";

/**
 * The header and tab strip for a tour's own /manage pages, shared by the
 * query-tab page (/manage/tours/[id]?tab=…) and the route pages
 * (/stops, /assets, /flyover). Same look as the original strip.
 */
export function TourSubnav({
  tour,
  current,
  counts = {},
}: {
  tour: { id: string; slug: string; title: string; status: string };
  current: TourSubnavKey;
  counts?: Partial<Record<TourSubnavKey, number>>;
}) {
  const base = `/manage/tours/${tour.id}`;
  const label = (k: TourSubnavKey, text: string) => (counts[k] != null ? `${text} (${counts[k]})` : text);
  const tabs: Array<{ key: TourSubnavKey; label: string; href: string }> = [
    { key: "details", label: "Details", href: `${base}?tab=details` },
    { key: "stops", label: label("stops", "Stops"), href: `${base}/stops` },
    { key: "assets", label: label("assets", "Assets"), href: `${base}/assets` },
    { key: "flyover", label: "Fly-over", href: `${base}/flyover` },
    { key: "departures", label: label("departures", "Departures"), href: `${base}?tab=departures` },
  ];
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/manage/tours" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Tours</Link>
          <h2 className="mt-1 font-serif text-2xl">{tour.title}</h2>
        </div>
        <span className="flex gap-4 text-sm">
          <Link href={`${base}/notes`} className="underline underline-offset-4">Guide notes</Link>
          <Link href={`/tours/${tour.slug}`} className="underline underline-offset-4">
            {tour.status === "published" ? "View on site" : "Preview (draft)"}
          </Link>
        </span>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-3 py-2 text-sm ${current === t.key ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
