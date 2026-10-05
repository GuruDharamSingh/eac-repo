import Link from "next/link";
import { avatarSrc, type AuctionHost } from "@/lib/auction-hosts";

function HostCard({ org }: { org: AuctionHost }) {
  return (
    <Link
      href={`/about#${org.slug}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/40"
    >
      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-wall ring-1 ring-border">
        {org.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc(org.avatarUrl, 192)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-serif text-xl text-ink-faint">
            {org.name.charAt(0)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">
          {org.role}
        </span>
        <span className="mt-0.5 block font-serif text-lg leading-snug underline-offset-4 group-hover:underline">
          {org.name}
        </span>
      </span>
    </Link>
  );
}

/**
 * The opening of the front page: whose auction this is.
 *
 * International Fine Art Collectors runs the auction and Elkdonis Arts
 * Collective hosts it. Each card goes to that organisation's entry on /about.
 */
export function AuctionSplash({ presenter, host }: { presenter: AuctionHost; host: AuctionHost }) {
  return (
    <section aria-labelledby="auction-title" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          {presenter.name} presents
        </p>
        <h1
          id="auction-title"
          className="mt-3 max-w-4xl font-serif text-4xl leading-[1.08] tracking-tight md:text-6xl"
        >
          The IFAC Art Auction
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Hosted by {host.name}. Three weeks of silent bidding on original work,
          closing with a live online auction.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <HostCard org={presenter} />
          <HostCard org={host} />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/about" className="underline underline-offset-4">
            About the auction →
          </Link>
        </p>
      </div>
    </section>
  );
}
