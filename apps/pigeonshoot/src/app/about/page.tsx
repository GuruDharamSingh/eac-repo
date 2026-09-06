import Link from "next/link";
import type { Metadata } from "next";
import { getSiteSections, getSiteStats } from "@/lib/data";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const [sections, stats] = await Promise.all([getSiteSections(), getSiteStats()]);
  const copy = sections.about ?? {};

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="font-display text-3xl font-bold">{copy.title ?? "What is this"}</h1>
      <div
        className="mt-4 leading-relaxed [&_p]:mt-3"
        dangerouslySetInnerHTML={{
          __html:
            copy.body ??
            "<p>A field guide to the birds nobody looks at. Anyone can add to it.</p>",
        }}
      />

      <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-border py-6 text-center">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cards</dt>
          <dd className="font-display text-2xl font-bold">{stats.cards}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Species</dt>
          <dd className="font-display text-2xl font-bold">{stats.species}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Areas</dt>
          <dd className="font-display text-2xl font-bold">{stats.areas}</dd>
        </div>
      </dl>

      <h2 className="mt-10 font-display text-xl font-semibold">Your photos</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Every uploaded photo is decoded and re-encoded before it is stored, which removes the
        location, camera and owner details your phone writes into the file. The map pin is
        whatever you confirm on the map — nothing else. If you photographed a bird from your own
        window, tick &ldquo;blur this location&rdquo; and the public pin moves about 100 metres.
      </p>

      <h2 className="mt-8 font-display text-xl font-semibold">Accounts</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        You don&apos;t need one. Cards you submit are tied to this browser, so clearing cookies
        loses the link between you and them.{" "}
        <Link href="/login?mode=signup" className="text-primary hover:underline">
          An account
        </Link>{" "}
        keeps them.
      </p>

      <p className="mt-10 text-sm">
        <Link href="/rubric" className="text-primary hover:underline">
          How cards are rated →
        </Link>
      </p>
    </div>
  );
}
