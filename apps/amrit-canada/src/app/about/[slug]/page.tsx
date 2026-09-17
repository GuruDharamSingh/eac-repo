import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { ThreadCard } from "@/components/thread-card";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { getGuideBySlug, getGuideStore, getThreadsByAuthor } from "@/lib/data";
import { siteConfig } from "@/config/site";
import { toPlainText } from "@/lib/format";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.displayName,
    description: guide.roleTitle ?? toPlainText(guide.bio, 160),
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  // Everything they've published here — the substance of the page. A teacher
  // page that's only a bio goes stale; one that lists their classes doesn't.
  const [threads, store] = await Promise.all([
    getThreadsByAuthor(guide.userId),
    getGuideStore(guide.userId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/about" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← About
      </Link>

      <header className="mt-6 flex flex-wrap items-start gap-6">
        {guide.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guide.photoUrl}
            alt=""
            className="size-28 shrink-0 rounded-full border-4 border-[#f4c430] object-cover shadow-[0_8px_24px_rgba(244,196,48,0.25)]"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-28 shrink-0 items-center justify-center rounded-full bg-primary/20 font-serif text-3xl"
          >
            {guide.displayName.charAt(0)}
          </span>
        )}
        <div>
          <h1 className="font-serif text-4xl">{guide.displayName}</h1>
          {guide.roleTitle && (
            <p className="mt-1 italic text-[hsl(var(--terracotta-deep))]">{guide.roleTitle}</p>
          )}
          {guide.city && <p className="mt-0.5 text-sm text-muted-foreground">{guide.city}</p>}
        </div>
      </header>

      {guide.bio && (
        <div className="prose-amrit mt-8 max-w-none">
          {guide.bio.includes("<") ? (
            <div dangerouslySetInnerHTML={{ __html: guide.bio }} />
          ) : (
            guide.bio.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
          )}
        </div>
      )}

      {guide.socialLinks.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-3">
          {guide.socialLinks
            .filter((l) => l.url)
            .map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent/40"
                >
                  {link.label ?? link.url}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
        </ul>
      )}

      {/* Their marketplace store — a window, not a checkout. Shown only when
          they have switched the section on for their profile (/account). */}
      {store && (
        <div className="mt-12">
          <hr className="saffron-divider" />
          <StoreShowcase
            store={store.store}
            artworks={store.artworks}
            marketplaceUrl={siteConfig.marketplaceUrl}
            from="amrit_canada"
            heading={`From ${guide.displayName.split(" ")[0]}’s store`}
            density="normal"
            className="mt-6"
          />
        </div>
      )}

      {threads.length > 0 && (
        <section className="mt-12">
          <hr className="saffron-divider" />
          <h2 className="font-serif text-2xl">With {guide.displayName.split(" ")[0]}</h2>
          <div className="mt-5 grid gap-5">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
