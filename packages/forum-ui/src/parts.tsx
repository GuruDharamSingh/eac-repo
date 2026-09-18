import * as React from "react";
import type {
  ForumBoard,
  ForumFeedRow,
  ForumHappeningRow,
  ForumLatestRow,
  ForumPerson,
  ForumPulse,
  ForumSort,
  ForumTopicIndexRow,
  ForumTopicRow,
  Paged,
} from "@elkdonis/services";
import { kindMeta } from "@elkdonis/cms-ui/surface";
import type { ForumHrefs } from "./connectors";
import { clock, dayHeading, dayKey, fullStamp, plural, timeAgo } from "./format";
import { mediaUrl } from "./media";

export { plural };

// ============================================================================
// The parts every page is made of. Server components: no hooks, no state.
// Class prefix gf-; colours and type come from --sf-* tokens (surface.css)
// plus the few --gf-* tokens forum.css declares.
// ============================================================================

// ── people ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ person, size = 24 }: { person: ForumPerson; size?: 24 | 32 | 64 }) {
  const style = { ["--gf-avatar" as string]: `${size}px` } as React.CSSProperties;
  const src = mediaUrl(person.avatarUrl);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="gf-avatar" src={src} alt="" width={size} height={size} style={style} loading="lazy" />
  ) : (
    <span className="gf-avatar gf-avatar--initials" style={style} aria-hidden>
      {initials(person.name)}
    </span>
  );
}

export function PersonName({ person, hrefs }: { person: ForumPerson; hrefs: ForumHrefs }) {
  const href = hrefs.member(person.slug);
  const style = person.commentColor ? { color: person.commentColor } : undefined;
  return href ? (
    <a className="gf-person" href={href} style={style}>{person.name}</a>
  ) : (
    <span className="gf-person" style={style}>{person.name}</span>
  );
}

export function RoleChip({ role }: { role: string | null }) {
  if (role !== "owner" && role !== "guide") return null;
  return <span className={`gf-role gf-role--${role}`}>{role === "owner" ? "Owner" : "Guide"}</span>;
}

export function Byline({
  person, role, at, edited, hrefs, size = 32,
}: { person: ForumPerson; role?: string | null; at: Date; edited?: Date | null; hrefs: ForumHrefs; size?: 24 | 32 }) {
  return (
    <div className="gf-byline">
      <Avatar person={person} size={size} />
      <PersonName person={person} hrefs={hrefs} />
      <RoleChip role={role ?? null} />
      <Time at={at} />
      {edited && <span className="gf-byline-edited">edited · {timeAgo(edited)}</span>}
    </div>
  );
}

export function Time({ at, className }: { at: Date | string; className?: string }) {
  const d = typeof at === "string" ? new Date(at) : at;
  return (
    <time className={className ?? "gf-time"} dateTime={d.toISOString()} title={fullStamp(d)}>
      {timeAgo(d)}
    </time>
  );
}

// ── kinds ───────────────────────────────────────────────────────────────────

export function KindGlyph({ kind }: { kind: string }) {
  const meta = kindMeta(kind);
  return (
    <span className="gf-glyph" data-kind={kind} title={meta.label} aria-hidden>
      {meta.glyph}
    </span>
  );
}

export function kindLabel(kind: string): string {
  return kindMeta(kind).label || kind;
}

// ── chrome ──────────────────────────────────────────────────────────────────

/**
 * A page's main column and its right column. `rail` is the page's own boxes
 * (thread facts, a board's latest); `boxes` is the shell's set, built once
 * per request by loadShell and handed to every page — so a page ADDS to the
 * column above them and never replaces it.
 */
export function Layout({ main, rail, boxes }: { main: React.ReactNode; rail?: React.ReactNode; boxes?: React.ReactNode }) {
  // `id="boxes"` + the close link are the phone's way in and out: under
  // 1100px the column is a :target drawer, same mechanism as the left rail.
  const side = rail || boxes ? (
    <aside className="gf-rail" id="boxes">
      <a className="gf-rail-close" href="#" aria-label="Close">×</a>
      {rail}
      {boxes}
    </aside>
  ) : null;
  return (
    <div className={`gf-layout${side ? " has-rail" : ""}`}>
      <div className="gf-main">{main}</div>
      {side}
    </div>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string | null }> }) {
  return (
    <nav className="gf-crumb" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="gf-crumb-sep" aria-hidden>›</span>}
          {it.href ? <a href={it.href}>{it.label}</a> : <span aria-current="page">{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function PageHead({ title, sub, aside, children }: { title: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="gf-pagehead">
      <div className="gf-pagehead-main">
        <h1 className="gf-pagetitle">{title}</h1>
        {sub && <p className="gf-pagesub">{sub}</p>}
        {children}
      </div>
      {aside && <div className="gf-pagehead-aside">{aside}</div>}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="gf-empty">{children}</p>;
}

/** What the last action said, carried in ?notice= / ?error=. */
export function Flash({ notice, error }: { notice?: string | null; error?: string | null }) {
  if (!notice && !error) return null;
  return <p className={`gf-flash${error ? " gf-flash--error" : ""}`} role="status">{error ?? notice}</p>;
}

/** The one-click watermark: everything read, undoable by nothing but time. */
export function ReadAllForm({ actionBase, back }: { actionBase: string; back: string }) {
  return (
    <form method="post" action={`${actionBase.replace(/\/$/, "")}/read-all`} className="gf-readall">
      <input type="hidden" name="back" value={back} />
      <button type="submit" className="gf-tool">Mark all read</button>
    </form>
  );
}

export function SectionTitle({ children, more, moreLabel = "all →" }: { children: React.ReactNode; more?: string | null; moreLabel?: string }) {
  return (
    <h2 className="gf-section-title">
      <span>{children}</span>
      {more && <a className="gf-section-more" href={more}>{moreLabel}</a>}
    </h2>
  );
}

/** Rebuild a query string with some params changed; drops page on sort change. */
export function withParams(href: string, params: Record<string, string | number | null | undefined>): string {
  const [path, qs = ""] = href.split("?");
  const sp = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

const SORTS: Array<{ value: ForumSort; label: string }> = [
  { value: "active", label: "Active" },
  { value: "newest", label: "New" },
  { value: "top", label: "Top" },
];

export function SortTabs({ current, href }: { current: ForumSort; href: string }) {
  return (
    <nav className="gf-sorts" aria-label="Sort">
      {SORTS.map((s) => (
        <a
          key={s.value}
          href={withParams(href, { sort: s.value === "active" ? null : s.value, page: null })}
          className={`gf-sort${current === s.value ? " is-current" : ""}`}
          aria-current={current === s.value ? "page" : undefined}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function Pagination({ paged, href }: { paged: Pick<Paged<unknown>, "page" | "totalPages">; href: string }) {
  if (paged.totalPages <= 1) return null;
  const pages: number[] = [];
  const around = 2;
  for (let p = 1; p <= paged.totalPages; p++) {
    if (p === 1 || p === paged.totalPages || Math.abs(p - paged.page) <= around) pages.push(p);
  }
  return (
    <nav className="gf-pages" aria-label="Pages">
      {paged.page > 1 && <a className="gf-page-link" href={withParams(href, { page: paged.page - 1 === 1 ? null : paged.page - 1 })} rel="prev">‹</a>}
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && pages[i - 1] !== p - 1 && <span className="gf-page-gap">…</span>}
          {p === paged.page ? (
            <span className="gf-page-link is-current" aria-current="page">{p}</span>
          ) : (
            <a className="gf-page-link" href={withParams(href, { page: p === 1 ? null : p })}>{p}</a>
          )}
        </React.Fragment>
      ))}
      {paged.page < paged.totalPages && <a className="gf-page-link" href={withParams(href, { page: paged.page + 1 })} rel="next">›</a>}
    </nav>
  );
}

// ── the index ───────────────────────────────────────────────────────────────

export function PulseStrip({ pulse, hrefs }: { pulse: ForumPulse; hrefs: ForumHrefs }) {
  const memberHref = pulse.newest ? hrefs.member(pulse.newest.slug) : null;
  return (
    <div className="gf-pulse">
      <span><b>{pulse.orgs}</b> {pulse.orgs === 1 ? "org" : "orgs"}</span>
      <span><b>{pulse.members}</b> members</span>
      <a href={hrefs.latest()}><b>{pulse.topics.toLocaleString("en-CA")}</b> topics</a>
      <a href={hrefs.latest()}><b>{pulse.posts.toLocaleString("en-CA")}</b> posts</a>
      <a href={hrefs.happening()}><b>{pulse.happeningThisWeek}</b> {pulse.happeningThisWeek === 1 ? "gathering" : "gatherings"} this week</a>
      {pulse.newest && (
        <span className="gf-pulse-newest">
          newest: {memberHref ? <a href={memberHref}>{pulse.newest.name}</a> : pulse.newest.name}
        </span>
      )}
    </div>
  );
}

export function OrgMasthead({ board, hrefs, as = "row" }: { board: ForumBoard; hrefs: ForumHrefs; as?: "row" | "header" | "card" }) {
  const site = hrefs.orgSite(board);
  const id = board.identity;
  const Tag = as === "header" ? "header" : "div";
  return (
    <Tag className={`gf-org gf-org--${as}`}>
      {id?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="gf-org-portrait" src={mediaUrl(id.avatarUrl)!} alt="" loading="lazy" />
      ) : (
        <span className="gf-org-portrait gf-org-portrait--empty" aria-hidden>{initials(board.name)}</span>
      )}
      <div className="gf-org-text">
        <div className="gf-org-line">
          {as === "header" ? (
            <h1 className="gf-org-name">{board.name}</h1>
          ) : (
            <a className="gf-org-name" href={hrefs.board(board.slug)}>{board.name}</a>
          )}
          {id?.city && <span className="gf-org-meta">{id.city}</span>}
          <span className={`gf-tier gf-tier--${board.tier}`}>{board.tier}</span>
          {site && <a className="gf-org-site" href={site} target="_blank" rel="noreferrer">site ↗</a>}
        </div>
        {id?.headline && <p className="gf-org-headline">{id.headline}</p>}
      </div>
    </Tag>
  );
}

function FeedRowLast({ feed, hrefs, orgSlug }: { feed: ForumFeedRow; hrefs: ForumHrefs; orgSlug: string }) {
  const lt = feed.lastThread;
  if (!lt) return <span className="gf-last gf-last--none">—</span>;
  return (
    <span className="gf-last">
      <a className="gf-last-title" href={hrefs.thread(lt.id, lt.slug)}>
        <KindGlyph kind={lt.kind} /> {lt.title}
      </a>
      <span className="gf-last-by">
        {lt.by ? <PersonName person={lt.by} hrefs={hrefs} /> : null}
        {lt.by ? " · " : ""}
        <Time at={lt.lastActivityAt} />
      </span>
    </span>
  );
}

/** One org's feeds as the classic category table. */
export function BoardTable({ board, hrefs, caption }: { board: ForumBoard; hrefs: ForumHrefs; caption?: React.ReactNode }) {
  return (
    <table className="gf-board">
      {caption && <caption className="gf-board-caption">{caption}</caption>}
      <thead className="gf-board-head">
        <tr>
          <th scope="col">Forum</th>
          <th scope="col" className="gf-num">Topics</th>
          <th scope="col" className="gf-num">Posts</th>
          <th scope="col">Last post</th>
        </tr>
      </thead>
      <tbody>
        {board.feeds.map((f) => (
          <tr key={f.slug} className="gf-feedrow" style={f.accent ? ({ ["--gf-feed" as string]: f.accent } as React.CSSProperties) : undefined}>
            <td className="gf-feedcell">
              <a className={`gf-feedname${f.unreadCount ? " is-unread" : ""}`} href={hrefs.feed(board.slug, f.slug)}>
                {f.unreadCount ? <span className="gf-unread-dot" title={plural(f.unreadCount, "unread topic")} /> : null}
                {f.name}
              </a>
              {f.unreadCount ? <span className="gf-chip gf-chip--unread">{f.unreadCount} unread</span> : null}
              {f.presenter && <span className="gf-feedpresenter">Presented by {f.presenter}</span>}
              {!f.presenter && f.tagline && <span className="gf-feedpresenter">{f.tagline}</span>}
            </td>
            <td className="gf-num" data-label={f.topicCount === 1 ? "topic" : "topics"}>{f.topicCount.toLocaleString("en-CA")}</td>
            <td className="gf-num" data-label={f.postCount === 1 ? "post" : "posts"}>{f.postCount.toLocaleString("en-CA")}</td>
            <td className="gf-lastcell"><FeedRowLast feed={f} hrefs={hrefs} orgSlug={board.slug} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── topic rows ──────────────────────────────────────────────────────────────

export function TopicRow({ row, hrefs, showOrg, showFeed = true }: { row: ForumTopicRow; hrefs: ForumHrefs; showOrg: boolean; showFeed?: boolean }) {
  const href = hrefs.thread(row.id, row.slug);
  const kicker: React.ReactNode[] = [kindLabel(row.kind)];
  if (showOrg) kicker.push(<a key="org" href={hrefs.board(row.org.slug)}>{row.org.name}</a>);
  if (showFeed && row.feed.name) kicker.push(<a key="feed" href={hrefs.feed(row.org.slug, row.feed.slug)}>{row.feed.name}</a>);
  kicker.push(<PersonName key="by" person={row.author} hrefs={hrefs} />);

  const titleHref = row.unread && row.replyCount > 0 ? `${href}/unread` : href;
  return (
    <li className={`gf-topic${row.pinned ? " is-pinned" : ""}${row.locked ? " is-locked" : ""}${row.unread ? " is-unread" : ""}`} data-kind={row.kind}>
      <KindGlyph kind={row.kind} />
      <div className="gf-topic-main">
        <div className="gf-topic-titleline">
          {row.unread && <span className="gf-unread-dot" title="Unread" />}
          {row.pinned && <span className="gf-mark" title="Pinned">📌</span>}
          {row.locked && <span className="gf-mark" title="Locked">🔒</span>}
          <a className="gf-topic-title" href={titleHref}>{row.title}</a>
          {row.visibility === "ORGANIZATION" && <span className="gf-chip gf-chip--members">members</span>}
        </div>
        {row.excerpt && <p className="gf-topic-excerpt">{row.excerpt}</p>}
        <p className="gf-topic-kicker">
          {kicker.map((k, i) => (
            <React.Fragment key={i}>{i > 0 && <span className="gf-dot">·</span>}{k}</React.Fragment>
          ))}
          {row.topics.map((t) => {
            const th = hrefs.topic(t.slug);
            return th ? <a key={t.id} className="gf-chip" href={th}>{t.name}</a> : <span key={t.id} className="gf-chip">{t.name}</span>;
          })}
        </p>
      </div>
      <div className="gf-topic-stats">
        <span className="gf-stat" title={plural(row.replyCount, "reply", "replies")}><b>{row.replyCount}</b> <small>replies</small></span>
        <span className="gf-stat" title={plural(row.viewCount, "view")}><b>{row.viewCount}</b> <small>views</small></span>
        <span className="gf-stat gf-stat--score" title="Score">▲ {row.score}</span>
        <span className="gf-stat gf-stat--when">
          <a href={`${href}${row.replyCount > 0 ? `?page=${Math.max(1, Math.ceil(row.replyCount / 20))}` : ""}`} title="Last post"><Time at={row.lastActivityAt} /></a>
        </span>
        {row.lastPoster && <span className="gf-topic-lastposter" title={`Last post by ${row.lastPoster.name}`}><Avatar person={row.lastPoster} size={24} /></span>}
      </div>
    </li>
  );
}

export function TopicList({ paged, hrefs, showOrg, empty }: { paged: Paged<ForumTopicRow>; hrefs: ForumHrefs; showOrg: boolean; empty: React.ReactNode }) {
  if (paged.rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ol className="gf-topics">
      {paged.rows.map((r) => <TopicRow key={r.id} row={r} hrefs={hrefs} showOrg={showOrg} />)}
    </ol>
  );
}

// ── the rail ────────────────────────────────────────────────────────────────

export function HappeningBlock({ rows, hrefs, showOrg, more }: { rows: ForumHappeningRow[]; hrefs: ForumHrefs; showOrg: boolean; more?: string | null }) {
  return (
    <section className="gf-rail-block">
      <SectionTitle more={more}>Happening</SectionTitle>
      {rows.length === 0 ? (
        <p className="gf-rail-empty">Nothing scheduled — start one on your org's site.</p>
      ) : (
        <ol className="gf-happening">
          {rows.map((h) => (
            <li key={h.id} className="gf-happening-row" data-kind={h.kind}>
              <span className="gf-happening-when">{h.scheduledAt.toLocaleDateString("en-CA", { weekday: "short" })} {clock(h.scheduledAt)}</span>
              <a className="gf-happening-title" href={hrefs.thread(h.id, h.slug)}><KindGlyph kind={h.kind} /> {h.title}</a>
              <span className="gf-happening-org">{showOrg ? h.org.name : h.feed.name ?? ""}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LatestBlock({ rows, hrefs, more }: { rows: ForumLatestRow[]; hrefs: ForumHrefs; more?: string | null }) {
  return (
    <section className="gf-rail-block">
      <SectionTitle more={more}>Latest posts</SectionTitle>
      {rows.length === 0 ? (
        <p className="gf-rail-empty">Quiet so far.</p>
      ) : (
        <ol className="gf-latest">
          {rows.map((l) => (
            <li key={`${l.kind}-${l.id}`} className="gf-latest-row">
              <PersonName person={l.by} hrefs={hrefs} />{" "}
              <span className="gf-latest-verb">{l.kind === "reply" ? "in" : "started"}</span>{" "}
              <a href={`${hrefs.thread(l.threadId, l.threadSlug)}${l.kind === "reply" ? `#reply-${l.id}` : ""}`}>{l.threadTitle}</a>
              <span className="gf-latest-when"> · <Time at={l.at} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TopicsBlock({ rows, hrefs }: { rows: ForumTopicIndexRow[]; hrefs: ForumHrefs }) {
  const shown = rows.filter((r) => r.count > 0);
  return (
    <section className="gf-rail-block">
      <SectionTitle>Topics</SectionTitle>
      {shown.length === 0 ? (
        <p className="gf-rail-empty">No topics tagged yet.</p>
      ) : (
        <p className="gf-topicscloud">
          {shown.map((t) => {
            const h = hrefs.topic(t.slug);
            const inner = <>{t.name} <small>{t.count}</small></>;
            return h ? <a key={t.id} className="gf-chip" href={h}>{inner}</a> : <span key={t.id} className="gf-chip">{inner}</span>;
          })}
        </p>
      )}
    </section>
  );
}

// ── agenda (the /happening page) ────────────────────────────────────────────

export function Agenda({ rows, hrefs, showOrg }: { rows: ForumHappeningRow[]; hrefs: ForumHrefs; showOrg: boolean }) {
  if (rows.length === 0) return <Empty>Nothing scheduled — start one on your org's site.</Empty>;
  const days = new Map<string, ForumHappeningRow[]>();
  for (const r of rows) {
    const k = dayKey(r.scheduledAt);
    (days.get(k) ?? days.set(k, []).get(k)!).push(r);
  }
  return (
    <div className="gf-agenda">
      {[...days.entries()].map(([k, list]) => (
        <section key={k} className="gf-agenda-day">
          <h2 className="gf-agenda-heading">{dayHeading(list[0].scheduledAt)}</h2>
          <ol className="gf-agenda-list">
            {list.map((h) => (
              <li key={h.id} className="gf-agenda-row" data-kind={h.kind}>
                <span className="gf-agenda-time">{clock(h.scheduledAt)}</span>
                <a className="gf-agenda-title" href={hrefs.thread(h.id, h.slug)}><KindGlyph kind={h.kind} /> {h.title}</a>
                <span className="gf-agenda-kicker">
                  {showOrg && <a href={hrefs.board(h.org.slug)}>{h.org.name}</a>}
                  {showOrg && h.feed.name && " · "}
                  {h.feed.name && <a href={hrefs.feed(h.org.slug, h.feed.slug)}>{h.feed.name}</a>}
                  {h.location && <> · {h.isOnline ? "online" : h.location}</>}
                </span>
                <span className="gf-agenda-going">
                  {h.rsvpCount > 0 || h.attendeeLimit ? `${h.rsvpCount}${h.attendeeLimit ? ` of ${h.attendeeLimit}` : ""} going` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

// ── theme toggle + new-topic link ─────────────────────────────────────────

export function ModeToggle({ currentMode, actionBase, back }: { currentMode: "light" | "dark" | "auto"; actionBase: string; back: string }) {
  // Two-state toggle, because a three-way including "auto" makes the control
  // say something the reader has to decode. "auto" resolves to whichever it
  // is currently showing, and flipping it commits to the opposite.
  const next = currentMode === "dark" ? "light" : "dark";
  const base = actionBase.replace(/\/$/, "");
  return (
    <form method="post" action={`${base}/set-theme`} className="gf-mode-toggle">
      <input type="hidden" name="mode" value={next} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" className="gf-tool" title={`Switch to ${next} background`}>
        {currentMode === "dark" ? "☀ Light" : "◑ Dark"}
      </button>
    </form>
  );
}

export function NewTopicLink({ href, label }: { href: string; label?: string }) {
  return (
    <a className="eac-btn eac-btn--primary gf-newtopic-btn" href={href}>
      {label ?? "+ New Topic"}
    </a>
  );
}
