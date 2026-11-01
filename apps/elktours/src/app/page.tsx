import Link from "next/link";
import { TourCard } from "@/components/tours/tour-card";
import { getGuides, getSiteSections } from "@/lib/data";
import { listTours, nextDepartures } from "@/lib/tours";
import { siteConfig } from "@/config/site";

/**
 * Landing page: the featured tour (pinned, else the newest), the rest of the
 * tours, how booking works, and the guides. Copy for the hero and the
 * "how it works" band comes from org_site_sections (/manage/pages) with
 * defaults here.
 */
export default async function HomePage() {
  const [tours, guides, sections] = await Promise.all([listTours(), getGuides().catch(() => []), getSiteSections()]);
  const next = await nextDepartures(tours.map((t) => t.id));
  const [lead, ...rest] = tours;
  const hero = sections.hero ?? {};

  return (
    <>
      <section className="relative overflow-hidden">
        {lead?.coverImageUrl && (
          <div className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lead.coverImageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          </div>
        )}
        <div className="mx-auto max-w-6xl px-5 pt-28 pb-16 sm:pt-40">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
            {hero.title ?? "Walk Paris with someone who lives here."}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {hero.body ?? "Small groups, unhurried routes, places the guidebooks skip. Choose a tour, pick a date, and you are booked."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tours" className="bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">See the tours</Link>
            {lead && (
              <Link href={`/tours/${lead.slug}`} className="border border-border bg-background/80 px-5 py-3 text-sm backdrop-blur">
                {lead.title}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-3xl">Tours</h2>
          <Link href="/tours" className="text-sm underline underline-offset-4">All tours</Link>
        </div>
        {tours.length === 0 ? (
          <p className="mt-6 text-muted-foreground">The first tours are being written.</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[lead!, ...rest].slice(0, 6).map((t) => (
              <TourCard key={t.id} tour={t} next={next.get(t.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
          {[
            ["Choose", "Every tour page shows the route, stop by stop, with a map and street-level views so you know what to expect."],
            ["Book", "Pick a date, say how many you are, and pay by card. Your ticket is a link in your email; no account needed."],
            ["Meet", "Your guide is at the meeting point at the time on your ticket. Rain or shine; the pace is yours."],
          ].map(([title, body], i) => (
            <div key={title}>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">0{i + 1}</p>
              <h3 className="mt-2 font-serif text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {guides.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">Your guides</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <li key={g.userId} className="flex gap-4">
                {g.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photoUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="size-16 shrink-0 rounded-full bg-muted" />
                )}
                <div>
                  <p className="font-medium">{g.displayName}</p>
                  {g.roleTitle && <p className="text-sm text-muted-foreground">{g.roleTitle}</p>}
                  {g.bio && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{g.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
