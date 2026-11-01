import * as React from "react";
import type { ForumBoard, ForumHappeningRow, ForumPerson, ForumPersonCard, ForumViewer } from "@elkdonis/services";
import type { ForumConnectors } from "./connectors";
import { Avatar, HappeningBlock, plural } from "./parts";
import { canAddCategory } from "./category";
import { WhoIsHereBlock } from "./people";
import { MatchLight } from "./match-light";

// ============================================================================
// The shell: ONE rail of places on the left and the page's sheet beside it.
// Every page wears it, on every host — an org site's /forum gets its own
// categories in the rail; the network host gets every org's.
//
// Until 2026-10-28 there was also a right column of boxes (You, New topic,
// Wiki, Dictionary, Happening, New category, Who's here). Half of it repeated
// the rail, and with both columns the posts got about 600px. Its useful parts
// now live in the rail: you and New topic at the top, the places, and an
// "Around the forum" fold at the bottom for what's happening and who's here.
// The Wiki and Dictionary boxes went: the rail's Reference links reach both.
//
// The rail is ONE element that is a column on a wide screen and a pull-out
// on a phone. The pull-out is CSS-only: the "☰ Browse" button links to
// #menu, `:target` slides the rail in, and its "×" links back to "#". The
// folds are <details>. No script, so it works on the hosts that have none.
// ============================================================================

const RANK: Record<string, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };

function mayPost(viewer: ForumViewer, orgId: string, minRole: string | null): boolean {
  if (!viewer.userId) return false;
  if (!minRole || viewer.isGlobalAdmin) return true;
  return (RANK[viewer.roles[orgId] ?? ""] ?? 0) >= (RANK[minRole] ?? 0);
}

export interface ShellParts {
  side: React.ReactNode;
  /** Kept for callers that still pass it to Layout; always null now. */
  boxes: React.ReactNode;
}

/** Everything the rail needs, fetched once, in parallel, per page. */
export async function loadShell(connectors: ForumConnectors, viewer: ForumViewer, path: string): Promise<ShellParts> {
  const { scope } = connectors;
  const [boards, unread, cards, happening, present] = await Promise.all([
    connectors.listBoards(scope, viewer).catch(() => [] as ForumBoard[]),
    viewer.userId
      ? connectors.listTopics({ kind: "unread", scope }, viewer, { limit: 1 }).then((p) => p.total).catch(() => 0)
      : Promise.resolve(0),
    viewer.userId && connectors.listPeopleCards ? connectors.listPeopleCards([viewer.userId]).catch(() => ({})) : Promise.resolve({}),
    connectors.listHappening(scope, viewer, { limit: 4 }).catch(() => [] as ForumHappeningRow[]),
    connectors.listPresent ? connectors.listPresent(15, 8).catch(() => null) : Promise.resolve(null),
  ]);
  const card = viewer.userId ? (cards as Record<string, ForumPersonCard>)[viewer.userId] ?? null : null;

  return {
    side: (
      <SideNav
        connectors={connectors} viewer={viewer} boards={boards} unread={unread} path={path} card={card}
        happening={happening} present={present}
      />
    ),
    boxes: null,
  };
}

// ── the rail ────────────────────────────────────────────────────────────────

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

function SideNav({ connectors, viewer, boards, unread, path, card, happening, present }: {
  connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; unread: number; path: string; card: ForumPersonCard | null;
  happening: ForumHappeningRow[]; present: { count: number; people: ForumPerson[] } | null;
}) {
  const { hrefs, scope, siteName } = connectors;
  const root = hrefs.root().replace(/\/$/, "") || "";
  const network = scope.kind === "network";
  const live = boards
    .map((b) => ({ ...b, feeds: b.feeds.filter((f) => !(f.slug === "general" && f.topicCount === 0 && b.feeds.length > 1)) }))
    .filter((b) => b.feeds.length > 0);
  const me = card ? hrefs.member(card.slug) : null;
  const around = happening.length > 0 || (present && present.count > 0);

  return (
    <aside className="gf-side" id="menu" aria-label="Places">
      <div className="gf-side-head">
        <span className="gf-side-title">{network ? "The forum" : siteName}</span>
        <a className="gf-side-close" href="#" aria-label="Close menu">×</a>
      </div>

      <YouBlock connectors={connectors} viewer={viewer} card={card} />
      <NewTopicFold connectors={connectors} viewer={viewer} boards={boards} back={path} />

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
            <SideLink href={`${root}/insights`} path={path} glyph="▥">Insights</SideLink>
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

      {/* Above the boards, which can run long: the switch stays in view on load. */}
      {connectors.matchLight && <MatchLight mode={connectors.mode ?? "light"} />}

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
        <NewCategoryFold connectors={connectors} viewer={viewer} boards={boards} back={path} />
      </nav>

      {around && (
        <details className="gf-side-group gf-side-fold gf-side-around">
          <summary className="gf-side-heading">Around the forum</summary>
          {happening.length > 0 && <HappeningBlock rows={happening} hrefs={hrefs} showOrg={network} more={hrefs.happening()} />}
          {present && present.count > 0 && <WhoIsHereBlock count={present.count} people={present.people} hrefs={hrefs} />}
        </details>
      )}
    </aside>
  );
}

// ── you, at the top of the rail ─────────────────────────────────────────────

function YouBlock({ connectors, viewer, card }: { connectors: ForumConnectors; viewer: ForumViewer; card: ForumPersonCard | null }) {
  const { hrefs } = connectors;
  if (!viewer.userId) {
    if (!hrefs.signIn) return null;
    return (
      <div className="gf-side-you gf-side-you--out">
        <p className="gf-side-note">Sign in to post, watch topics and keep your place.</p>
        <a className="eac-btn eac-btn--primary gf-side-cta" href={hrefs.signIn}>Sign in · Join</a>
      </div>
    );
  }
  if (!card) return null;
  const me = hrefs.member(card.slug);
  const person: ForumPerson = { id: card.id, name: card.name, slug: card.slug, avatarUrl: card.avatarUrl, commentColor: card.commentColor };
  return (
    <div className="gf-side-you">
      <Avatar person={person} size={32} />
      <div className="gf-side-you-text">
        {me ? <a className="gf-side-you-name" href={me}>{card.name}</a> : <b className="gf-side-you-name">{card.name}</b>}
        <span className="gf-side-you-facts">{plural(card.topicCount, "topic")} · {plural(card.replyCount, "reply", "replies")}</span>
      </div>
    </div>
  );
}

/**
 * A new topic from anywhere: a button at the top of the rail that unfolds
 * the form under it. One select spans every category the viewer may post in;
 * on an org host that is just that org's categories, and the org name is left
 * off because it is the site you are standing on.
 */
function NewTopicFold({ connectors, viewer, boards, back }: { connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; back: string }) {
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
    <details className="gf-side-post">
      <summary className="eac-btn eac-btn--primary gf-side-cta">＋ New topic</summary>
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
        <textarea name="text" className="gf-textarea" rows={5} required placeholder="Say it. Blank lines make paragraphs; > quotes." aria-label="Body" />
        <div className="gf-box-foot">
          <small>{single ? `Posts in ${groups[0].feeds[0].name}` : "Pick where it belongs"}</small>
          <button type="submit" className="eac-btn eac-btn--primary">Post</button>
        </div>
      </form>
      {connectors.hrefs.newDrawing?.() && (
        <p className="gf-box-links"><a href={connectors.hrefs.newDrawing()!}>✎ or start a drawing</a></p>
      )}
    </details>
  );
}

function NewCategoryFold({ connectors, viewer, boards, back }: { connectors: ForumConnectors; viewer: ForumViewer; boards: ForumBoard[]; back: string }) {
  const { write, actionBase } = connectors;
  if (!write?.createCategory || !actionBase || !viewer.userId) return null;
  const mine = boards.filter((b) => canAddCategory(viewer, b.orgId));
  if (mine.length === 0) return null;
  const base = actionBase.replace(/\/$/, "");
  return (
    <details className="gf-box-fold gf-side-newcat">
      <summary>New category</summary>
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
  );
}
