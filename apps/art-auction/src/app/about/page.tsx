import type { Metadata } from "next";
import { getAuctionHosts, avatarSrc, type AuctionHost } from "@/lib/auction-hosts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About the auction" };

function Entry({ org, children }: { org: AuctionHost; children?: React.ReactNode }) {
  return (
    <section id={org.slug} aria-labelledby={`${org.slug}-name`} className="scroll-mt-24 border-t border-border py-10">
      <div className="flex items-center gap-5">
        <span className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-wall ring-1 ring-border">
          {org.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc(org.avatarUrl, 256)} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-faint">
            {org.role}
          </p>
          <h2 id={`${org.slug}-name`} className="font-serif text-2xl tracking-tight">
            {org.name}
          </h2>
        </div>
      </div>
      {org.bio && <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">{org.bio}</p>}
      {children}
      <p className="mt-4 text-sm">
        <a href={org.url} className="underline underline-offset-4">
          Visit {org.name} →
        </a>
      </p>
    </section>
  );
}

export default async function AboutPage() {
  const { presenter, host } = await getAuctionHosts();
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="font-serif text-4xl tracking-tight md:text-5xl">About the auction</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        {presenter.name} runs the auction. {host.name} hosts it.
      </p>
      <div className="mt-10">
        <Entry org={presenter} />
        <Entry org={host} />
      </div>
    </main>
  );
}
