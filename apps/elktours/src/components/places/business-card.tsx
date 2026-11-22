import type { PlaceBusinessSummary } from "@/lib/catalogue-types";

/**
 * The associated business of a place, as a small org card (round 7; brief
 * docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md, rules 1-3).
 *
 * Facts only: kind, address, hours, official website (confirmed websites
 * only; the read already drops pending ones), with the licence lines the
 * facts came with. A shell always carries its marking ("Unclaimed · listed
 * by …") and links to its directory page, where "Is this your business?"
 * and "Request removal" live. No buy, book or pay controls, no vouches and
 * no verified badge, for any status. Server- and client-safe.
 */

/** "https://www.stohrer.fr/" → "stohrer.fr" */
function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function businessAddress(b: Pick<PlaceBusinessSummary, "streetAddress" | "postalCode" | "city">): string | null {
  const tail = [b.postalCode, b.city].filter(Boolean).join(" ");
  return [b.streetAddress, tail].filter(Boolean).join(", ") || null;
}

/**
 * The one-line card for tour stops (2026-11-19, Justin: declutter the route).
 * Name, kind, hours and website on one line; the address, the rule-2 marking
 * ("Unclaimed listing · listed by …" plus "Is this your business?") and the
 * licence lines (OSM is ODbL, it needs its credit) sit behind "Details". They
 * stay on the page, one click away, because the brief requires both on every
 * surface that shows a shell (docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md,
 * rules 1-2; lib/catalogue-types.ts PlaceBusinessSummary). The summary keeps
 * an "Unclaimed" word visible for shells, so the marking is never fully folded.
 */
function BusinessLine({ business: b }: { business: PlaceBusinessSummary }) {
  const unclaimed = b.status === "shell";
  const address = businessAddress(b);
  const kind = b.categoryLabel ?? b.category;
  const hasDetails = Boolean(address || (unclaimed && (b.marking || b.pageUrl)) || b.attributions.length > 0);
  const sep = <span aria-hidden className="opacity-40">·</span>;
  return (
    <div className="rounded-md border border-border px-3 py-2 text-xs" data-business-status={b.status}>
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-snug">
        <span className="font-medium">
          {b.pageUrl ? (
            <a href={b.pageUrl} className="underline-offset-4 hover:underline">
              {b.name}
            </a>
          ) : (
            b.name
          )}
        </span>
        {kind ? <span className="opacity-75">{kind}{b.relation === "hosts" ? " (inside)" : ""}</span> : null}
        {b.openingHours ? (
          <>
            {sep}
            <span className="break-words">{b.openingHours}</span>
          </>
        ) : null}
        {b.website ? (
          <>
            {sep}
            <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
              {host(b.website)} ↗
            </a>
          </>
        ) : null}
      </p>
      {hasDetails ? (
        <details className="group mt-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.65rem] uppercase tracking-wider opacity-70 hover:opacity-100 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
            Details{unclaimed ? <span className="opacity-80"> · Unclaimed</span> : null}
          </summary>
          <div className="mt-1.5 space-y-1 pl-3">
            {address ? (
              <p>
                <span className="opacity-70">Address </span>
                {address}
              </p>
            ) : null}
            {unclaimed && (b.marking || b.pageUrl) ? (
              <p className="text-[0.65rem] opacity-80">
                {b.marking}
                {b.marking && b.pageUrl ? " · " : null}
                {b.pageUrl ? (
                  <a href={b.pageUrl} className="underline underline-offset-4">
                    Is this your business?
                  </a>
                ) : null}
              </p>
            ) : null}
            {b.attributions.length > 0 ? <p className="text-[0.65rem] opacity-70">{b.attributions.join(" · ")}</p> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function BusinessCard({
  business: b,
  compact = false,
  line = false,
}: {
  business: PlaceBusinessSummary;
  compact?: boolean;
  /** One line plus a "Details" disclosure (tour stops). Other callers keep the full card. */
  line?: boolean;
}) {
  // A removed listing is never shown (its page answers 410); a former operator is history, not a card.
  if (b.status === "removed" || b.relation === "former") return null;
  if (line) return <BusinessLine business={b} />;
  const unclaimed = b.status === "shell";
  const address = businessAddress(b);
  const text = compact ? "text-xs" : "text-sm";
  return (
    <div className={`rounded-md border border-border p-3 ${text}`} data-business-status={b.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium">
          {b.pageUrl ? (
            <a href={b.pageUrl} className="underline-offset-4 hover:underline">
              {b.name}
            </a>
          ) : (
            b.name
          )}
          {b.categoryLabel ?? b.category ? <span className="ml-2 font-normal opacity-75">{b.categoryLabel ?? b.category}</span> : null}
          {b.relation === "hosts" ? <span className="ml-2 font-normal opacity-75">(inside)</span> : null}
        </p>
        {unclaimed && b.marking ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider opacity-80">{b.marking}</span>
        ) : null}
      </div>
      {address || b.openingHours || b.website ? (
        <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          {address ? (
            <>
              <dt className="opacity-70">Address</dt>
              <dd>{address}</dd>
            </>
          ) : null}
          {b.openingHours ? (
            <>
              <dt className="opacity-70">Hours</dt>
              <dd className="break-words">{b.openingHours}</dd>
            </>
          ) : null}
          {b.website ? (
            <>
              <dt className="opacity-70">Website</dt>
              <dd>
                <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                  {host(b.website)} ↗
                </a>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {(unclaimed && b.pageUrl) || b.attributions.length > 0 ? (
        <p className="mt-1.5 text-[0.65rem] opacity-70">
          {unclaimed && b.pageUrl ? (
            <a href={b.pageUrl} className="underline underline-offset-4">
              Is this your business?
            </a>
          ) : null}
          {unclaimed && b.pageUrl && b.attributions.length > 0 ? " · " : null}
          {b.attributions.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/** The current businesses of a place (primary first), for cards and stops. */
export function PlaceBusinesses({ businesses, compact }: { businesses: PlaceBusinessSummary[] | null | undefined; compact?: boolean }) {
  const shown = (businesses ?? []).filter((b) => b.status !== "removed" && b.relation !== "former");
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2">
      {shown.map((b) => (
        <BusinessCard key={b.userId} business={b} compact={compact} />
      ))}
    </div>
  );
}
