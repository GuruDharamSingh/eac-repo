import * as React from "react";
import type { ForumBoard, ForumHappeningRow, ForumPerson, ForumPersonCard, ForumViewer } from "@elkdonis/services";
import type { ForumConnectors, ForumWikiPageRow, ForumWikiTermRow } from "./connectors";
import { Avatar, HappeningBlock, SectionTitle, Time, plural } from "./parts";
import { canAddCategory } from "./category";
import { WhoIsHereBlock } from "./people";

// ============================================================================
// The shell: a slim rail of places on the left, the page in the middle, and
// a column of boxes on the right. Every page wears it, on every host — an
// org site's /forum gets its own categories in the rail; the network host
// gets every org's.
//
// The left rail is ONE element that is a column on a wide screen and a
// pull-out on a phone. The pull-out is CSS-only: the masthead's "☰" links to
// #menu, `:target` slides the rail in, and its "×" links back to "#". No
// script, so it works on the hosts that have none.
//
// The right column's boxes are built once here and handed to every page's
// Layout, which puts the page's OWN rail (thread facts, board happening)
// above them — so a page adds to the column, never replaces it.
// ============================================================================

const RANK: Record<string, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };

function mayPost(viewer: ForumViewer, orgId: string, minRole: string | null): boolean {
  if (!viewer.userId) return false;
  if (!minRole || viewer.isGlobalAdmin) return true;
  return (RANK[viewer.roles[orgId] ?? ""] ?? 0) >= (RANK[minRole] ?? 0);
}

export interface ShellParts {
  side: React.ReactNode;
  boxes: React.ReactNode;
}

/** Everything the rails need, fetched once, in parallel, per page. */
export async function loadShell(connectors: ForumConnectors, viewer: ForumViewer, path: string): Promise<ShellParts> {
  const { scope, hrefs, wiki } = connectors;
  const [boards, unread, cards, wikiPages, terms, happening, present] = await Promise.all([
    connectors.listBoards(scope, viewer).catch(() => [] as ForumBoard[]),
    viewer.userId
      ? connectors.listTopics({ kind: "unread", scope }, viewer, { limit: 1 }).then((p) => p.total).catch(() => 0)
      : Promise.resolve(0),
    viewer.userId && connectors.listPeopleCards ? connectors.listPeopleCards([viewer.userId]).catch(() => ({})) : Promise.resolve({}),
    wiki ? wiki.listPages().catch(() => [] as ForumWikiPageRow[]) : Promise.resolve([] as ForumWikiPageRow[]),
    wiki?.listTerms ? wiki.listTerms({ limit: 6, order: "recent" }).catch(() => [] as ForumWikiTermRow[]) : Promise.resolve([] as ForumWikiTermRow[]),
    connectors.listHappening(scope, viewer, { limit: 4 }).catch(() => [] as ForumHappeningRow[]),
    connectors.listPresent ? connectors.listPresent(15, 8).catch(() => null) : Promise.resolve(null),
  ]);
  const card = viewer.userId ? (cards as Record<string, ForumPersonCard>)[viewer.userId] ?? null : null;

  return {
    side: <SideNav connectors={connectors} viewer={viewer} boards={boards} unread={unread} path={path} card={card} />,
    boxes: (
      <>
        <ProfileBox connectors={connectors} viewer={viewer} card={card} unread={unread} />
        <QuickPostBox connectors={connectors} viewer={viewer} boards={boards} back={path} />
        {happening.length > 0 && <HappeningBlock rows={happening} hrefs={hrefs} showOrg={scope.kind === "network"} more={hrefs.happening()} />}
        {wiki && <WikiBox connectors={connectors} pages={wikiPages} />}
        {wiki && <DictionaryBox connectors={connectors} viewer={viewer} terms={terms} back={path} />}
        <NewCategoryBox connectors={connectors} viewer={viewer} boards={boards} back={path} />
        {present && present.count > 0 && <WhoIsHereBlock count={present.count} people={present.people} hrefs={hrefs} />}
      </>
    ),
  };
}

// ── the left rail ───────────────────────────────────────────────────────────

function SideLink({ href, path, children, count, glyph }: { href: string | null; path: string; children: React.ReactNode; count?: number | null; glyph?: string }) {
  if (!href) return null;
  const here = path === href || (href !== "/" && path === href.replace(/\/$/, ""));
  return (
    <li>
      <a className={`gf-side-link${here ? " is-current" : ""}`} href={href} aria-current={here ? "page" : undefined}>
        {glyph && <span className="gf-side-glyph" aria-hidden>{glyph}</span>}
        <span className="gf-side-label">{children}</span>
        {count ? <span className="gf-side-count">{count}</span> : null}
      </a>
    </li>
  );
}

function SideNav({ connectors, viewer, boards, unread, path, card }: {
  connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; unread: number; path: string; card: ForumPersonCard | null;
}) {
  const { hrefs, scope, siteName } = connectors;
  const root = hrefs.root().replace(/\/$/, "") || "";
  const network = scope.kind === "network";
  const live = boards
    .map((b) => ({ ...b, feeds: b.feeds.filter((f) => !(f.slug === "general" && f.topicCount === 0 && b.feeds.length > 1)) }))
    .filter((b) => b.feeds.length > 0);
  const me = card ? hrefs.member(card.slug) : null;

  return (
    <aside className="gf-side" id="menu" aria-label="Places">
      <div className="gf-side-head">
        <span className="gf-side-title">{network ? "The forum" : siteName}</span>
        <a className="gf-side-close" href="#" aria-label="Close menu">×</a>
      </div>

      <nav className="gf-side-group" aria-label="Read">
        <ul>
          <SideLink href={hrefs.root()} path={path} glyph="⌂">Home</SideLink>
          <SideLink href={hrefs.latest()} path={path} glyph="◷">Latest</SideLink>
          <SideLink href={hrefs.happening()} path={path} glyph="◔">Happening</SideLink>
          <SideLink href={`${root}/topics`} path={path} glyph="#">Topics</SideLink>
          <SideLink href={`${root}/members`} path={path} glyph="◯">Members</SideLink>
          {network && <SideLink href={`${root}/orgs`} path={path} glyph="◫">Orgs</SideLink>}
        </ul>
      </nav>

      {viewer.userId && (
        <nav className="gf-side-group" aria-label="Yours">
          <h2 className="gf-side-heading">Yours</h2>
          <ul>
            <SideLink href={`${root}/unread`} path={path} glyph="●" count={unread}>Unread</SideLink>
            <SideLink href={`${root}/watching`} path={path} glyph="★">Watching</SideLink>
            <SideLink href={`${root}/bookmarks`} path={path} glyph="⚑">Bookmarks</SideLink>
            <SideLink href={`${root}/notifications`} path={path} glyph="◍">Notifications</SideLink>
            {me && <SideLink href={me} path={path} glyph="◐">My page</SideLink>}
          </ul>
        </nav>
      )}

      {connectors.wiki && (
        <nav className="gf-side-group" aria-label="Reference">
          <h2 className="gf-side-heading">Reference</h2>
          <ul>
            <SideLink href={hrefs.wiki?.() ?? null} path={path} glyph="▤">Wiki</SideLink>
            <SideLink href={hrefs.dictionary?.() ?? null} path={path} glyph="§">Dictionary</SideLink>
          </ul>
        </nav>
      )}

      <nav className="gf-side-group gf-side-boards" aria-label={network ? "Boards" : "Categories"}>
        <h2 className="gf-side-heading">{network ? "Boards" : "Categories"}</h2>
        {live.length === 0 ? (
          <p className="gf-side-empty">Nothing here yet.</p>
        ) : (
          <ul>
            {live.map((b) => (
              <li key={b.orgId} className="gf-side-org">
                {network && (
                  <a className={`gf-side-orgname${path === hrefs.board(b.slug) ? " is-current" : ""}`} href={hrefs.board(b.slug)}>
                    {b.name}
                  </a>
                )}
                <ul className="gf-side-feeds">
                  {b.feeds.map((f) => {
                    const href = hrefs.feed(b.slug, f.slug);
                    const here = path === href;
                    return (
                      <li key={f.slug}>
                        <a
                          className={`gf-side-feed${here ? " is-current" : ""}${f.unreadCount ? " is-unread" : ""}`}
                          href={href}
                          aria-current={here ? "page" : undefined}
                          style={f.accent ? ({ ["--gf-feed" as string]: f.accent } as React.CSSProperties) : undefined}
                        >
                          <span className="gf-side-label">{f.name}</span>
                          <span className="gf-side-count" title={plural(f.topicCount, "topic")}>{f.topicCount}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

// ── the right column's boxes ────────────────────────────────────────────────

function Box({ title, more, moreLabel, className, children }: { title: React.ReactNode; more?: string | null; moreLabel?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`gf-rail-block gf-box${className ? ` ${className}` : ""}`}>
      <SectionTitle more={more} moreLabel={moreLabel}>{title}</SectionTitle>
      {children}
    </section>
  );
}

function ProfileBox({ connectors, viewer, card, unread }: { connectors: ForumConnectors; viewer: ForumViewer; card: ForumPersonCard | null; unread: number }) {
  const { hrefs } = connectors;
  const root = hrefs.root().replace(/\/$/, "");
  if (!viewer.userId) {
    if (!hrefs.signIn) return null;
    return (
      <Box title="You" className="gf-box--you">
        <p className="gf-you-note">Sign in to post, watch topics and keep your place.</p>
        <a className="eac-btn eac-btn--primary gf-you-signin" href={hrefs.signIn}>Sign in · Join</a>
      </Box>
    );
  }
  if (!card) return null;
  const me = hrefs.member(card.slug);
  const person: ForumPerson = { id: card.id, name: card.name, slug: card.slug, avatarUrl: card.avatarUrl, commentColor: card.commentColor };
  return (
    <Box title="You" className="gf-box--you" more={me} moreLabel="my page →">
      <div className="gf-you">
        <Avatar person={person} size={64} />
        <div className="gf-you-text">
          <b className="gf-you-name">{card.name}</b>
          {card.roles.length > 0 && (
            <span className="gf-you-roles">{card.roles.map((r) => <span key={r.orgId}><em>{r.role}</em> · {r.orgName}</span>)}</span>
          )}
          <span className="gf-you-facts">{plural(card.topicCount, "topic")} · {plural(card.replyCount, "reply", "replies")}</span>
        </div>
      </div>
      <ul className="gf-you-links">
        <li><a href={`${root}/unread`}>Unread{unread ? <span className="gf-side-count">{unread}</span> : null}</a></li>
        <li><a href={`${root}/watching`}>Watching</a></li>
        <li><a href={`${root}/bookmarks`}>Bookmarks</a></li>
        <li><a href={`${root}/notifications`}>Notifications</a></li>
      </ul>
    </Box>
  );
}

/**
 * A new topic from anywhere. One select spans every category the viewer may
 * post in; on an org host that is just that org's categories, and the org
 * name is left off because it is the site you are standing on.
 */
function QuickPostBox({ connectors, viewer, boards, back }: { connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; back: string }) {
  const { write, actionBase, scope } = connectors;
  if (!write || !actionBase || !viewer.userId) return null;
  const network = scope.kind === "network";
  const groups = boards
    .map((b) => ({ board: b, feeds: b.feeds.filter((f) => mayPost(viewer, b.orgId, f.minRole)) }))
    .filter((g) => g.feeds.length > 0);
  if (groups.length === 0) return null;
  const base = actionBase.replace(/\/$/, "");
  const single = groups.length === 1 && groups[0].feeds.length === 1;
  return (
    <Box title="New topic" className="gf-box--post">
      <form method="post" action={`${base}/topic`} className="gf-quickpost">
        <input type="hidden" name="back" value={back} />
        <input name="title" className="gf-input" required minLength={2} maxLength={200} placeholder="What is it about?" aria-label="Title" />
        {single ? (
          <input type="hidden" name="target" value={`${groups[0].board.orgId}|${groups[0].feeds[0].slug}`} />
        ) : (
          <select name="target" className="gf-input gf-select" aria-label="Where" required>
            {groups.map((g) =>
              network ? (
                <optgroup key={g.board.orgId} label={g.board.name}>
                  {g.feeds.map((f) => <option key={f.slug} value={`${g.board.orgId}|${f.slug}`}>{f.name}</option>)}
                </optgroup>
              ) : (
                g.feeds.map((f) => <option key={f.slug} value={`${g.board.orgId}|${f.slug}`}>{f.name}</option>)
              )
            )}
          </select>
        )}
        <textarea name="text" className="gf-textarea" rows={4} required placeholder="Say it. Blank lines make paragraphs; > quotes." aria-label="Body" />
        <div className="gf-box-foot">
          <small>{single ? `Posts in ${groups[0].feeds[0].name}` : "Pick where it belongs"}</small>
          <button type="submit" className="eac-btn eac-btn--primary">Post</button>
        </div>
      </form>
      {connectors.hrefs.newDrawing?.() && (
        <p className="gf-box-links"><a href={connectors.hrefs.newDrawing()!}>✎ or start a drawing</a></p>
      )}
    </Box>
  );
}

function NewCategoryBox({ connectors, viewer, boards, back }: { connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; back: string }) {
  const { write, actionBase } = connectors;
  if (!write?.createCategory || !actionBase || !viewer.userId) return null;
  const mine = boards.filter((b) => canAddCategory(viewer, b.orgId));
  if (mine.length === 0) return null;
  const base = actionBase.replace(/\/$/, "");
  return (
    <Box title="New category" className="gf-box--cat">
      <details className="gf-box-fold">
        <summary>Another place on a board, with its own topics</summary>
        <form method="post" action={`${base}/category`} className="gf-quickpost">
          <input type="hidden" name="back" value={back} />
          {mine.length === 1 ? (
            <input type="hidden" name="target" value={`${mine[0].orgId}|${mine[0].slug}`} />
          ) : (
            <select name="target" className="gf-input gf-select" aria-label="Which board" required>
              {mine.map((b) => <option key={b.orgId} value={`${b.orgId}|${b.slug}`}>{b.name}</option>)}
            </select>
          )}
          <input name="name" className="gf-input" required minLength={2} maxLength={120} placeholder="Name, e.g. Exhibitions" aria-label="Name" autoComplete="off" />
          <input name="tagline" className="gf-input" maxLength={200} placeholder="One line on what belongs here (optional)" aria-label="Tagline" autoComplete="off" />
          <div className="gf-box-radios">
            <label><input type="radio" name="audience" value="everyone" defaultChecked /> Everyone</label>
            <label><input type="radio" name="audience" value="members" /> Members only</label>
          </div>
          <div className="gf-box-foot">
            <small>Appears on the board, not in the site&rsquo;s own menu.</small>
            <button type="submit" className="eac-btn eac-btn--primary">Create</button>
          </div>
        </form>
      </details>
    </Box>
  );
}

function WikiBox({ connectors, pages }: { connectors: ForumConnectors; pages: ForumWikiPageRow[] }) {
  const { hrefs, wiki } = connectors;
  const index = hrefs.wiki?.() ?? null;
  if (!wiki || !index) return null;
  const recent = [...pages].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  return (
    <Box title="Wiki" className="gf-box--wiki" more={index} moreLabel={`${pages.length} pages →`}>
      {wiki.search && (
        <form method="get" action={index} className="gf-box-search" role="search">
          <input type="search" name="q" className="gf-input gf-input--sm" placeholder="⌕ Search the wiki" aria-label="Search the wiki" />
        </form>
      )}
      {recent.length === 0 ? (
        <p className="gf-rail-empty">Nothing written yet.</p>
      ) : (
        <ul className="gf-box-list">
          {recent.map((p) => (
            <li key={p.id}>
              <a href={hrefs.wikiPage?.(p.slug) ?? "#"}>{p.title}</a>
              <Time at={p.updatedAt} className="gf-box-when" />
            </li>
          ))}
        </ul>
      )}
      {wiki.create && <p className="gf-box-links"><a href={`${index}/new`}>+ New page</a></p>}
    </Box>
  );
}

function DictionaryBox({ connectors, viewer, terms, back }: { connectors: ForumConnectors; viewer: ForumViewer; terms: ForumWikiTermRow[]; back: string }) {
  const { hrefs, wiki, actionBase } = connectors;
  const index = hrefs.dictionary?.() ?? null;
  if (!wiki || !index) return null;
  const base = actionBase?.replace(/\/$/, "");
  return (
    <Box title="Dictionary" className="gf-box--dict" more={index} moreLabel="A–Z →">
      {terms.length === 0 ? (
        <p className="gf-rail-empty">No words defined yet.</p>
      ) : (
        <dl className="gf-box-terms">
          {terms.map((t) => (
            <React.Fragment key={t.id}>
              <dt><a href={hrefs.wikiPage?.(t.slug) ?? "#"}>{t.title}</a>{t.senseCount > 1 && <small> · {t.senseCount} senses</small>}</dt>
              {t.firstSense && <dd>{t.firstSense}</dd>}
            </React.Fragment>
          ))}
        </dl>
      )}
      {wiki.define && base && viewer.userId && (
        <details className="gf-box-fold">
          <summary>§ Define a word</summary>
          <form method="post" action={`${base}/wiki-define`} className="gf-quickpost">
            <input type="hidden" name="back" value={back} />
            <input name="term" className="gf-input" required maxLength={120} placeholder="The word or phrase" aria-label="The word or phrase" />
            <textarea name="definition" className="gf-textarea" rows={3} required placeholder="What it means here — a sentence or two." aria-label="What it means" />
            <div className="gf-box-foot">
              <small>Added beside any sense already there, never over it.</small>
              <button type="submit" className="eac-btn eac-btn--primary">Add</button>
            </div>
          </form>
        </details>
      )}
    </Box>
  );
}
