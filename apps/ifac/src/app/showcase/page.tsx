import type { Metadata } from "next";
import Link from "next/link";
import "./showcase.css";
import { getShowcase, getShowcaseCardSize, listShowcaseSections, canModerateOrg } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { threadHref } from "@/lib/gather";
import { ShowcaseFeed, type ShowcaseCard } from "@/components/showcase/ShowcaseFeed";

export const metadata: Metadata = {
  title: "Showcase — IFAC",
  description: "Everything the collective has published: writing, gatherings, and work by its members.",
};
export const dynamic = "force-dynamic";

/**
 * The collective's published work, as a digest.
 *
 * An old-school blog index on purpose (owner, 2026-09-19): a slim strip of
 * navigation, the pinned piece as the one hero, a small index of the forum's
 * categories down the side, and then simply the work — a meeting, a piece of
 * writing, an artwork, a member's entry — newest first. No tiles, no bands,
 * nothing that opens in a popup. It reads like a shelf and links out to the
 * thing itself.
 *
 * Public: every item is already PUBLIC and published (the query in services'
 * showcase.ts admits nothing else), so this page needs no gate. A signed-in
 * guide additionally sees one control — how big the cards are — because the
 * people who run the site should arrange it from the site.
 */
export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; page?: string }>;
}) {
  const { section: sectionParam, page: pageParam } = await searchParams;
  const section = sectionParam?.trim() || null;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const perPage = 24;

  const viewer = await getViewer();
  const [{ lead, items, more }, feeds, size, canArrange] = await Promise.all([
    getShowcase(siteConfig.orgId, { section, limit: perPage, offset: (page - 1) * perPage }),
    listShowcaseSections(siteConfig.orgId).catch(() => []),
    getShowcaseCardSize(siteConfig.orgId),
    viewer ? canModerateOrg(viewer.userId, siteConfig.orgId) : Promise.resolve(false),
  ]);

  const feedName = (slug: string | null) =>
    slug ? (feeds.find((f) => f.slug === slug)?.name ?? slug) : null;

  const toCard = (item: Awaited<ReturnType<typeof getShowcase>>["items"][number]): ShowcaseCard => ({
    id: item.id,
    title: item.title,
    kind: item.kind,
    href: threadHref({ kind: item.kind, slug: item.slug ?? "", id: item.id }),
    excerpt: item.excerpt,
    coverImageUrl: item.coverImageUrl,
    sectionName: feedName(item.section),
    at: item.publishedAt ?? item.scheduledAt,
    authorName: item.authorName,
    authorHref: item.authorSlug ? `/artists/${item.authorSlug}` : null,
  });

  const current = feeds.find((f) => f.slug === section) ?? null;

  return (
    <div className="ifac-sc">
      {/* The slim strip. Not SiteHeader: that carries the mark, two rows of
          links and the social rank, which is a page of chrome above a page
          that is meant to be a shelf. */}
      <header className="ifac-sc-bar">
        <Link className="ifac-sc-bar__home" href="/">
          {siteConfig.shortName}
        </Link>
        <nav className="ifac-sc-bar__nav" aria-label="Site">
          <Link href="/#artists">Artists</Link>
          <Link href="/#dealers">Dealers</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/hub">Hub</Link>
        </nav>
      </header>

      <div className="ifac-sc-head">
        <p className="ifac-sc-kicker">{current ? "Section" : "Everything published"}</p>
        <h1 className="ifac-sc-h1">{current ? current.name : "Showcase"}</h1>
        {!current && (
          <p className="ifac-sc-sub">
            Writing, gatherings and work published by the collective and its members.
          </p>
        )}
      </div>

      <div className="ifac-sc-body">
        {/* The index. The org's own feeds — the same categories the forum
            uses — so the shelf and the conversation agree on what the
            sections of this collective are. */}
        <aside className="ifac-sc-index" aria-label="Sections">
          <ul>
            <li>
              <Link href="/showcase" aria-current={!section ? "page" : undefined} className={!section ? "is-on" : undefined}>
                All
              </Link>
            </li>
            {feeds.map((f) => (
                <li key={f.slug}>
                <Link
                  href={`/showcase?section=${encodeURIComponent(f.slug)}`}
                  aria-current={section === f.slug ? "page" : undefined}
                  className={section === f.slug ? "is-on" : undefined}
                >
                  {f.name} <span className="ifac-sc-index__n">{f.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main className="ifac-sc-main">
          {/* The hero is whatever is pinned. Nothing pinned, no hero — the
              list simply starts, which is the right empty state for a digest. */}
          {lead && (
            <article className="ifac-sc-lead">
              <a href={threadHref({ kind: lead.kind, slug: lead.slug ?? "", id: lead.id })}>
                {lead.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ifac-sc-lead__cover" src={lead.coverImageUrl} alt="" />
                )}
                <p className="ifac-sc-lead__meta">
                  Pinned{feedName(lead.section) ? ` · ${feedName(lead.section)}` : ""}
                </p>
                <h2 className="ifac-sc-lead__title">{lead.title}</h2>
                {lead.excerpt && <p className="ifac-sc-lead__excerpt">{lead.excerpt}</p>}
              </a>
            </article>
          )}

          {items.length === 0 && !lead ? (
            <p className="ifac-sc-empty">
              {section ? "Nothing in this section yet." : "Nothing published yet."}
            </p>
          ) : (
            <ShowcaseFeed items={items.map(toCard)} size={size} canArrange={canArrange} />
          )}

          {(page > 1 || more) && (
            <nav className="ifac-sc-pager" aria-label="Pages">
              {page > 1 && (
                <Link href={`/showcase?${section ? `section=${encodeURIComponent(section)}&` : ""}page=${page - 1}`}>
                  ← Newer
                </Link>
              )}
              {more && (
                <Link href={`/showcase?${section ? `section=${encodeURIComponent(section)}&` : ""}page=${page + 1}`}>
                  Older →
                </Link>
              )}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
