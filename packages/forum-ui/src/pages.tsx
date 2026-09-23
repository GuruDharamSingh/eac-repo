import * as React from "react";
import type { ForumBoard, ForumReply, ForumSort, ForumViewer, ForumVoters } from "@elkdonis/services";
import type { ForumConnectors } from "./connectors";
import {
  Agenda, BoardTable, Breadcrumb, Empty, Flash, HappeningBlock, LatestBlock, Layout, NewTopicLink, OrgMasthead, PageHead, Pagination,
  PulseStrip, ReadAllForm, SectionTitle, SortTabs, TopicList, TopicsBlock, plural,
} from "./parts";
import { ThreadPageView, canModerate } from "./thread";
import { timeAgo } from "./format";
import { MemberPageView, MembersDirectory, NewMembersBlock, OrgsDirectory, TopicReviewPage, TopicsIndex } from "./people";
import { ConstellationSvg, DrawLineForm, EraseLineForm, MapEdgeList, MapLegend, mapSize } from "./map";
import { ModLog, SearchResults } from "./search";

// ============================================================================
// The pages. Each is an async server component that takes the connectors
// and whatever the URL said, fetches through the connectors, and lays the
// parts out. Nothing here is client-side.
// ============================================================================

export interface PageProps {
  connectors: ForumConnectors;
  viewer: ForumViewer;
  searchParams: Record<string, string | string[] | undefined>;
  /** The request path (no query), for forms to come back to. */
  path: string;
  /** The shell's right-column boxes, built once per request (see shell.tsx). */
  boxes?: React.ReactNode;
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function readSort(sp: PageProps["searchParams"]): ForumSort {
  const s = str(sp.sort);
  return s === "newest" || s === "top" ? s : "active";
}

export function readPage(sp: PageProps["searchParams"]): number {
  const n = parseInt(str(sp.page) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function flash(sp: PageProps["searchParams"]) {
  return { notice: str(sp.notice) ?? null, error: str(sp.error) ?? null };
}

/** The current URL with its query, minus the flash — what forms post `back`. */
function backUrl(path: string, sp: PageProps["searchParams"]): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "notice" || k === "error" || v == null) continue;
    q.set(k, Array.isArray(v) ? v[0] : v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export { Layout };

function withSort(href: string, sort: ForumSort): string {
  return sort === "active" ? href : `${href}?sort=${sort}`;
}

// ── / ───────────────────────────────────────────────────────────────────────

export async function IndexPage(props: PageProps) {
  const { connectors, viewer, searchParams, path, boxes } = props;
  const { scope, hrefs } = connectors;
  const network = scope.kind === "network";
  const sort = readSort(searchParams);
  const page = readPage(searchParams);
  const root = hrefs.root().replace(/\/$/, "");

  const [paged, latest, topics, pulse, newest, board] = await Promise.all([
    connectors.listTopics(network ? { kind: "network" } : { kind: "org", orgId: scope.orgId }, viewer, { sort, page, limit: 25 }),
    connectors.listLatest(scope, viewer, { limit: 8 }),
    connectors.listTopicIndex?.(viewer, 12) ?? Promise.resolve([]),
    network ? connectors.pulse?.(viewer) ?? Promise.resolve(null) : Promise.resolve(null),
    network ? connectors.listNewMembers?.(5) ?? Promise.resolve(null) : Promise.resolve(null),
    network ? Promise.resolve(null) : connectors.listBoards(scope, viewer).then((b) => b[0] ?? null),
  ]);

  const main = (
    <>
      <Flash {...flash(searchParams)} />
      {pulse && <PulseStrip pulse={pulse} hrefs={hrefs} />}
      <PageHead
        title={network ? "All threads" : "Forum"}
        sub={network
          ? "Every org, every category, newest activity first."
          : board ? `${plural(board.feeds.reduce((n, f) => n + f.topicCount, 0), "topic")} · ${plural(board.feeds.reduce((n, f) => n + f.postCount, 0), "post")}` : undefined}
        aside={<SortTabs current={sort} href={hrefs.root()} />}
      />
      <TopicList paged={paged} hrefs={hrefs} showOrg={network} empty="Nothing posted yet — the New topic box on the right is where it starts." />
      <Pagination paged={paged} href={withSort(hrefs.root(), sort)} />
      {viewer.userId && connectors.actionBase && (
        <div className="gf-index-foot">
          <span className="gf-legend"><span className="gf-unread-dot" /> unread</span>
          <ReadAllForm actionBase={connectors.actionBase} back={backUrl(path, searchParams)} />
        </div>
      )}
    </>
  );

  const rail = (
    <>
      <LatestBlock rows={latest} hrefs={hrefs} more={hrefs.latest()} />
      <TopicsBlock rows={topics} hrefs={hrefs} />
      {newest && <NewMembersBlock people={newest} hrefs={hrefs} more={`${root}/members`} />}
    </>
  );

  return <Layout boxes={boxes} main={main} rail={rail} />;
}

// ── /members, /members/[slug], /orgs, /topics, /topics/[slug], /topics/review ──

export async function MembersPage({ boxes, connectors, viewer, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const sortRaw = str(searchParams.sort);
  const sort = sortRaw === "newest" || sortRaw === "name" ? sortRaw : "active";
  const q = str(searchParams.q) ?? "";
  const paged = (await connectors.listMembers?.({ sort, q, page: readPage(searchParams), limit: 50 })) ?? { rows: [], page: 1, limit: 50, total: 0, totalPages: 1 };
  return (
    <Layout boxes={boxes} main={<>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Members" }]} />
      <MembersDirectory paged={paged} hrefs={hrefs} sort={sort} q={q} href={path} />
    </>} />
  );
}

export async function MemberPage({ boxes, connectors, viewer, searchParams, path, slug }: PageProps & { slug: string }) {
  const member = await connectors.getMember?.(slug);
  if (!member) return null;
  const self = Boolean(viewer.userId && viewer.userId === member.id);
  const tabRaw = str(searchParams.tab);
  const tab: "activity" | "topics" | "replies" | "watching" | "bookmarks" | "map" =
    tabRaw === "topics" || tabRaw === "replies" ? tabRaw
    : tabRaw === "map" && connectors.personMap ? "map"
    : self && (tabRaw === "watching" || tabRaw === "bookmarks") ? tabRaw
    : "activity";
  const page = readPage(searchParams);
  const empty = { rows: [], page: 1, limit: 25, total: 0, totalPages: 1 };
  const [activity, followed, map] = await Promise.all([
    tab === "watching" || tab === "bookmarks" || tab === "map"
      ? Promise.resolve(empty)
      : connectors.listMemberActivity?.(member.id, viewer, { page, limit: 25, only: tab === "activity" ? undefined : tab === "topics" ? "topic" : "reply" }) ?? Promise.resolve(empty),
    tab === "watching" || tab === "bookmarks"
      ? connectors.listTopics({ kind: tab, scope: connectors.scope }, viewer, { page, limit: 25 })
      : Promise.resolve(null),
    tab === "map" ? connectors.personMap!(member.id, viewer) : Promise.resolve(null),
  ]);
  return (
    <Layout boxes={boxes} main={<>
      <Flash {...flash(searchParams)} />
      <MemberPageView connectors={connectors} member={member} activity={activity} followed={followed} map={map} tab={tab} self={self} href={path} back={backUrl(path, searchParams)} profileUrl={connectors.hrefs.profile?.(member.slug) ?? null} />
    </>} />
  );
}

export async function OrgsPage({ boxes, connectors, viewer, searchParams }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const cards = (await connectors.listOrgCards?.(viewer)) ?? [];
  const tierRaw = str(searchParams.tier);
  const tier = tierRaw === "partner" || tierRaw === "supported" || tierRaw === "free" ? tierRaw : null;
  return (
    <Layout boxes={boxes} main={<>
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Orgs" }]} />
      <OrgsDirectory cards={cards.filter((c) => c.topicCount > 0 || c.feedCount > 1)} hrefs={hrefs} tier={tier} />
    </>} />
  );
}

export async function TopicsPage({ boxes, connectors, viewer, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const entries = (await connectors.listTopicEntries?.(viewer, { includeProposed: Boolean(viewer.isGlobalAdmin) })) ?? [];
  return (
    <Layout boxes={boxes} main={<>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Topics" }]} />
      <TopicsIndex entries={entries} hrefs={hrefs} viewer={viewer} connectors={connectors} />
    </>} />
  );
}

export async function TopicPage({ boxes, connectors, viewer, searchParams, path, slug }: PageProps & { slug: string }) {
  const { hrefs, scope, siteName } = connectors;
  const topic = await connectors.getTopicBySlug?.(slug);
  if (!topic) return null;
  const sort = readSort(searchParams);
  const paged = await connectors.listTopics({ kind: "topic", topicId: topic.id }, viewer, { sort, page: readPage(searchParams), limit: 30 });
  const root = hrefs.root().replace(/\/$/, "");
  return (
    <Layout boxes={boxes} main={<>
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Topics", href: `${root}/topics` }, { label: topic.name }]} />
      <PageHead title={topic.name} sub={[topic.status === "proposed" ? "proposed · awaiting review" : null, plural(paged.total, "topic")].filter(Boolean).join(" · ")} aside={<SortTabs current={sort} href={path} />}>
        {topic.description && <p className="gf-feed-tagline">{topic.description}</p>}
      </PageHead>
      <TopicList paged={paged} hrefs={hrefs} showOrg={scope.kind === "network"} empty="Nothing tagged with this yet." />
      <Pagination paged={paged} href={withSort(path, sort)} />
    </>} />
  );
}

export async function TopicReviewRoute({ boxes, connectors, viewer, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const root = hrefs.root().replace(/\/$/, "");
  if (!viewer.isGlobalAdmin || !connectors.actionBase) {
    return <Layout boxes={boxes} main={<><PageHead title="Review proposed topics" /><Empty>Admins only.</Empty></>} />;
  }
  const entries = (await connectors.listTopicEntries?.(viewer, { includeProposed: true })) ?? [];
  return (
    <Layout boxes={boxes} main={<>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Topics", href: `${root}/topics` }, { label: "Review" }]} />
      <TopicReviewPage entries={entries} hrefs={hrefs} actionBase={connectors.actionBase} back={backUrl(path, searchParams)} />
    </>} />
  );
}

// ── /search, /o/[org]/log ───────────────────────────────────────────────────

export async function SearchPage({ boxes, connectors, viewer, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const q = (str(searchParams.q) ?? "").trim();
  const onlyRaw = str(searchParams.only);
  const only = onlyRaw === "thread" || onlyRaw === "reply" ? onlyRaw : "all";
  const paged = q && connectors.searchForum
    ? await connectors.searchForum(q, viewer, { scope, page: readPage(searchParams), limit: 25, only: only === "all" ? undefined : only })
    : { rows: [], page: 1, limit: 25, total: 0, totalPages: 1 };
  return (
    <Layout boxes={boxes} main={<>
      <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: "Search" }]} />
      <SearchResults paged={paged} q={q} hrefs={hrefs} href={path} showOrg={scope.kind === "network"} only={only} />
    </>} />
  );
}

export async function ModLogPage({ boxes, connectors, viewer, searchParams, path, orgSlug }: PageProps & { orgSlug: string }) {
  const { hrefs, scope, siteName } = connectors;
  const board = scope.kind === "network"
    ? await connectors.getBoardBySlug(orgSlug, viewer)
    : (await connectors.listBoards(scope, viewer))[0] ?? null;
  if (!board) return null;
  const crumb = <Breadcrumb items={[{ label: scope.kind === "network" ? "Forum" : siteName, href: hrefs.root() }, { label: board.name, href: hrefs.board(board.slug) }, { label: "Log" }]} />;
  if (!canModerate(viewer, board.orgId)) {
    return <Layout boxes={boxes} main={<>{crumb}<PageHead title="Moderation log" /><Empty>Owners and guides of {board.name} only.</Empty></>} />;
  }
  const paged = (await connectors.listModLog?.(board.orgId, { page: readPage(searchParams), limit: 50 })) ?? { rows: [], page: 1, limit: 50, total: 0, totalPages: 1 };
  return <Layout boxes={boxes} main={<>{crumb}<ModLog paged={paged} hrefs={hrefs} href={path} orgName={board.name} /></>} />;
}

// ── /o/[org] ────────────────────────────────────────────────────────────────

export async function BoardPageView({ boxes, connectors, viewer, searchParams, path, board }: PageProps & { board: ForumBoard | null }) {
  const { scope, hrefs } = connectors;
  if (!board) return <Empty>No such board.</Empty>;
  const network = scope.kind === "network";
  const orgScope = { kind: "org" as const, orgId: board.orgId };

  const [happening, latest] = await Promise.all([
    connectors.listHappening(orgScope, viewer, { limit: 5 }),
    connectors.listLatest(orgScope, viewer, { limit: 8 }),
  ]);

  const topics = board.feeds.reduce((n, f) => n + f.topicCount, 0);
  const posts = board.feeds.reduce((n, f) => n + f.postCount, 0);
  const feeds = board.feeds.filter((f) => !(f.slug === "general" && f.topicCount === 0 && board.feeds.length > 1));

  const main = (
    <>
      <Flash {...flash(searchParams)} />
      {network && <Breadcrumb items={[{ label: "Boards", href: hrefs.root() }, { label: board.name }]} />}
      {network ? (
        <>
          <OrgMasthead board={board} hrefs={hrefs} as="header" />
          <p className="gf-org-stats">
            {plural(board.feeds.length, "forum")} · {plural(topics, "topic")} · {plural(posts, "post")}
          </p>
        </>
      ) : (
        <PageHead title="Forum" sub={`${plural(topics, "topic")} · ${plural(posts, "post")}`} />
      )}
      {feeds.length === 0 ? <Empty>No categories yet.</Empty> : <BoardTable board={{ ...board, feeds }} hrefs={hrefs} />}
      {viewer.userId && connectors.actionBase && (
        <div className="gf-index-foot">
          <span className="gf-legend"><span className="gf-unread-dot" /> unread</span>
          {feeds.length > 0 && (
            <NewTopicLink href={`${hrefs.feed(board.slug, feeds[0].slug)}#newtopic`} />
          )}
          <ReadAllForm actionBase={connectors.actionBase} back={backUrl(path, searchParams)} />
        </div>
      )}
    </>
  );

  const rail = (
    <>
      <HappeningBlock rows={happening} hrefs={hrefs} showOrg={false} more={hrefs.happening()} />
      <LatestBlock rows={latest} hrefs={hrefs} more={hrefs.latest()} />
    </>
  );

  return <Layout boxes={boxes} main={main} rail={rail} />;
}

// ── /o/[org]/[feed] ─────────────────────────────────────────────────────────

async function NewTopicForm({ connectors, viewer, board, feed, back }: {
  connectors: ForumConnectors; viewer: ForumViewer; board: ForumBoard; feed: ForumBoard["feeds"][number]; back: string;
}) {
  const { hrefs, actionBase, write } = connectors;
  const network = connectors.scope.kind === "network";
  if (!write || !actionBase) {
    return (
      <div className="gf-newtopic gf-newtopic--gate">
        <p className="gf-newtopic-note">New topics are made on {network ? board.name : "this site"}.</p>
      </div>
    );
  }
  if (!viewer.userId) {
    return (
      <div className="gf-newtopic gf-newtopic--gate">
        <p className="gf-newtopic-note">{hrefs.signIn ? <a href={hrefs.signIn}>Sign in</a> : "Sign in"} to start a topic in {feed.name}.</p>
      </div>
    );
  }
  const role = viewer.roles[board.orgId] ?? null;
  const rank: Record<string, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };
  if (feed.minRole && !viewer.isGlobalAdmin && (rank[role ?? ""] ?? 0) < (rank[feed.minRole] ?? 0)) {
    return (
      <div className="gf-newtopic gf-newtopic--gate">
        <p className="gf-newtopic-note">This forum is for members of {board.name}.</p>
      </div>
    );
  }
  const choices = (await connectors.listTopicChoices?.(board.orgId)) ?? [];
  const mod = canModerate(viewer, board.orgId);
  const nc = mod ? await connectors.ncForum?.(board.orgId) : null;
  const base = actionBase.replace(/\/$/, "");
  return (
    <div className="gf-newtopic" id="newtopic">
      <form method="post" action={`${base}/topic`}>
        <input type="hidden" name="org" value={board.orgId} />
        <input type="hidden" name="feed" value={feed.slug} />
        <input type="hidden" name="back" value={`${back}#newtopic`} />
        <h2 className="gf-newtopic-title">New topic in {feed.name}</h2>
        <label className="gf-field">
          <span className="gf-field-label">Title</span>
          <input name="title" className="gf-input" required minLength={2} maxLength={200} placeholder="What is it about?" />
        </label>
        {choices.length > 0 && (
          <fieldset className="gf-field gf-topicpick">
            <legend className="gf-field-label">Topics</legend>
            {choices.map((t) => (
              <label key={t.id} className={`gf-chip gf-chip--pick${t.status === "proposed" ? " is-proposed" : ""}`}>
                <input type="checkbox" name="topics" value={t.id} /> {t.name}{t.status === "proposed" ? " (proposed)" : ""}
              </label>
            ))}
          </fieldset>
        )}
        <label className="gf-field">
          <span className="gf-field-label">Body</span>
          <textarea name="text" className="gf-textarea" rows={7} required placeholder="Blank lines make paragraphs; lines starting with > quote." />
        </label>
        {nc && (
          <label className="gf-field gf-field--check gf-nc-sync">
            <input type="checkbox" name="nc_sync" value="1" />
            <span>
              Also post to Nextcloud <span className="gf-chip gf-chip--nc">NC</span>
              <span className="gf-field-hint">
                {nc.isPublic
                  ? " Shared in the org's Nextcloud forum; anyone signed in can reply."
                  : " Shared in the org's Nextcloud forum; members-only here, and replies are for members."}
              </span>
            </span>
          </label>
        )}
        <div className="gf-replybox-foot">
          <span className="gf-replybox-hint">Events, meetings and media are made on {network ? board.name : "the site"} →</span>
          <button type="submit" className="eac-btn eac-btn--primary">Post topic</button>
        </div>
      </form>
      {mod && (
        <form method="post" action={`${base}/propose-topic`} className="gf-propose">
          <input type="hidden" name="org" value={board.orgId} />
          <input type="hidden" name="back" value={`${back}#newtopic`} />
          <label className="gf-field gf-field--inline">
            <span className="gf-field-label">Propose a topic</span>
            <input name="name" className="gf-input" minLength={2} maxLength={60} placeholder="e.g. Meditation" />
          </label>
          <button type="submit" className="gf-tool">Propose</button>
        </form>
      )}
    </div>
  );
}

export async function FeedPage({ boxes, connectors, viewer, searchParams, path, orgSlug, feedSlug }: PageProps & { orgSlug: string; feedSlug: string }) {
  const { scope, hrefs, siteName } = connectors;
  const network = scope.kind === "network";

  const board = network
    ? await connectors.getBoardBySlug(orgSlug, viewer)
    : (await connectors.listBoards(scope, viewer))[0] ?? null;
  if (!board) return null;
  const feedRow = board.feeds.find((f) => f.slug === feedSlug);
  if (!feedRow) return null;

  const sort = readSort(searchParams);
  const page = readPage(searchParams);
  const href = hrefs.feed(board.slug, feedSlug);
  const paged = await connectors.listTopics({ kind: "feed", orgId: board.orgId, feedSlug }, viewer, { sort, page, limit: 25 });

  const main = (
    <div style={feedRow.accent ? ({ ["--gf-feed" as string]: feedRow.accent } as React.CSSProperties) : undefined}>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[
        { label: network ? "Forum" : siteName, href: hrefs.root() },
        ...(network ? [{ label: board.name, href: hrefs.board(board.slug) }] : []),
        { label: feedRow.name },
      ]} />
      <PageHead
        title={feedRow.name}
        sub={[feedRow.presenter && `Presented by ${feedRow.presenter}`, plural(paged.total, "topic")].filter(Boolean).join(" · ")}
        aside={<SortTabs current={sort} href={href} />}
      >
        {feedRow.tagline && <p className="gf-feed-tagline">{feedRow.tagline}</p>}
      </PageHead>
      <TopicList paged={paged} hrefs={hrefs} showOrg={false} empty="No topics yet — start one below." />
      <Pagination paged={paged} href={withSort(href, sort)} />
      <NewTopicForm connectors={connectors} viewer={viewer} board={board} feed={feedRow} back={backUrl(path, searchParams)} />
    </div>
  );

  return <Layout boxes={boxes} main={main} />;
}

// ── /latest, /unread, /watching, /bookmarks ─────────────────────────────────

export async function ListPage({ boxes, connectors, viewer, searchParams, path, view }: PageProps & { view: "latest" | "unread" | "watching" | "bookmarks" }) {
  const { scope, hrefs, siteName } = connectors;
  const network = scope.kind === "network";
  const sort = readSort(searchParams);
  const page = readPage(searchParams);
  const href = view === "latest" ? hrefs.latest() : `${hrefs.root().replace(/\/$/, "")}/${view}`;
  const target =
    view === "latest"
      ? scope.kind === "org" ? { kind: "org" as const, orgId: scope.orgId } : { kind: "network" as const }
      : { kind: view, scope };
  const titles = { latest: "Latest", unread: "Unread", watching: "Watching", bookmarks: "Bookmarks" };
  const empties = {
    latest: "Nothing here yet.",
    unread: "You're all caught up.",
    watching: "You aren't watching any topics. Reply to one, or press ☆ Watch on a thread.",
    bookmarks: "No bookmarks yet.",
  };

  if (view !== "latest" && !viewer.userId) {
    return (
      <Layout boxes={boxes} main={<>
        <Breadcrumb items={[{ label: network ? "Forum" : siteName, href: hrefs.root() }, { label: titles[view] }]} />
        <PageHead title={titles[view]} />
        <Empty>{hrefs.signIn ? <a href={hrefs.signIn}>Sign in</a> : "Sign in"} to see your {view}.</Empty>
      </>} />
    );
  }

  const paged = await connectors.listTopics(target, viewer, { sort, page, limit: 30 });
  const main = (
    <>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[{ label: network ? "Forum" : siteName, href: hrefs.root() }, { label: titles[view] }]} />
      <PageHead
        title={titles[view]}
        sub={plural(paged.total, "topic")}
        aside={<span className="gf-pagehead-tools"><SortTabs current={sort} href={href} />{view === "unread" && connectors.actionBase && <ReadAllForm actionBase={connectors.actionBase} back={backUrl(path, searchParams)} />}</span>}
      />
      <TopicList paged={paged} hrefs={hrefs} showOrg={network} empty={empties[view]} />
      <Pagination paged={paged} href={withSort(href, sort)} />
    </>
  );
  return <Layout boxes={boxes} main={main} />;
}

// ── /happening ──────────────────────────────────────────────────────────────

export async function HappeningPage({ boxes, connectors, viewer, searchParams }: PageProps) {
  const { scope, hrefs, siteName } = connectors;
  const network = scope.kind === "network";
  const range = str(searchParams.range) === "all" ? "all" : str(searchParams.range) === "month" ? "month" : "week";
  const days = range === "week" ? 7 : range === "month" ? 31 : undefined;
  const rows = await connectors.listHappening(scope, viewer, { limit: 50, days });
  const href = hrefs.happening();

  const tabs = (
    <nav className="gf-sorts" aria-label="Range">
      {(["week", "month", "all"] as const).map((r) => (
        <a key={r} href={r === "week" ? href : `${href}?range=${r}`} className={`gf-sort${range === r ? " is-current" : ""}`} aria-current={range === r ? "page" : undefined}>
          {r === "week" ? "This week" : r === "month" ? "Month" : "All"}
        </a>
      ))}
    </nav>
  );

  const main = (
    <>
      <Breadcrumb items={[{ label: network ? "Forum" : siteName, href: hrefs.root() }, { label: "Happening" }]} />
      <PageHead title="Happening" sub={plural(rows.length, "gathering")} aside={tabs} />
      <Agenda rows={rows} hrefs={hrefs} showOrg={network} />
    </>
  );
  return <Layout boxes={boxes} main={main} />;
}

// ── /notifications ──────────────────────────────────────────────────────────

export async function NotificationsPage({ boxes, connectors, viewer, searchParams, path }: PageProps) {
  const { hrefs, scope, siteName } = connectors;
  const network = scope.kind === "network";
  const crumb = <Breadcrumb items={[{ label: network ? "Forum" : siteName, href: hrefs.root() }, { label: "Notifications" }]} />;
  if (!viewer.userId) {
    return <Layout boxes={boxes} main={<>{crumb}<PageHead title="Notifications" /><Empty>{hrefs.signIn ? <a href={hrefs.signIn}>Sign in</a> : "Sign in"} to see notifications.</Empty></>} />;
  }
  const items = (await connectors.listNotifications?.(viewer.userId, 100)) ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const base = connectors.actionBase?.replace(/\/$/, "");
  const main = (
    <>
      <Flash {...flash(searchParams)} />
      {crumb}
      <PageHead
        title="Notifications"
        sub={unread ? `${unread} unread` : "all read"}
        aside={base && unread > 0 ? (
          <form method="post" action={`${base}/notifications-read`}>
            <input type="hidden" name="back" value={backUrl(path, searchParams)} />
            <button type="submit" className="gf-tool">Mark all read</button>
          </form>
        ) : undefined}
      />
      {items.length === 0 ? <Empty>Nothing yet. Replies to you, hearts on your posts and topics you watch land here.</Empty> : (
        <ol className="gf-notifs">
          {items.map((n) => <li key={n.id} className={`gf-notif${n.readAt ? "" : " is-unread"}`}><NotificationLine n={n} hrefs={hrefs} /></li>)}
        </ol>
      )}
    </>
  );
  return <Layout boxes={boxes} main={main} />;
}

export function NotificationLine({ n, hrefs }: { n: NonNullable<Awaited<ReturnType<NonNullable<ForumConnectors["listNotifications"]>>>>[number]; hrefs: ForumConnectors["hrefs"] }) {
  const who = n.actor?.name ?? "Someone";
  const verb =
    n.kind === "reply_to_you" ? "replied to you in"
    : n.kind === "reply" ? "replied in"
    : n.kind === "heart" ? "♥ your post in"
    : n.kind === "topic_approved" ? "approved your topic"
    : n.kind;
  const href = n.threadId && n.threadSlug ? `${hrefs.thread(n.threadId, n.threadSlug)}${n.replyId ? `#reply-${n.replyId}` : ""}` : null;
  return (
    <>
      <span className="gf-unread-dot" aria-hidden />
      <b>{who}</b> {verb} {href ? <a href={href}>{n.threadTitle}</a> : n.threadTitle}
      <span className="gf-latest-when"> · {timeAgo(n.createdAt)}</span>
    </>
  );
}

// ── /t/[id]/[slug]/map ──────────────────────────────────────────────────────

export async function MapPage({ boxes, connectors, viewer, searchParams, path, id }: PageProps & { id: string }) {
  const { scope, hrefs, siteName } = connectors;
  if (!connectors.constellation) return null;
  const thread = await connectors.getThread(id, viewer);
  if (!thread) return null;
  const graph = await connectors.constellation(thread.id, viewer, { limit: 40 });
  if (!graph) return null;
  const network = scope.kind === "network";
  const href = hrefs.thread(thread.id, thread.slug);
  const back = backUrl(path, searchParams);
  const lineBase = viewer.userId && connectors.write?.drawLine && connectors.actionBase ? connectors.actionBase : null;
  const mine = graph.edges.filter((e) => e.kind === "line" && e.mine);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const main = (
    <>
      <Flash {...flash(searchParams)} />
      <Breadcrumb items={[
        { label: network ? "Forum" : siteName, href: hrefs.root() },
        ...(network ? [{ label: thread.org.name, href: hrefs.board(thread.org.slug) }] : []),
        { label: thread.title, href },
        { label: "Map" },
      ]} />
      <PageHead
        title={<>Map <span className="gf-map-title-of">of</span> {thread.title}</>}
        sub={graph.edges.length === 0 ? "Nothing is linked to this yet." : `${plural(graph.nodes.length, "connection")}${graph.omitted ? ` shown of ${graph.nodes.length + graph.omitted}` : ""} · every line the network has: what was gathered, what is mentioned, what shares a tag, and lines people drew`}
        aside={viewer.userId && hrefs.newDrawing?.(thread.id) ? (
          // The auto-drawn map is the skeleton; a drawing starts from it and
          // is a post of its own that cites this thread.
          <a className="eac-btn eac-btn--primary gf-newtopic-btn" href={hrefs.newDrawing(thread.id)!}>✎ Draw over this map</a>
        ) : undefined}
      />
      {graph.edges.length > 0 && (
        <figure className="gf-map-figure">
          <ConstellationSvg graph={graph} hrefs={hrefs} size={mapSize(graph)} />
          <figcaption><MapLegend graph={graph} /></figcaption>
        </figure>
      )}
      <section className="gf-sheet">
        <SectionTitle>As a list</SectionTitle>
        {graph.edges.length === 0 ? <Empty>No connections yet{lineBase ? " — draw the first line below." : "."}</Empty> : <MapEdgeList graph={graph} hrefs={hrefs} showOrg={network} />}
      </section>
      {lineBase && (
        <section className="gf-sheet">
          <SectionTitle>Draw a line from here</SectionTitle>
          <p className="gf-map-hint">A line is yours: it counts on both topics as one more person who sees them together, and shows in full on your own page. Paste the other topic&rsquo;s link.</p>
          <DrawLineForm actionBase={lineBase} threadId={thread.id} back={back} />
          {mine.length > 0 && (
            <ul className="gf-map-mine">
              {mine.map((e) => {
                const other = byId.get(e.to === thread.id ? e.from : e.to);
                if (!other) return null;
                return <li key={other.id}><a href={hrefs.thread(other.id, other.slug)}>{other.title}</a> <EraseLineForm actionBase={lineBase} threadId={thread.id} otherId={other.id} back={back} /></li>;
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
  return <Layout boxes={boxes} main={main} />;
}

// ── /t/[id]/[slug] ──────────────────────────────────────────────────────────

export async function ThreadPage({ boxes, connectors, viewer, searchParams, path, id }: PageProps & { id: string }) {
  const { scope, hrefs } = connectors;
  const thread = await connectors.getThread(id, viewer);
  if (!thread) return null;

  const page = readPage(searchParams);
  const href = hrefs.thread(thread.id, thread.slug);
  const back = backUrl(path, searchParams);

  const [replies, board] = await Promise.all([
    connectors.listReplies(thread.id, { page, limit: 20, viewer }),
    scope.kind === "network" ? connectors.getBoardBySlug(thread.org.slug, viewer)
      : (async () => (await connectors.listBoards(scope, viewer))[0] ?? null)(),
  ]);
  void connectors.recordView?.(thread.id);

  const rows = await Promise.all(
    replies.rows.map(async (r) => ({ ...r, children: r.childCount > 0 ? await connectors.listReplyChildren(r.id, viewer) : [] }))
  );

  // Who voted, when asked. "op" means the thread itself.
  const votersFor = str(searchParams.voters) ?? null;
  let voters: ForumVoters | null = null;
  if (votersFor && connectors.listVoters) {
    voters = await connectors.listVoters({ threadId: thread.id, replyId: votersFor === "op" ? null : votersFor });
  }

  // Reply-to and quote prefills, from the links on each reply.
  const all: ForumReply[] = rows.flatMap((r) => [r, ...r.children]);
  const replyToId = str(searchParams.replyTo);
  const quoteId = str(searchParams.quote);
  const replyTo = replyToId ? all.find((r) => r.id === replyToId) ?? null : null;
  const quoted = quoteId ? all.find((r) => r.id === quoteId) ?? null : null;
  const quote = quoted && connectors.write ? connectors.write.htmlToQuote(quoted.contentHtml) : "";

  // One query for every author on the page feeds the hover cards; one more
  // draws the small map in the rail.
  const [cards, constellation] = await Promise.all([
    connectors.listPeopleCards?.([thread.author.id, ...all.map((r) => r.author.id)]) ?? Promise.resolve({}),
    connectors.constellation?.(thread.id, viewer, { limit: 14 }) ?? Promise.resolve(null),
  ]);

  const view = (
    <ThreadPageView
      boxes={boxes}
      connectors={connectors}
      viewer={viewer}
      thread={thread}
      replies={{ rows, page: replies.page, totalPages: replies.totalPages, total: replies.total }}
      href={href}
      back={back}
      board={board}
      votersFor={votersFor}
      voters={voters}
      replyTo={replyTo}
      quote={quote}
      cards={cards}
      constellation={constellation}
      {...flash(searchParams)}
    />
  );

  // The viewer has now seen through the last reply on this page. After the
  // render is composed, so the "new since" rule was placed against the old mark.
  if (viewer.userId && connectors.write) {
    const last = rows.length ? rows[rows.length - 1].id : null;
    void connectors.write.markThreadRead(viewer.userId, thread.id, last);
  }
  return view;
}
