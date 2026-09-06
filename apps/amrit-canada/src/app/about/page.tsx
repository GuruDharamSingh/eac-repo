import Link from "next/link";
import type { Metadata } from "next";
import { getGuides, getSiteSections } from "@/lib/data";
import { toPlainText } from "@/lib/format";

export const metadata: Metadata = {
  title: "About",
  description: "The teachers and guides of Amrit Canada.",
};

export default async function AboutPage() {
  const [guides, sections] = await Promise.all([getGuides(), getSiteSections()]);
  const about = sections.about;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-serif text-4xl">{about?.title ?? "About"}</h1>
      {about?.body && <p className="mt-4 max-w-2xl leading-relaxed">{about.body}</p>}

      <hr className="saffron-divider" />
      <h2 className="font-serif text-2xl">Teachers and guides</h2>

      {guides.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          No profiles have been published yet.
        </p>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {guides.map((guide) => (
            <li key={guide.userId} className="card-natural p-6">
              <div className="flex items-start gap-4">
                {guide.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={guide.photoUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-full border-2 border-[#f4c430] object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/20 font-serif text-xl"
                  >
                    {guide.displayName.charAt(0)}
                  </span>
                )}
                <div>
                  <h3 className="font-serif text-xl">
                    <Link href={`/about/${guide.slug}`} className="underline-offset-4 hover:underline">
                      {guide.displayName}
                    </Link>
                  </h3>
                  {guide.roleTitle && (
                    <p className="mt-0.5 text-sm italic text-[hsl(var(--terracotta-deep))]">{guide.roleTitle}</p>
                  )}
                </div>
              </div>
              {guide.bio && (
                <p className="mt-4 text-sm leading-relaxed">{toPlainText(guide.bio, 220)}</p>
              )}
              <Link
                href={`/about/${guide.slug}`}
                className="mt-4 inline-block text-sm underline underline-offset-4"
              >
                Read more
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
