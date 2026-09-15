import * as React from "react";
import type { ForumWikiPageRow, ForumWikiSearchSpan } from "./connectors";
import { Layout, type PageProps } from "./pages";
import { Breadcrumb, Empty, PageHead, SectionTitle, Time } from "./parts";

// ============================================================================
// The wiki, as a section of the forum.
//
// A PEER of the boards rather than one of them. Wiki pages are excluded from
// listTopics and searchForum by kind, because a collectively edited reference
// page has no post #1 (plan decision 3b — the thread IS post #1) and replies
// would attach to something everyone rewrites. Discussion about a page is a
// real topic that references it: the Talk thread.
//
// Everything arrives already resolved through the wiki connectors, so this
// file holds no queries and no dependency on @elkdonis/services — same
// posture as the rest of forum-ui.
// ============================================================================

/**
 * Search matches come back as spans, never HTML, and are rendered as React
 * children so they are escaped. Wiki titles are not HTML-sanitised — only
 * trimmed — so highlighting one as markup would be an injection.
 */
function Spans({ spans, fallback }: { spans: ForumWikiSearchSpan[]; fallback: string }) {
  if (!spans || spans.length === 0) return <>{fallback}</>;
  return (
    <>
      {spans.map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

function Outline({
  pages,
  hrefPage,
}: {
  pages: ForumWikiPageRow[];
  hrefPage: (slug: string) => string | null;
}) {
  return (
    <ul className="gf-wiki-outline">
      {pages.map((p) => {
        const href = hrefPage(p.slug);
        return (
          <li key={p.id} style={{ paddingLeft: `${(p.depth ?? 0) * 14}px` }}>
            {href ? <a href={href}>{p.title}</a> : <span>{p.title}</span>}
            {p.excerpt && <span className="gf-wiki-gloss">{p.excerpt}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export async function WikiIndexPage({ connectors, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName, wiki } = connectors;
  if (!wiki) return null;

  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const [pages, hits] = await Promise.all([
    wiki.listPages(),
    q && wiki.search ? wiki.search(q) : Promise.resolve(null),
  ]);

  const hrefPage = (slug: string) => hrefs.wikiPage?.(slug) ?? null;
  const recent = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <Layout
      main={
        <>
          <Breadcrumb
            items={[
              { label: scope.kind === "network" ? "Boards" : siteName, href: hrefs.root() },
              { label: "Wiki" },
            ]}
          />
          <PageHead
            title="Wiki"
            sub={
              pages.length === 0
                ? "Nothing written yet."
                : `${pages.length} ${pages.length === 1 ? "page" : "pages"} · shared across the network`
            }
            aside={
              wiki.newHref?.() ? (
                <a className="gf-tool" href={wiki.newHref()!}>
                  New page
                </a>
              ) : undefined
            }
          />

          {wiki.search && (
            // Plain GET so search works without JavaScript, and lands back
            // here as ?q= rather than on a /wiki/search segment that would
            // shadow a page slugged "search".
            <form method="get" action={path} className="gf-wiki-search">
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Search the wiki"
                placeholder="Search titles, pages and definitions…"
              />
              <button type="submit">Search</button>
            </form>
          )}

          {hits && (
            <section>
              <SectionTitle>
                {hits.length === 0
                  ? `Nothing matches “${q}”`
                  : `${hits.length} ${hits.length === 1 ? "result" : "results"} for “${q}”`}
              </SectionTitle>
              {hits.length === 0 ? (
                <Empty>
                  Try fewer words.
                  {wiki.newHref?.(q) && (
                    <>
                      {" "}
                      <a href={wiki.newHref(q)!}>Write “{q}”</a> instead.
                    </>
                  )}
                </Empty>
              ) : (
                <ul className="gf-wiki-hits">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <a href={hrefPage(h.slug) ?? "#"}>
                        <Spans spans={h.titleSpans} fallback={h.title} />
                      </a>
                      {h.viaDefinition && <span className="gf-wiki-tag">definition</span>}
                      <p>
                        <Spans spans={h.snippetSpans} fallback="" />
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {pages.length === 0 ? (
            <Empty>
              A wiki grows by writing. Start with one page — a glossary, an
              index, a process note.
            </Empty>
          ) : (
            !hits && (
              <>
                <section>
                  <SectionTitle>Recently edited</SectionTitle>
                  <ul className="gf-wiki-recent">
                    {recent.map((p) => (
                      <li key={p.id}>
                        <a href={hrefPage(p.slug) ?? "#"}>{p.title}</a>
                        <Time at={p.updatedAt} />
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <SectionTitle>All pages</SectionTitle>
                  <Outline pages={pages} hrefPage={hrefPage} />
                </section>
              </>
            )
          )}
        </>
      }
    />
  );
}

export async function WikiPageView({ connectors, viewer, slug }: PageProps & { slug: string }) {
  const { hrefs, scope, siteName, wiki } = connectors;
  if (!wiki) return null;

  const page = await wiki.getPage(slug);
  if (!page) return null;

  // Only resolved once the reader asks for it; an unstarted Talk page is the
  // normal state and must not cost a write on every view.
  const talk = wiki.talkThread ? await wiki.talkThread(page.id) : null;
  const hrefPage = (s: string) => hrefs.wikiPage?.(s) ?? null;

  return (
    <Layout
      main={
        <>
          <Breadcrumb
            items={[
              { label: scope.kind === "network" ? "Boards" : siteName, href: hrefs.root() },
              { label: "Wiki", href: hrefs.wiki?.() ?? null },
              ...(page.ancestors ?? []).map((a) => ({ label: a.title, href: hrefPage(a.slug) })),
              { label: page.title },
            ]}
          />
          <PageHead
            title={page.title}
            sub={
              <>
                Last edited <Time at={page.updatedAt} />
                {page.authorName ? ` · started by ${page.authorName}` : ""}
              </>
            }
            aside={
              <span className="gf-wiki-actions">
                {talk && (
                  <a className="gf-tool" href={hrefs.thread(talk.id, talk.slug)}>
                    Discussion{talk.replyCount > 0 ? ` (${talk.replyCount})` : ""}
                  </a>
                )}
                {wiki.editHref?.(page.slug) && (
                  <a className="gf-tool" href={wiki.editHref(page.slug)!}>
                    Edit
                  </a>
                )}
              </span>
            }
          />

          {page.topics && page.topics.length > 0 && (
            <ul className="gf-wiki-topics">
              {page.topics.map((t) => {
                const href = hrefs.topic(t.slug);
                return (
                  <li key={t.id}>{href ? <a href={href}>{t.name}</a> : t.name}</li>
                );
              })}
            </ul>
          )}

          {page.bodyHtml ? (
            // Sanitised on write (sanitizeRichText) and resolved by the host
            // before it reaches here — hrefs stamped, defined terms filled in.
            <div
              className="gf-wiki-body"
              dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
            />
          ) : (
            <Empty>This page is empty.</Empty>
          )}

          {page.senses && page.senses.length > 0 && (
            <section>
              <SectionTitle>
                {page.senses.length === 1
                  ? "How this has been defined"
                  : `How this has been defined · ${page.senses.length} senses`}
              </SectionTitle>
              <ol className="gf-wiki-senses">
                {page.senses.map((s) => (
                  <li key={s.id}>
                    <p>{s.text}</p>
                    <small>
                      {s.byName ?? "someone"} · <Time at={s.at} />
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {page.children && page.children.length > 0 && (
            <section>
              <SectionTitle>Pages under this one</SectionTitle>
              <Outline pages={page.children} hrefPage={hrefPage} />
            </section>
          )}

          {page.backlinks && page.backlinks.length > 0 && (
            <section>
              <SectionTitle>What links here</SectionTitle>
              <ul className="gf-wiki-backlinks">
                {page.backlinks.map((b) => (
                  <li key={b.slug}>
                    <a href={hrefPage(b.slug) ?? "#"}>{b.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The Talk page. Started on demand rather than created with every
              wiki page, so the forum isn't seeded with empty topics. */}
          {!talk && wiki.talkThread && connectors.actionBase && viewer.userId && (
            <section>
              <SectionTitle>Discussion</SectionTitle>
              <Empty>
                Nobody has discussed this page yet.
                <form method="post" action={`${connectors.actionBase}/wiki-talk`}>
                  <input type="hidden" name="wikiThreadId" value={page.id} />
                  <input type="hidden" name="back" value={hrefPage(page.slug) ?? ""} />
                  <button type="submit" className="gf-tool">
                    Start a discussion
                  </button>
                </form>
              </Empty>
            </section>
          )}
        </>
      }
    />
  );
}
