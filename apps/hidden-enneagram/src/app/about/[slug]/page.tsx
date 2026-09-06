import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getGuideBySlug } from "@/lib/data";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.displayName,
    description: guide.roleTitle ?? plain(guide.bio),
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[720px] px-6 py-16 font-sans">
        <Link
          href="/about"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground no-underline hover:text-foreground"
        >
          ← About
        </Link>

        <header className="mt-8 flex flex-wrap items-start gap-6">
          {guide.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={guide.photoUrl}
              alt=""
              className="size-28 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-28 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-3xl text-primary"
            >
              {guide.displayName.charAt(0)}
            </span>
          )}
          <div>
            <h1 className="font-serif text-4xl font-medium">{guide.displayName}</h1>
            {guide.roleTitle && <p className="mt-1 text-primary">{guide.roleTitle}</p>}
            {guide.city && (
              <p className="mt-0.5 text-sm text-muted-foreground">{guide.city}</p>
            )}
          </div>
        </header>

        {guide.bio && (
          <div className="prose-enneagram mt-10 text-[17px]">
            {guide.bio.includes("<") ? (
              <div dangerouslySetInnerHTML={{ __html: guide.bio }} />
            ) : (
              guide.bio.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
            )}
          </div>
        )}

        {guide.socialLinks.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-3">
            {guide.socialLinks
              .filter((l) => l.url)
              .map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm no-underline hover:border-primary/60"
                  >
                    {link.label ?? link.url}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
          </ul>
        )}
      </main>
    </>
  );
}
