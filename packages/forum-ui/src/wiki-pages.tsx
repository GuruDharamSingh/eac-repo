import * as React from "react";
import type { ForumWikiPageRow, ForumWikiSearchSpan, ForumWikiTermRow } from "./connectors";
import { flash, type PageProps } from "./pages";
import { Breadcrumb, Empty, Flash, Layout, PageHead, SectionTitle, Time, plural } from "./parts";

// ============================================================================
// The wiki and the dictionary, as sections of the forum.
//
// A PEER of the boards rather than one of them. Wiki pages are excluded from
// listTopics and searchForum by kind, because a collectively edited reference
// page has no post #1 (plan decision 3b — the thread IS post #1) and replies
// would attach to something everyone rewrites. Discussion about a page is a
// real topic that references it: the Talk thread.
//
// Since 2026-09-17 the forum OWNS the wiki: reading, writing, history and
// the dictionary all live here. Editing is a plain <form> — a host with
// JavaScript hands in an editor island through connectors.wiki.editor; one
// without gets a textarea and the same fields post either way.
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

function Outline({ pages, hrefPage }: { pages: ForumWikiPageRow[]; hrefPage: (slug: string) => string | null }) {
  return (
    <ul className="gf-wiki-outline">
      {pages.map((p) => {
        const href = hrefPage(p.slug);
        return (
          <li key={p.id} style={{ paddingLeft: `${(p.depth ?? 0) * 14}px` }} data-depth={p.depth ?? 0}>
            {href ? <a href={href}>{p.title}</a> : <span>{p.title}</span>}
            {p.excerpt && <span className="gf-wiki-gloss">{p.excerpt}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function crumbRoot(props: PageProps) {
  const { scope, siteName, hrefs } = props.connectors;
  return { label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() };
}

// ── /wiki ───────────────────────────────────────────────────────────────────

export async function WikiIndexPage(props: PageProps) {
  const { connectors, searchParams, path, boxes } = props;
  const { hrefs, wiki } = connectors;
  if (!wiki) return null;

  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const [pages, hits] = await Promise.all([
    wiki.listPages(),
    q && wiki.search ? wiki.search(q) : Promise.resolve(null),
  ]);

  const hrefPage = (slug: string) => hrefs.wikiPage?.(slug) ?? null;
  const index = hrefs.wiki?.() ?? path;
  const recent = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);
  const newHref = wiki.create ? (title?: string) => `${index}/new${title ? `?title=${encodeURIComponent(title)}` : ""}` : null;

  return (
    <Layout
      boxes={boxes}
      main={
        <>
          <Flash {...flash(searchParams)} />
          <Breadcrumb items={[crumbRoot(props), { label: "Wiki" }]} />
          <PageHead
            title="Wiki"
            sub={pages.length === 0 ? "Nothing written yet." : `${plural(pages.length, "page")} · shared across the network`}
            aside={newHref ? <a className="eac-btn eac-btn--primary gf-newtopic-btn" href={newHref()}>+ New page</a> : undefined}
          />

          {wiki.search && (
            // Plain GET so search works without JavaScript, and lands back
            // here as ?q= rather than on a /wiki/search segment that would
            // shadow a page slugged "search".
            <form method="get" action={index} className="gf-wiki-search" role="search">
              <input type="search" name="q" className="gf-input" defaultValue={q} aria-label="Search the wiki" placeholder="Search titles, pages and definitions…" />
              <button type="submit" className="gf-tool">Search</button>
            </form>
          )}

          {hits && (
            <section className="gf-sheet">
              <SectionTitle>
                {hits.length === 0 ? `Nothing matches “${q}”` : `${plural(hits.length, "result")} for “${q}”`}
              </SectionTitle>
              {hits.length === 0 ? (
                <Empty>
                  Try fewer words.
                  {newHref && <> <a href={newHref(q)}>Write “{q}”</a> instead.</>}
                </Empty>
              ) : (
                <ul className="gf-wiki-hits">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <a href={hrefPage(h.slug) ?? "#"}><Spans spans={h.titleSpans} fallback={h.title} /></a>
                      {h.viaDefinition && <span className="gf-wiki-tag">definition</span>}
                      <p><Spans spans={h.snippetSpans} fallback="" /></p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {pages.length === 0 ? (
            <Empty>A wiki grows by writing. Start with one page — a glossary, an index, a process note.</Empty>
          ) : (
            !hits && (
              <div className="gf-wiki-cols">
                <section className="gf-sheet">
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
                <section className="gf-sheet">
                  <SectionTitle>All pages</SectionTitle>
                  <Outline pages={pages} hrefPage={hrefPage} />
                </section>
              </div>
            )
          )}
        </>
      }
    />
  );
}

// ── /wiki/[slug] ────────────────────────────────────────────────────────────

export async function WikiPageView(props: PageProps & { slug: string }) {
  const { connectors, viewer, searchParams, slug, boxes } = props;
  const { hrefs, wiki } = connectors;
  if (!wiki) return null;

  const page = await wiki.getPage(slug);
  if (!page) return null;

  // Only resolved once the reader asks for it; an unstarted Talk page is the
  // normal state and must not cost a write on every view.
  const talk = wiki.talkThread ? await wiki.talkThread(page.id) : null;
  const hrefPage = (s: string) => hrefs.wikiPage?.(s) ?? null;
  const here = hrefPage(page.slug) ?? "";
  const canEdit = Boolean(wiki.update && viewer.userId);

  const rail = (
    <section className="gf-rail-block gf-box gf-box--page">
      <SectionTitle>This page</SectionTitle>
      <dl className="gf-facts">
        <dt>Last edited</dt><dd><Time at={page.updatedAt} /></dd>
        {page.authorName && <><dt>Started by</dt><dd>{page.authorName}</dd></>}
        {page.senses && page.senses.length > 0 && <><dt>Senses</dt><dd>{page.senses.length}</dd></>}
        {page.backlinks && page.backlinks.length > 0 && <><dt>Linked from</dt><dd>{plural(page.backlinks.length, "page")}</dd></>}
      </dl>
      <p className="gf-box-links">
        {canEdit && <a href={`${here}/edit`}>Edit</a>}
        {wiki.listRevisions && <a href={`${here}/history`}>History</a>}
        {talk && <a href={hrefs.thread(talk.id, talk.slug)}>Discussion{talk.replyCount > 0 ? ` (${talk.replyCount})` : ""}</a>}
      </p>
      {!talk && wiki.talkThread && connectors.actionBase && viewer.userId && (
        <form method="post" action={`${connectors.actionBase}/wiki-talk`} className="gf-box-form">
          <input type="hidden" name="wikiThreadId" value={page.id} />
          <input type="hidden" name="back" value={here} />
          <button type="submit" className="gf-tool">Start a discussion</button>
        </form>
      )}
    </section>
  );

  return (
    <Layout
      boxes={boxes}
      rail={rail}
      main={
        <>
          <Flash {...flash(searchParams)} />
          <Breadcrumb
            items={[
              crumbRoot(props),
              { label: "Wiki", href: hrefs.wiki?.() ?? null },
              ...(page.ancestors ?? []).map((a) => ({ label: a.title, href: hrefPage(a.slug) })),
              { label: page.title },
            ]}
          />
          <article className="gf-sheet gf-wiki-article">
            <PageHead
              title={page.title}
              sub={<>Last edited <Time at={page.updatedAt} />{page.authorName ? ` · started by ${page.authorName}` : ""}</>}
              aside={canEdit ? <a className="gf-tool" href={`${here}/edit`}>✎ Edit</a> : undefined}
            />

            {page.topics && page.topics.length > 0 && (
              <ul className="gf-wiki-topics">
                {page.topics.map((t) => {
                  const href = hrefs.topic(t.slug);
                  return <li key={t.id}>{href ? <a href={href}>{t.name}</a> : t.name}</li>;
                })}
              </ul>
            )}

            {page.bodyHtml ? (
              // Sanitised on write (sanitizeRichText) and resolved by the host
              // before it reaches here — hrefs stamped, defined terms filled in.
              <div className="gf-wiki-body" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
            ) : (
              <Empty>This page is empty{canEdit ? <> — <a href={`${here}/edit`}>write it</a></> : null}.</Empty>
            )}
          </article>

          {page.senses && page.senses.length > 0 && (
            <section className="gf-sheet">
              <SectionTitle>{page.senses.length === 1 ? "How this has been defined" : `How this has been defined · ${page.senses.length} senses`}</SectionTitle>
              <ol className="gf-wiki-senses">
                {page.senses.map((s) => (
                  <li key={s.id}>
                    <p>{s.text}</p>
                    <small>{s.byName ?? "someone"} · <Time at={s.at} /></small>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {page.children && page.children.length > 0 && (
            <section className="gf-sheet">
              <SectionTitle>Pages under this one</SectionTitle>
              <Outline pages={page.children} hrefPage={hrefPage} />
            </section>
          )}

          {page.backlinks && page.backlinks.length > 0 && (
            <section className="gf-sheet">
              <SectionTitle>What links here</SectionTitle>
              <ul className="gf-wiki-backlinks">
                {page.backlinks.map((b) => <li key={b.slug}><a href={hrefPage(b.slug) ?? "#"}>{b.title}</a></li>)}
              </ul>
            </section>
          )}
        </>
      }
    />
  );
}

// ── /wiki/new and /wiki/[slug]/edit ─────────────────────────────────────────

function ParentSelect({ pages, excludeId, current }: { pages: ForumWikiPageRow[]; excludeId?: string; current: string | null }) {
  // A page can't sit under itself or its own subtree; the connector refuses
  // that too, but the picker shouldn't offer it. Depth comes from the tree
  // order listPages already returns, so the subtree is the run that follows
  // the page at a greater depth.
  const options: ForumWikiPageRow[] = [];
  let skipping: number | null = null;
  for (const p of pages) {
    const d = p.depth ?? 0;
    if (skipping !== null) {
      if (d > skipping) continue;
      skipping = null;
    }
    if (p.id === excludeId) { skipping = d; continue; }
    options.push(p);
  }
  return (
    <select name="parent" className="gf-input gf-select" defaultValue={current ?? ""} aria-label="Sits under">
      <option value="">— Top level —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{`${"  ".repeat(o.depth ?? 0)}${o.title}`}</option>
      ))}
    </select>
  );
}

async function WikiForm(props: PageProps & { mode: "new" | "edit"; slug?: string }) {
  const { connectors, viewer, searchParams, boxes, mode, slug } = props;
  const { hrefs, wiki, actionBase } = connectors;
  if (!wiki?.create || !wiki.update || !actionBase) return null;
  const index = hrefs.wiki?.() ?? "";
  const crumbs = [crumbRoot(props), { label: "Wiki", href: index }];

  if (!viewer.userId) {
    return (
      <Layout boxes={boxes} main={<>
        <Breadcrumb items={[...crumbs, { label: mode === "new" ? "New page" : "Edit" }]} />
        <PageHead title={mode === "new" ? "New page" : "Edit"} />
        <Empty>{hrefs.signIn ? <a href={hrefs.signIn}>Sign in</a> : "Sign in"} to write in the wiki.</Empty>
      </>} />
    );
  }

  const [pages, source, choices] = await Promise.all([
    wiki.listPages(),
    mode === "edit" && slug && wiki.getSource ? wiki.getSource(slug) : Promise.resolve(null),
    wiki.listTopicChoices ? wiki.listTopicChoices().catch(() => []) : Promise.resolve([]),
  ]);
  if (mode === "edit" && !source) return null;

  const base = actionBase.replace(/\/$/, "");
  const titleParam = typeof searchParams.title === "string" ? searchParams.title : "";
  const parentParam = typeof searchParams.parent === "string" ? searchParams.parent : null;
  const title = source?.title ?? titleParam;
  const here = source ? `${index}/${source.slug}` : `${index}/new`;
  const back = mode === "edit" ? `${here}/edit` : here;
  const Editor = wiki.editor;
  const wikiPages = pages.filter((p) => p.id !== source?.id).map((p) => ({ title: p.title, slug: p.slug }));
  const body = source?.body ?? "";

  return (
    <Layout
      boxes={boxes}
      main={
        <>
          <Flash {...flash(searchParams)} />
          <Breadcrumb items={[...crumbs, ...(source ? [{ label: source.title, href: here }] : []), { label: mode === "new" ? "New page" : "Edit" }]} />
          <PageHead
            title={mode === "new" ? "New page" : `Editing ${source!.title}`}
            sub={mode === "new"
              ? (titleParam ? "Following an unwritten link — writing this fills it in everywhere it's linked from." : "A page anyone on the network can read and improve.")
              : "Renaming keeps the page's address, so existing links stay good."}
          />
          <form method="post" action={`${base}/${mode === "new" ? "wiki-create" : "wiki-update"}`} className="gf-sheet gf-wiki-form">
            <input type="hidden" name="back" value={back} />
            {source && <input type="hidden" name="thread" value={source.id} />}
            {source && <input type="hidden" name="expectedUpdatedAt" value={new Date(source.updatedAt).toISOString()} />}

            <label className="gf-field">
              <span className="gf-field-label">Title</span>
              <input name="title" className="gf-input" required maxLength={200} defaultValue={title} placeholder="Page title" />
            </label>

            <label className="gf-field">
              <span className="gf-field-label">Sits under</span>
              <ParentSelect pages={pages} excludeId={source?.id} current={source?.parentId ?? parentParam} />
            </label>

            {source && choices.length > 0 && (
              <fieldset className="gf-field gf-topicpick">
                <legend className="gf-field-label">Tags</legend>
                <input type="hidden" name="topics_present" value="1" />
                {choices.map((t) => (
                  <label key={t.id} className="gf-chip gf-chip--pick">
                    <input type="checkbox" name="topics" value={t.id} defaultChecked={source.topicIds.includes(t.id)} /> {t.name}
                  </label>
                ))}
              </fieldset>
            )}

            <div className="gf-field">
              <span className="gf-field-label">Body</span>
              {Editor ? (
                <Editor name="body" defaultValue={body} wikiPages={wikiPages} sourceThreadId={source?.id} />
              ) : (
                <textarea name="body" className="gf-textarea gf-textarea--tall" rows={18} defaultValue={htmlToText(body)} placeholder="Write the page. Blank lines make paragraphs." />
              )}
              <p className="gf-field-hint gf-field-hint--block">
                {Editor
                  ? <>Type <code>[[</code> to link a page; <code>[[Page Name|shown text]]</code> sets the link text. A link to a page that doesn&rsquo;t exist yet shows as unwritten and offers to create it.</>
                  : <>Plain text here; <code>[[Page Name]]</code> still links a page.</>}
              </p>
            </div>

            <div className="gf-replybox-foot">
              <a className="gf-tool" href={here}>Cancel</a>
              <button type="submit" className="eac-btn eac-btn--primary">{mode === "new" ? "Create page" : "Save changes"}</button>
            </div>
          </form>

          {source && wiki.archive && (
            <details className="gf-sheet gf-wiki-danger">
              <summary>Remove this page</summary>
              <form method="post" action={`${base}/wiki-archive`}>
                <input type="hidden" name="thread" value={source.id} />
                <input type="hidden" name="back" value={back} />
                <p>Removing hides the page. Its history is kept, so it can be restored by hand.
                  {pages.filter((p) => p.depth !== undefined).length > 0 ? " Sub-pages become top-level." : ""}</p>
                <button type="submit" className="gf-tool gf-tool--danger">Remove “{source.title}”</button>
              </form>
            </details>
          )}
        </>
      }
    />
  );
}

/**
 * The textarea fallback shows stored HTML as text. Paragraph breaks are
 * kept; everything else is flattened — the no-JavaScript path edits
 * prose, not markup, and a saved page from here is plain paragraphs.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function WikiNewPage(props: PageProps) {
  return WikiForm({ ...props, mode: "new" });
}

export function WikiEditPage(props: PageProps & { slug: string }) {
  return WikiForm({ ...props, mode: "edit" });
}

// ── /wiki/[slug]/history ────────────────────────────────────────────────────

export async function WikiHistoryPage(props: PageProps & { slug: string }) {
  const { connectors, viewer, searchParams, slug, boxes } = props;
  const { hrefs, wiki, actionBase } = connectors;
  if (!wiki?.listRevisions) return null;
  const page = await wiki.getPage(slug);
  if (!page) return null;
  const revisions = await wiki.listRevisions(page.id);
  const index = hrefs.wiki?.() ?? "";
  const here = `${index}/${page.slug}`;
  const base = actionBase?.replace(/\/$/, "");
  const canRevert = Boolean(wiki.revert && base && viewer.userId);

  return (
    <Layout
      boxes={boxes}
      main={
        <>
          <Flash {...flash(searchParams)} />
          <Breadcrumb items={[crumbRoot(props), { label: "Wiki", href: index }, { label: page.title, href: here }, { label: "History" }]} />
          <PageHead title="History" sub={`${page.title} · ${plural(revisions.length, "version")}. Reverting is saved as a new edit — nothing is erased.`} />
          {revisions.length === 0 ? <Empty>No saved versions yet.</Empty> : (
            <ol className="gf-sheet gf-revisions">
              {revisions.map((rev, i) => (
                <li key={rev.id} className="gf-revision">
                  <span className="gf-revision-main">
                    <b>{rev.title}</b>
                    {i === 0 && <span className="gf-chip gf-chip--current">current</span>}
                    <span className="gf-revision-meta"><Time at={rev.createdAt} />{rev.editorName ? ` · ${rev.editorName}` : ""}</span>
                  </span>
                  {i > 0 && canRevert && (
                    <form method="post" action={`${base}/wiki-revert`}>
                      <input type="hidden" name="thread" value={page.id} />
                      <input type="hidden" name="revision" value={rev.id} />
                      <input type="hidden" name="back" value={`${here}/history`} />
                      <button type="submit" className="gf-tool">Revert to this</button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      }
    />
  );
}

// ── /dictionary ─────────────────────────────────────────────────────────────

export async function DictionaryPage(props: PageProps) {
  const { connectors, viewer, searchParams, path, boxes } = props;
  const { hrefs, wiki, actionBase } = connectors;
  if (!wiki?.listTerms) return null;

  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const [terms, hits] = await Promise.all([
    wiki.listTerms({ order: "alpha" }),
    q && wiki.search ? wiki.search(q) : Promise.resolve(null),
  ]);
  const hrefPage = (s: string) => hrefs.wikiPage?.(s) ?? "#";
  const base = actionBase?.replace(/\/$/, "");

  // A–Z, with anything that doesn't start with a letter under "#".
  const groups = new Map<string, ForumWikiTermRow[]>();
  for (const t of terms) {
    const c = t.title.trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(c) ? c : "#";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  const term = typeof searchParams.term === "string" ? searchParams.term : "";
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;

  return (
    <Layout
      boxes={boxes}
      main={
        <>
          <Flash {...flash(searchParams)} />
          <Breadcrumb items={[crumbRoot(props), { label: "Dictionary" }]} />
          <PageHead
            title="Dictionary"
            sub={terms.length === 0 ? "No words defined yet." : `${plural(terms.length, "term")} · the network's own vocabulary, one page each`}
            aside={letters.length > 1 ? (
              <nav className="gf-alpha" aria-label="Letters">
                {letters.map((l) => <a key={l} href={`#letter-${l === "#" ? "other" : l}`}>{l}</a>)}
              </nav>
            ) : undefined}
          />

          {wiki.search && (
            <form method="get" action={path} className="gf-wiki-search" role="search">
              <input type="search" name="q" className="gf-input" defaultValue={q} aria-label="Search the dictionary" placeholder="Search terms and their senses…" />
              <button type="submit" className="gf-tool">Search</button>
            </form>
          )}

          {wiki.define && base && viewer.userId && (
            <form method="post" action={`${base}/wiki-define`} className="gf-sheet gf-define" id="define">
              <SectionTitle>§ Define a word</SectionTitle>
              <input type="hidden" name="back" value={path} />
              {from && <input type="hidden" name="sourceThreadId" value={from} />}
              <div className="gf-define-row">
                <input name="term" className="gf-input" defaultValue={term} required maxLength={120} placeholder="The word or phrase" aria-label="The word or phrase" />
                <textarea name="definition" className="gf-textarea" rows={2} required placeholder="What it means here — a sentence or two." aria-label="What it means" />
                <button type="submit" className="eac-btn eac-btn--primary">Add</button>
              </div>
              <p className="gf-field-hint gf-field-hint--block">A word can hold more than one reading — yours is added beside any already there, never over them.</p>
            </form>
          )}

          {hits && (
            <section className="gf-sheet">
              <SectionTitle>{hits.length === 0 ? `Nothing matches “${q}”` : `${plural(hits.length, "result")} for “${q}”`}</SectionTitle>
              {hits.length === 0 ? <Empty>Try fewer words, or define it above.</Empty> : (
                <ul className="gf-wiki-hits">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <a href={hrefPage(h.slug)}><Spans spans={h.titleSpans} fallback={h.title} /></a>
                      {h.viaDefinition && <span className="gf-wiki-tag">definition</span>}
                      <p><Spans spans={h.snippetSpans} fallback="" /></p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!hits && terms.length > 0 && letters.map((l) => (
            <section key={l} className="gf-sheet gf-dict-letter" id={`letter-${l === "#" ? "other" : l}`}>
              <h2 className="gf-dict-letterhead">{l}</h2>
              <dl className="gf-dict">
                {groups.get(l)!.map((t) => (
                  <div key={t.id} className="gf-dict-entry">
                    <dt>
                      <a href={hrefPage(t.slug)}>{t.title}</a>
                      {t.aliases.length > 0 && <small className="gf-dict-aliases">also {t.aliases.join(", ")}</small>}
                      {t.senseCount > 1 && <span className="gf-chip">{t.senseCount} senses</span>}
                    </dt>
                    <dd>{t.firstSense ?? <em>no sense recorded</em>}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </>
      }
    />
  );
}
