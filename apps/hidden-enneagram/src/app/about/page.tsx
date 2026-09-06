import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { getGuides, getSiteSections } from "@/lib/data";

export const metadata: Metadata = {
  title: "About",
  description: "Who teaches here, and how the work is approached.",
};

/**
 * The About page, in amrit-canada's shape: editable site copy at the top, then
 * the published teacher profiles beneath it.
 *
 * Both sources on purpose. The copy lives in org_site_sections so it exists
 * even before anyone has an account; a profile hangs off a real user row
 * (migration 073's rule), so it appears once that account is published.
 */
export default async function AboutPage() {
  const [guides, sections] = await Promise.all([getGuides(), getSiteSections()]);
  const about = sections.about;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[880px] px-6 py-16 font-sans">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          {about?.roleTitle ?? "The Hidden Enneagram"}
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium leading-[1.05]">
          {about?.title ?? "About"}
        </h1>
        {about?.location && (
          <p className="mt-2 text-sm text-muted-foreground">{about.location}</p>
        )}

        {about?.body && (
          <div className="prose-enneagram mt-8 max-w-[620px] text-[17px]">
            {about.body.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {guides.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
            <h2 className="font-serif text-2xl font-medium">Who teaches here</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {guides.map((guide) => (
                <li key={guide.userId} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-start gap-4">
                    {guide.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={guide.photoUrl}
                        alt=""
                        className="size-16 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-xl text-primary"
                      >
                        {guide.displayName.charAt(0)}
                      </span>
                    )}
                    <div>
                      <h3 className="font-serif text-xl">
                        <Link
                          href={`/about/${guide.slug}`}
                          className="no-underline underline-offset-4 hover:underline"
                        >
                          {guide.displayName}
                        </Link>
                      </h3>
                      {guide.roleTitle && (
                        <p className="mt-0.5 text-sm text-primary">{guide.roleTitle}</p>
                      )}
                      {guide.city && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{guide.city}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
