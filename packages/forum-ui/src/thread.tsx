import * as React from "react";
import type { Constellation, ForumBoard, ForumPersonCard, ForumReply, ForumThreadRecord, ForumViewer, ForumVoters } from "@elkdonis/services";
import { SurfacePage, SurfaceSection, threadViewParts } from "@elkdonis/cms-ui/surface";
import type { ForumConnectors } from "./connectors";
import { toSurfaceThread } from "./adapters";
import { Avatar, Breadcrumb, Empty, Flash, Layout, Pagination, PersonName, SectionTitle, Time, kindLabel, plural } from "./parts";
import { ConstellationSvg, DrawLineForm, MapEdgeList } from "./map";
import { PersonWithCard } from "./people";
import { timeAgo } from "./format";
import { mediaUrl } from "./media";

/** A byline whose name carries the hover card. */
function CardByline({ person, role, at, edited, card, hrefs, size = 32 }: {
  person: ForumReply["author"]; role?: string | null; at: Date; edited?: Date | null; card?: ForumPersonCard; hrefs: ForumConnectors["hrefs"]; size?: 24 | 32;
}) {
  return (
    <div className="gf-byline">
      <Avatar person={person} size={size} />
      <PersonWithCard person={person} card={card} hrefs={hrefs} role={role} />
      <Time at={at} />
      {edited && <span className="gf-byline-edited">edited · {timeAgo(edited)}</span>}
    </div>
  );
}

// ============================================================================
// The thread page: masthead + stream.
//
// The masthead is the surface at page size — threadViewParts() gives the
// same main pane and facts rail an org site's popup shows — and the reply
// stream sits beneath it. Post #1 is the thread itself. Flat, chronological,
// paged; a reply's children fold under it in a native <details>.
//
// Every interaction is a plain <form method="post"> to the host's action
// route, so the page carries no client JavaScript. Votes are named: the
// score is a link that re-renders the page with that post's voters listed.
// ============================================================================

export function canModerate(viewer: ForumViewer, orgId: string): boolean {
  if (viewer.isGlobalAdmin) return true;
  const r = viewer.roles[orgId];
  return r === "owner" || r === "guide";
}

export function ReplyBody({ html }: { html: string }) {
  return <div className="gf-reply-body eac-surface-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Ctx {
  connectors: ForumConnectors;
  viewer: ForumViewer;
  thread: ForumThreadRecord;
  /** The page URL (path + query) to come back to after an action. */
  back: string;
  /** The reply (or "op") whose voters are expanded, from ?voters=. */
  votersFor: string | null;
  voters: ForumVoters | null;
  cards: Record<string, ForumPersonCard>;
}

function actionUrl(c: ForumConnectors, name: string): string | null {
  return c.write && c.actionBase ? `${c.actionBase.replace(/\/$/, "")}/${name}` : null;
}

function VoteBar({ ctx, replyId, score, hearts, viewerVote, viewerHearted, authorId }: {
  ctx: Ctx; replyId: string | null; score: number; hearts: number;
  viewerVote: "up" | "down" | null; viewerHearted: boolean; authorId: string;
}) {
  const { connectors, viewer, thread, back, votersFor, voters } = ctx;
  const key = replyId ?? "op";
  const anchor = replyId ? `#reply-${replyId}` : "#top";
  const votersHref = votersFor === key ? `${back.split("#")[0]}${anchor}` : `${withParam(back, "voters", key)}${anchor}`;
  const vote = actionUrl(connectors, "vote");
  const heart = actionUrl(connectors, "heart");
  const own = viewer.userId === authorId;
  const canVote = Boolean(viewer.userId) && vote && !own;
  const hidden = (
    <>
      <input type="hidden" name="thread" value={thread.id} />
      {replyId && <input type="hidden" name="reply" value={replyId} />}
      <input type="hidden" name="back" value={`${back.split("#")[0]}${anchor}`} />
    </>
  );
  return (
    <div className="gf-votes">
      {canVote ? (
        <form method="post" action={vote!} className="gf-vote-form">
          {hidden}
          <input type="hidden" name="kind" value="up" />
          <button type="submit" className={`gf-vote-btn gf-vote-btn--up${viewerVote === "up" ? " is-on" : ""}`} aria-label="Vote up" aria-pressed={viewerVote === "up"}>▲</button>
        </form>
      ) : (
        <span className="gf-vote-btn gf-vote-btn--up is-static" aria-hidden>▲</span>
      )}
      <a className="gf-score" href={votersHref} title="Who voted">{score}</a>
      {canVote ? (
        <form method="post" action={vote!} className="gf-vote-form">
          {hidden}
          <input type="hidden" name="kind" value="down" />
          <button type="submit" className={`gf-vote-btn gf-vote-btn--down${viewerVote === "down" ? " is-on" : ""}`} aria-label="Vote down" aria-pressed={viewerVote === "down"}>▼</button>
        </form>
      ) : (
        <span className="gf-vote-btn gf-vote-btn--down is-static" aria-hidden>▼</span>
      )}
      {viewer.userId && heart ? (
        <form method="post" action={heart} className="gf-vote-form">
          {hidden}
          <button type="submit" className={`gf-heart-btn${viewerHearted ? " is-on" : ""}`} aria-pressed={viewerHearted} aria-label="Heart">♥ {hearts}</button>
        </form>
      ) : (
        <a className="gf-heart-btn is-static" href={votersHref}>♥ {hearts}</a>
      )}
      {votersFor === key && voters && <VoterList voters={voters} hrefs={connectors.hrefs} />}
    </div>
  );
}

function VoterList({ voters, hrefs }: { voters: ForumVoters; hrefs: ForumConnectors["hrefs"] }) {
  const names = (list: ForumVoters["up"]) =>
    list.length === 0 ? <em>nobody</em> : list.map((p, i) => <React.Fragment key={p.id}>{i > 0 && ", "}<PersonName person={p} hrefs={hrefs} /></React.Fragment>);
  return (
    <div className="gf-voters">
      <span>▲ {names(voters.up)}</span>
      <span>▼ {names(voters.down)}</span>
      <span>♥ {names(voters.hearts)}</span>
    </div>
  );
}

function withParam(url: string, key: string, value: string): string {
  const [path, qs = ""] = url.split("#")[0].split("?");
  const sp = new URLSearchParams(qs);
  sp.set(key, value);
  sp.delete("notice"); sp.delete("error");
  return `${path}?${sp.toString()}`;
}

function replyLinks(ctx: Ctx, reply: ForumReply) {
  const base = ctx.back.split("#")[0];
  if (!ctx.connectors.write || ctx.thread.locked) return null;
  return (
    <span className="gf-reply-actions">
      <a href={`${withParam(base, "replyTo", reply.id)}#replybox`}>Reply</a>
      <a href={`${withParam(base, "quote", reply.id)}#replybox`}>Quote</a>
    </span>
  );
}

export function ReplyItem({ ctx, reply, replies: children, nested = false, isFirstUnread = false }: {
  ctx: Ctx; reply: ForumReply; replies?: ForumReply[]; nested?: boolean; isFirstUnread?: boolean;
}) {
  const { hrefs } = ctx.connectors;
  return (
    <>
      {isFirstUnread && <div className="gf-newrule" role="separator"><span>new since your last visit</span></div>}
      <article id={`reply-${reply.id}`} className={`gf-reply${nested ? " gf-reply--nested" : ""}`}>
        <div className="gf-reply-head">
          <CardByline person={reply.author} role={reply.authorRole} at={reply.createdAt} edited={reply.editedAt} card={ctx.cards[reply.author.id]} hrefs={hrefs} size={nested ? 24 : 32} />
          {reply.replyingTo && (
            <span className="gf-reply-to">↳ replying to <a href={`#reply-${reply.replyingTo.id}`}>{reply.replyingTo.name}</a></span>
          )}
          {reply.number != null && (
            <a className="gf-reply-num" href={`#reply-${reply.id}`} title="Permalink">#{reply.number + 1}</a>
          )}
        </div>
        <ReplyBody html={reply.contentHtml} />
        <div className="gf-reply-foot">
          <VoteBar ctx={ctx} replyId={reply.id} score={reply.score} hearts={reply.heartCount} viewerVote={reply.viewerVote} viewerHearted={reply.viewerHearted} authorId={reply.author.id} />
          {replyLinks(ctx, reply)}
        </div>
        {children && children.length > 0 && (
          <details className="gf-children" open={children.length <= 3}>
            <summary className="gf-children-summary">{plural(children.length, "reply", "replies")}</summary>
            <div className="gf-children-list">
              {children.map((c) => <ReplyItem key={c.id} ctx={ctx} reply={c} nested />)}
            </div>
          </details>
        )}
      </article>
    </>
  );
}

function ReplyBox({ ctx, replyTo, quote }: { ctx: Ctx; replyTo: ForumReply | null; quote: string }) {
  const { connectors, viewer, thread, back } = ctx;
  const { hrefs } = connectors;
  const url = actionUrl(connectors, "reply");
  if (thread.locked) return <div className="gf-replybox gf-replybox--gate"><p>🔒 This topic is locked.</p></div>;
  if (!url) return <div className="gf-replybox gf-replybox--gate"><p>Replying isn't available on this host.</p></div>;
  if (!viewer.userId) {
    return (
      <div className="gf-replybox gf-replybox--gate">
        <p>{hrefs.signIn ? <a href={hrefs.signIn}>Sign in</a> : "Sign in"} to reply.</p>
      </div>
    );
  }
  const base = back.split("#")[0];
  return (
    <form id="replybox" method="post" action={url} className="gf-replybox">
      <input type="hidden" name="thread" value={thread.id} />
      <input type="hidden" name="slug" value={thread.slug} />
      <input type="hidden" name="back" value={`${base}#replybox`} />
      {replyTo && <input type="hidden" name="parent" value={replyTo.id} />}
      <div className="gf-replybox-head">
        <span className="gf-replybox-title">Reply</span>
        {replyTo && (
          <span className="gf-chip gf-chip--replyto">
            replying to {replyTo.author.name} <a href={`${withParamRemoved(base, "replyTo")}#replybox`} aria-label="Cancel reply-to">×</a>
          </span>
        )}
      </div>
      <textarea name="text" className="gf-textarea" rows={quote ? 8 : 5} required defaultValue={quote ? `${quote}\n\n` : ""} placeholder="Write your reply. Blank lines make paragraphs; lines starting with > quote." />
      <div className="gf-replybox-foot">
        <span className="gf-replybox-hint">Plain text. Blank line = new paragraph · <code>&gt;</code> = quote</span>
        <button type="submit" className="eac-btn eac-btn--primary">Post reply</button>
      </div>
    </form>
  );
}

function withParamRemoved(url: string, key: string): string {
  const [path, qs = ""] = url.split("?");
  const sp = new URLSearchParams(qs);
  sp.delete(key);
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

function Toolbar({ ctx, board }: { ctx: Ctx; board: ForumBoard | null }) {
  const { connectors, viewer, thread, back } = ctx;
  const { hrefs, scope } = connectors;
  const watch = actionUrl(connectors, "watch");
  const bookmark = actionUrl(connectors, "bookmark");
  const moderate = actionUrl(connectors, "moderate");
  const base = back.split("#")[0];
  if (!viewer.userId) {
    return hrefs.signIn ? <div className="gf-toolbar"><a className="gf-tool" href={hrefs.signIn}>☆ Watch</a><a className="gf-tool" href={hrefs.signIn}>⚑ Bookmark</a></div> : null;
  }
  const mod = moderate && canModerate(viewer, thread.org.id);
  const own = viewer.userId === thread.author.id || Boolean(viewer.identityIds?.includes(thread.author.id));
  const remove = actionUrl(connectors, "remove");
  const feeds = board?.feeds ?? [];
  const wikiHref = connectors.wiki?.define ? hrefs.wiki?.() : null;
  const defineHref = wikiHref
    ? `${wikiHref}?from=${encodeURIComponent(thread.id)}`
    : null;
  const editDrawing = thread.isDrawing && hrefs.drawing && (viewer.userId === thread.author.id || viewer.identityIds?.includes(thread.author.id) || mod)
    ? hrefs.drawing(thread.id)
    : null;
  return (
    <div className="gf-toolbar">
      {editDrawing && <a className="gf-tool" href={editDrawing}>✎ Edit drawing</a>}
      {watch && (
        <form method="post" action={watch}>
          <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} />
          <button type="submit" className={`gf-tool${thread.viewerWatching ? " is-on" : ""}`} aria-pressed={thread.viewerWatching}>{thread.viewerWatching ? "★ Watching" : "☆ Watch"}</button>
        </form>
      )}
      {bookmark && (
        <form method="post" action={bookmark}>
          <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} />
          <button type="submit" className={`gf-tool${thread.viewerBookmarked ? " is-on" : ""}`} aria-pressed={thread.viewerBookmarked}>{thread.viewerBookmarked ? "⚑ Bookmarked" : "⚑ Bookmark"}</button>
        </form>
      )}
      {/* Reading is when you notice a word nobody has defined. A link rather
          than a box in the toolbar: the form lives in the wiki section, and
          `from` carries this topic so the term records it as a reference. */}
      {defineHref && (
        <a className="gf-tool" href={defineHref} title="Add a word to the dictionary">
          § Define a word
        </a>
      )}
      {/* The author's own way out: two steps without a script — open, then
          confirm. Moderators have Archive in their menu already. */}
      {own && !mod && remove && (
        <details className="gf-mod">
          <summary className="gf-tool">Remove</summary>
          <div className="gf-mod-menu">
            <p className="gf-mod-note">Take this topic down? It comes off every list; a moderator can restore it.</p>
            <form method="post" action={remove}>
              <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} />
              <button type="submit" className="gf-mod-item gf-mod-item--danger">Yes, remove my topic</button>
            </form>
          </div>
        </details>
      )}
      {mod && (
        <details className="gf-mod">
          <summary className="gf-tool">⋯ moderate</summary>
          <div className="gf-mod-menu">
            {(["pin", "lock"] as const).map((a) => {
              const on = a === "pin" ? thread.pinned : thread.locked;
              const act = on ? `un${a}` : a;
              return (
                <form key={a} method="post" action={moderate!}>
                  <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} /><input type="hidden" name="do" value={act} />
                  <button type="submit" className="gf-mod-item">{act === "pin" ? "📌 Pin" : act === "unpin" ? "Unpin" : act === "lock" ? "🔒 Lock" : "Unlock"}</button>
                </form>
              );
            })}
            {feeds.length > 1 && (
              <form method="post" action={moderate!} className="gf-mod-move">
                <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} /><input type="hidden" name="do" value="move" />
                <label>Move to <select name="arg" defaultValue={thread.feed.slug}>{feeds.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
                <button type="submit" className="gf-mod-item">Move</button>
              </form>
            )}
            <form method="post" action={moderate!}>
              <input type="hidden" name="thread" value={thread.id} /><input type="hidden" name="back" value={base} /><input type="hidden" name="do" value="delete" />
              <button type="submit" className="gf-mod-item gf-mod-item--danger">Archive topic</button>
            </form>
            <a className="gf-mod-item" href={scope.kind === "network" ? `${hrefs.board(thread.org.slug)}/log` : `${hrefs.root().replace(/\/$/, "")}/log`}>Moderation log →</a>
          </div>
        </details>
      )}
    </div>
  );
}

export interface ThreadPageViewProps {
  boxes?: React.ReactNode;
  connectors: ForumConnectors;
  viewer: ForumViewer;
  thread: ForumThreadRecord;
  replies: { rows: Array<ForumReply & { children: ForumReply[] }>; page: number; totalPages: number; total: number };
  href: string;
  back: string;
  board: ForumBoard | null;
  votersFor: string | null;
  voters: ForumVoters | null;
  replyTo: ForumReply | null;
  quote: string;
  cards?: Record<string, ForumPersonCard>;
  constellation?: Constellation | null;
  notice: string | null;
  error: string | null;
}

export function ThreadPageView(p: ThreadPageViewProps) {
  const { connectors, viewer, thread, replies, href, board } = p;
  const { hrefs, scope, siteName } = connectors;
  const ctx: Ctx = { connectors, viewer, thread, back: p.back, votersFor: p.votersFor, voters: p.voters, cards: p.cards ?? {} };
  const surface = toSurfaceThread(thread, href);
  const parts = threadViewParts(surface, {}, { showCover: true });
  const network = scope.kind === "network";

  const crumb = (
    <Breadcrumb
      items={[
        { label: network ? "Forum" : siteName, href: hrefs.root() },
        ...(network ? [{ label: thread.org.name, href: hrefs.board(thread.org.slug) }] : []),
        { label: thread.feed.name ?? thread.feed.slug, href: hrefs.feed(thread.org.slug, thread.feed.slug) },
        { label: thread.title },
      ]}
    />
  );

  const kicker = [kindLabel(thread.kind), thread.feed.name, network ? thread.org.name : null].filter(Boolean).join(" · ");

  const fromOrg = network && board;
  const graph = p.constellation ?? null;
  const mapHref = `${href}/map`;
  const lineBase = viewer.userId && connectors.write?.drawLine && connectors.actionBase ? connectors.actionBase : null;
  // The map, small: what this thread is connected to, and a way to draw a
  // line from here. Even an unconnected thread shows the box — the form is
  // how the first line gets drawn.
  const constellation = graph && (
    <section className="gf-rail-block gf-box gf-box--map">
      <SectionTitle more={graph.edges.length > 0 ? mapHref : null} moreLabel="open the map →">Constellation</SectionTitle>
      {graph.edges.length === 0 ? (
        <p className="gf-rail-empty">Nothing linked here yet.</p>
      ) : (
        <>
          {/* Not wrapped in a link: every node already is one, and an <a>
              inside an <a> is invalid HTML that breaks hydration. The title's
              "open the map →" is the way to the full page. */}
          <div className="gf-map-link">
            <ConstellationSvg graph={graph} hrefs={hrefs} size={260} compact />
          </div>
          <p className="gf-map-summary">
            {plural(graph.nodes.length, "connection")}{graph.omitted > 0 ? ` (${graph.omitted} more on the map)` : ""}
          </p>
        </>
      )}
      {lineBase && <DrawLineForm actionBase={lineBase} threadId={thread.id} back={p.back.split("#")[0]} compact />}
    </section>
  );
  // The facts rail and the org card go to the page's column, above the
  // shell's boxes, so the thread itself runs the full width of the main pane.
  const rail = !parts.rail && !fromOrg && !constellation ? null : (
    <>
      {parts.rail && <section className="gf-rail-block gf-box gf-box--facts">{parts.rail}</section>}
      {constellation}
      {fromOrg && (
        <SurfaceSection title={`From ${board.name}`}>
          <div className="gf-from-org">
            {board.identity?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="gf-org-portrait" src={mediaUrl(board.identity.avatarUrl)!} alt="" />
            ) : null}
            <div>
              {board.identity?.headline && <p className="gf-from-org-headline">{board.identity.headline}</p>}
              <p className="gf-from-org-links">
                <a href={hrefs.board(board.slug)}>board →</a>
                {hrefs.orgSite(board) && <> · <a href={hrefs.orgSite(board)!} target="_blank" rel="noreferrer">site ↗</a></>}
                {board.identity?.slug && hrefs.profile?.(board.identity.slug) && <> · <a href={hrefs.profile(board.identity.slug)!} target="_blank" rel="noreferrer">ArtDirect ↗</a></>}
              </p>
            </div>
          </div>
        </SurfaceSection>
      )}
    </>
  );

  const status = (
    <span className="gf-thread-status">
      {thread.pinned && <span className="gf-chip">📌 Pinned</span>}
      {thread.locked && <span className="gf-chip">🔒 Locked</span>}
      {thread.visibility === "ORGANIZATION" && <span className="gf-chip gf-chip--members">members</span>}
      <span className="gf-thread-counts">{plural(thread.viewCount, "view")}</span>
    </span>
  );

  // The "new since" rule goes before the first top-level reply newer than
  // the viewer's mark (or with something newer underneath it).
  const since = thread.lastReadAt ? new Date(thread.lastReadAt).getTime() : null;
  const firstUnreadId = since == null ? null : replies.rows.find((r) =>
    new Date(r.createdAt).getTime() > since || r.children.some((c) => new Date(c.createdAt).getTime() > since)
  )?.id ?? null;

  const main = (
    <div className="gf-thread" data-kind={thread.kind} id="top">
      <Flash notice={p.notice} error={p.error} />
      <div className="gf-thread-top">
        {crumb}
        <Toolbar ctx={ctx} board={board} />
      </div>
      <SurfacePage kind={thread.kind} title={thread.title} kicker={kicker} status={status} className="gf-sheet">
        <div className="gf-op-byline">
          <CardByline person={thread.author} at={thread.publishedAt ?? thread.createdAt} card={ctx.cards[thread.author.id]} hrefs={hrefs} />
        </div>
        {parts.main}
        <div className="gf-reply-foot gf-op-foot">
          <VoteBar ctx={ctx} replyId={null} score={thread.score} hearts={thread.heartCount} viewerVote={thread.viewerVote} viewerHearted={thread.viewerHearted} authorId={thread.author.id} />
        </div>
      </SurfacePage>

      <section className="gf-stream" aria-label="Replies">
        <header className="gf-stream-head">
          <h2 className="gf-stream-title">{plural(thread.replyCount, "reply", "replies")}</h2>
          <Pagination paged={replies} href={href} />
        </header>

        {replies.rows.length === 0 ? (
          <Empty>{thread.locked ? "This topic is locked." : "No replies yet."}</Empty>
        ) : (
          <div className="gf-replies">
            {replies.rows.map((r) => <ReplyItem key={r.id} ctx={ctx} reply={r} replies={r.children} isFirstUnread={r.id === firstUnreadId} />)}
          </div>
        )}

        <footer className="gf-stream-foot">
          <Pagination paged={replies} href={href} />
        </footer>

        <ReplyBox ctx={ctx} replyTo={p.replyTo} quote={p.quote} />
      </section>
    </div>
  );

  return <Layout boxes={p.boxes} rail={rail} main={main} />;
}

export { Avatar, PersonName, Time };
