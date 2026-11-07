import Link from "next/link";
import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { getGuides, getSiteSections } from "@/lib/data";
import { toPlainText } from "@/lib/format";
import { listTours } from "@/lib/tours";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `Who leads the walks, how a tour works, and what ${siteConfig.orgName} is part of.`,
};

export const dynamic = "force-dynamic";

/**
 * About (2026-11-02), after art-auction's About page (apps/art-auction/src/app/about):
 * a title and a one-line lede, then sections that are each a small kicker, a
 * header with a rule, the site's own plain words, an optional "Visit …" link
 * and an optional picture beside the text. Names are the headers.
 *
 * Every sentence comes from what the site already says (home and tours copy,
 * the guides' own profiles, the tours themselves) or from the brief. Nothing
 * is invented. Sections that need Dana's words are PLACEHOLDERS: editors see
 * them marked "Dana to write"; visitors do not see them at all (as on
 * art-auction, where an empty section is hidden from the public).
 */

interface Section {
  id: string;
  kicker: string | null;
  title: string;
  /** Plain paragraphs, or null for a placeholder. */
  body: React.ReactNode | null;
  /** What Dana is asked to write, shown to editors while `body` is null. */
  placeholder?: string;
  link?: { href: string; label: string } | null;
  media?: { url: string; alt: string } | null;
}

export default async function AboutPage() {
  const [guides, sections, tours, viewer] = await Promise.all([
    getGuides(),
    getSiteSections(),
    listTours(),
    getViewer().catch(() => null),
  ]);
  const editor = Boolean(viewer?.canEdit);
  // Site copy an editor already wrote in /manage/pages ("about"), when there is any.
  const about = sections.about;

  const rows: Section[] = [
    {
      id: "company",
      kicker: siteConfig.city,
      title: siteConfig.orgName,
      body: (
        <>
          {about?.body ? <p>{about.body}</p> : null}
          <p>Guided walks and experiences in {siteConfig.city}. Small groups, on foot, led by people who live here: unhurried routes, and places the guidebooks skip.</p>
          {tours.length > 0 && (
            <>
              <p>The walks on offer now:</p>
              <ul className="list-disc space-y-1 pl-5">
                {tours.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tours/${t.slug}`} className="underline underline-offset-4">
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ),
      link: { href: "/tours", label: "See every tour" },
    },
    {
      id: "story",
      kicker: "How it began",
      title: "Our story",
      body: null,
      placeholder: "Dana to write: how the company started, and why these walks. A few sentences in your own words.",
    },
    ...guides.map((g): Section => ({
      id: `guide-${g.slug}`,
      kicker: g.roleTitle ?? "Guide",
      title: g.displayName,
      // A guide is always listed; without a bio, the name, photo and link stand alone.
      body: g.bio ? <p>{toPlainText(g.bio, 700)}</p> : <></>,
      placeholder: `${g.displayName}: a short bio is missing from the profile (Center → profile).`,
      link: { href: `/about/${g.slug}`, label: `More about ${g.displayName.split(/\s+/)[0]}` },
      media: g.photoUrl ? { url: g.photoUrl, alt: g.displayName } : null,
    })),
    {
      id: "how",
      kicker: "Choose · Book · Meet",
      title: "How a tour works",
      body: (
        <>
          <p>Every tour page shows the route, stop by stop, with a map and street-level views, so you know what to expect.</p>
          <p>Pick a date, say how many you are, and pay by card. Your ticket is a link in your email; no account is needed.</p>
          <p>Your guide is at the meeting point at the time on your ticket. Rain or shine; the pace is yours.</p>
        </>
      ),
    },
    {
      id: "experiences",
      kicker: "With the artists",
      title: "Experiences",
      body: (
        <p>
          Time with the artists we work with: a studio visit, a workshop, a performance. Some happen here, some online. Ask about one and
          we arrange it with you.
        </p>
      ),
      link: { href: "/experiences", label: "See the experiences" },
    },
    {
      id: "pictures",
      kicker: "Maps, films and street views",
      title: "The pictures on this site",
      body: (
        <>
          <p>
            The route maps are drawn from OpenStreetMap data on OpenFreeMap tiles. The street-level views come from Google Street View.
          </p>
          <p>
            The short aerial films fly over Google&apos;s 3D map of the city and are shown whole, with Google&apos;s credit: they are for
            promotional purposes only.
          </p>
        </>
      ),
    },
    {
      id: "network",
      kicker: "The platform",
      title: "Elkdonis Arts Collective",
      body: <p>{siteConfig.orgName} is part of the Elkdonis Arts Collective network.</p>,
      link: { href: process.env.NEXT_PUBLIC_ELKDONIS_ARTS_URL ?? "https://elkdonis-arts.org", label: "Visit elkdonis-arts.org" },
    },
    {
      id: "contact",
      kicker: "Questions",
      title: "Contact",
      body: null,
      placeholder: "Dana to confirm: the email or phone number visitors should use, and the languages the tours are given in.",
    },
  ];

  const shown = rows.filter((r) => r.body || editor);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-12">
      <h1 className="font-serif text-5xl italic leading-none sm:text-6xl">{about?.title ?? "About"}</h1>
      <p className="mt-4 max-w-[62ch] text-lg text-muted-foreground">
        Who leads the walks, how a tour works, and what {siteConfig.orgName} is part of.
      </p>

      <div className="mt-16 flex flex-col gap-16">
        {shown.map((s) => (
          <section key={s.id} id={s.id} className="flex flex-wrap items-start gap-x-14 gap-y-8">
            <div className="min-w-0 max-w-[760px] flex-[999_1_520px]">
              {s.kicker && (
                <p className="mb-1.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[hsl(var(--primary))]">{s.kicker}</p>
              )}
              <h2 className="border-b border-[hsl(var(--primary))] pb-2 font-serif text-3xl">{s.title}</h2>
              {s.body ? (
                <div className="mt-5 space-y-3 text-[1.05rem] leading-relaxed">{s.body}</div>
              ) : (
                <p className="mt-5 border border-dashed border-[hsl(var(--primary))] p-4 text-sm">
                  <strong>Placeholder, not shown to visitors.</strong> {s.placeholder}
                </p>
              )}
              {s.link && (s.body || editor) ? (
                <p className="mt-3 text-[0.95rem]">
                  <a href={s.link.href} className="underline underline-offset-4">
                    {s.link.label} →
                  </a>
                </p>
              ) : null}
            </div>
            {s.media && (
              <figure className="m-0 min-w-0 flex-[0_1_320px] max-sm:basis-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.media.url} alt={s.media.alt} loading="lazy" className="block h-auto w-full" />
              </figure>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
