import * as React from "react";
import type { ForumActivityItem, ForumMember, ForumOrgCard, ForumPerson, ForumPersonCard, ForumTopicEntry, ForumViewer, Paged } from "@elkdonis/services";
import { ProfileView } from "@elkdonis/cms-ui/profile";
import type { ForumConnectors, ForumHrefs } from "./connectors";
import { Avatar, Breadcrumb, Empty, Flash, KindGlyph, PageHead, Pagination, PersonName, RoleChip, SectionTitle, Time, TopicList, plural, withParams } from "./parts";
import { timeAgo } from "./format";
import { mediaUrl } from "./media";

// ============================================================================
// People and the taxonomy: hover cards, the member page, the directories,
// the topics index and the admin review page. Identity is ArtDirect's
// ProfileView, unchanged; the forum adds what a board knows about a person.
// ============================================================================

// ── hover card ──────────────────────────────────────────────────────────────

/**
 * A byline name that reveals a card on hover or keyboard focus — CSS only.
 * The card's data arrives with the page (one query for every author on it).
 */
export function PersonWithCard({ person, card, hrefs, role }: { person: ForumPerson; card?: ForumPersonCard; hrefs: ForumHrefs; role?: string | null }) {
  const href = hrefs.member(person.slug);
  const style = person.commentColor ? { color: person.commentColor } : undefined;
  return (
    <span className="gf-person-wrap">
      {href ? <a className="gf-person" href={href} style={style}>{person.name}</a> : <span className="gf-person" style={style} tabIndex={0}>{person.name}</span>}
      <RoleChip role={role ?? null} />
      {card && (
        <span className="gf-hovercard" role="tooltip">
          <span className="gf-hovercard-head">
            <Avatar person={card} size={64} />
            <span>
              <b className="gf-hovercard-name">{card.name}</b>
              {(card.pronouns || card.city) && <span className="gf-hovercard-meta">{[card.pronouns, card.city].filter(Boolean).join(" · ")}</span>}
              {card.headline && <span className="gf-hovercard-headline">{card.headline}</span>}
            </span>
          </span>
          {card.roles.length > 0 && (
            <span className="gf-hovercard-roles">
              {card.roles.map((r) => <span key={r.orgId}><em>{r.role}</em> · {r.orgName}</span>)}
            </span>
          )}
          <span className="gf-hovercard-facts">Joined {card.joinedAt.toLocaleDateString("en-CA", { month: "short", year: "numeric" })} · {plural(card.topicCount, "topic")} · {plural(card.replyCount, "reply", "replies")}</span>
          <span className="gf-hovercard-links">
            {href && <a href={href}>Forum profile</a>}
            {hrefs.profile?.(card.slug) && <a href={hrefs.profile(card.slug)!} target="_blank" rel="noreferrer">ArtDirect ↗</a>}
          </span>
        </span>
      )}
    </span>
  );
}

// ── member page ─────────────────────────────────────────────────────────────

export function ActivityList({ rows, hrefs, showOrg }: { rows: ForumActivityItem[]; hrefs: ForumHrefs; showOrg: boolean }) {
  if (rows.length === 0) return <Empty>Nothing yet.</Empty>;
  return (
    <ol className="gf-activity">
      {rows.map((a) => (
        <li key={`${a.kind}-${a.id}`} className="gf-activity-row">
          <span className="gf-activity-verb">{a.kind === "topic" ? "started" : "replied in"}</span>
          <span className="gf-activity-main">
            <a className="gf-activity-title" href={`${hrefs.thread(a.threadId, a.threadSlug)}${a.kind === "reply" ? `#reply-${a.id}` : ""}`}>{a.threadTitle}</a>
            <span className="gf-activity-kicker">
              {a.feed.name && <a href={hrefs.feed(a.org.slug, a.feed.slug)}>{a.feed.name}</a>}
              {showOrg && <> · <a href={hrefs.board(a.org.slug)}>{a.org.name}</a></>}
            </span>
            {a.excerpt && <span className="gf-activity-excerpt">{a.excerpt}</span>}
          </span>
          <Time at={a.at} className="gf-activity-when" />
        </li>
      ))}
    </ol>
  );
}

export function MemberPageView({ connectors, member, activity, tab, href, profileUrl }: {
  connectors: ForumConnectors; member: ForumMember; activity: Paged<ForumActivityItem>; tab: "activity" | "topics" | "replies"; href: string; profileUrl: string | null;
}) {
  const { hrefs, scope, siteName } = connectors;
  const network = scope.kind === "network";
  const p = member.profile;
  const tabs = (
    <nav className="gf-sorts" aria-label="Activity">
      {([["activity", "Activity"], ["topics", `Topics started ${member.topicCount}`], ["replies", `Replies ${member.replyCount}`]] as const).map(([k, label]) => (
        <a key={k} href={k === "activity" ? href : `${href}?tab=${k}`} className={`gf-sort${tab === k ? " is-current" : ""}`} aria-current={tab === k ? "page" : undefined}>{label}</a>
      ))}
    </nav>
  );
  return (
    <div className="gf-member">
      <Breadcrumb items={[{ label: network ? "Boards" : siteName, href: hrefs.root() }, { label: "Members", href: `${hrefs.root().replace(/\/$/, "")}/members` }, { label: member.name }]} />
      <ProfileView
        person={{
          displayName: p.displayName, headline: p.headline, bio: p.bio, avatarUrl: mediaUrl(p.avatarUrl), pronouns: p.pronouns,
          city: p.city, verified: p.verified, portfolioUrl: p.portfolioUrl, socialLinks: p.socialLinks,
        }}
      >
        <div className="gf-member-facts">
          {member.roles.map((r) => <span key={r.orgId} className="gf-member-role"><RoleChip role={r.role} />{r.role !== "owner" && r.role !== "guide" && <em>{r.role}</em>} · <a href={hrefs.board(r.orgSlug)}>{r.orgName}</a></span>)}
          <span className="gf-member-joined">Joined {member.joinedAt.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</span>
          {profileUrl && <a className="gf-member-artdirect" href={profileUrl} target="_blank" rel="noreferrer">Full profile on ArtDirect ↗</a>}
        </div>
      </ProfileView>
      <PageHead title={tab === "activity" ? "Activity" : tab === "topics" ? "Topics started" : "Replies"} sub={plural(activity.total, tab === "replies" ? "reply" : tab === "topics" ? "topic" : "item", tab === "replies" ? "replies" : undefined)} aside={tabs} />
      <ActivityList rows={activity.rows} hrefs={hrefs} showOrg={network} />
      <Pagination paged={activity} href={tab === "activity" ? href : `${href}?tab=${tab}`} />
    </div>
  );
}

// ── directories ─────────────────────────────────────────────────────────────

export function MembersDirectory({ paged, hrefs, sort, q, href }: { paged: Paged<ForumPersonCard>; hrefs: ForumHrefs; sort: string; q: string; href: string }) {
  const tabs = (
    <span className="gf-pagehead-tools">
      <nav className="gf-sorts" aria-label="Sort">
        {([["active", "Most active"], ["newest", "Newest"], ["name", "A–Z"]] as const).map(([k, label]) => (
          <a key={k} href={withParams(href, { sort: k === "active" ? null : k, q: q || null, page: null })} className={`gf-sort${sort === k ? " is-current" : ""}`}>{label}</a>
        ))}
      </nav>
      <form method="get" action={href} className="gf-search">
        {sort !== "active" && <input type="hidden" name="sort" value={sort} />}
        <input name="q" className="gf-input gf-input--sm" defaultValue={q} placeholder="⌕ name" aria-label="Search members" />
      </form>
    </span>
  );
  return (
    <>
      <PageHead title="Members" sub={plural(paged.total, "member")} aside={tabs} />
      {paged.rows.length === 0 ? <Empty>No one matches.</Empty> : (
        <ol className="gf-members">
          {paged.rows.map((m) => (
            <li key={m.id} className="gf-member-row">
              <Avatar person={m} size={32} />
              <span className="gf-member-main">
                <PersonName person={m} hrefs={hrefs} />
                {m.headline && <span className="gf-member-headline">{m.headline}</span>}
                <span className="gf-member-roles">{m.roles.map((r) => <span key={r.orgId}><em>{r.role}</em> · {r.orgName}</span>)}</span>
              </span>
              <span className="gf-member-stats">
                {m.joinedAt > new Date(Date.now() - 14 * 864e5) ? <span className="gf-chip">joined {timeAgo(m.joinedAt)}</span> : null}
                <span>{plural(m.topicCount + m.replyCount, "post")}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <Pagination paged={paged} href={withParams(href, { sort: sort === "active" ? null : sort, q: q || null })} />
    </>
  );
}

export function OrgsDirectory({ cards, hrefs, tier }: { cards: ForumOrgCard[]; hrefs: ForumHrefs; tier: string | null }) {
  const shown = tier ? cards.filter((c) => c.tier === tier) : cards;
  const href = `${hrefs.root().replace(/\/$/, "")}/orgs`;
  const tabs = (
    <nav className="gf-sorts" aria-label="Tier">
      {([[null, "All"], ["partner", "Partner"], ["supported", "Supported"], ["free", "Free"]] as const).map(([k, label]) => (
        <a key={label} href={k ? `${href}?tier=${k}` : href} className={`gf-sort${tier === k ? " is-current" : ""}`}>{label}</a>
      ))}
    </nav>
  );
  return (
    <>
      <PageHead title="Orgs" sub={plural(shown.length, "org")} aside={tabs} />
      {shown.length === 0 ? <Empty>No orgs here.</Empty> : (
        <ul className="gf-orgcards">
          {shown.map((c) => {
            const site = hrefs.orgSite(c);
            return (
              <li key={c.orgId} className="gf-orgcard">
                <div className="gf-orgcard-head">
                  {c.identity?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="gf-org-portrait" src={mediaUrl(c.identity.avatarUrl)!} alt="" loading="lazy" />
                  ) : <span className="gf-org-portrait gf-org-portrait--empty" aria-hidden>{c.name.slice(0, 1)}</span>}
                  <div>
                    <a className="gf-org-name" href={hrefs.board(c.slug)}>{c.name}</a>
                    <div className="gf-org-meta">{[c.identity?.city, c.tier].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                {c.identity?.headline && <p className="gf-orgcard-headline">{c.identity.headline}</p>}
                <p className="gf-orgcard-stats">{plural(c.feedCount, "forum")} · {plural(c.topicCount, "topic")} · {plural(c.memberCount, "member")}</p>
                {c.lastThread && <p className="gf-orgcard-last">last: <a href={hrefs.thread(c.lastThread.id, c.lastThread.slug)}><KindGlyph kind={c.lastThread.kind} /> {c.lastThread.title}</a> · <Time at={c.lastThread.lastActivityAt} /></p>}
                <p className="gf-orgcard-links"><a href={hrefs.board(c.slug)}>board →</a>{site && <> · <a href={site} target="_blank" rel="noreferrer">site ↗</a></>}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ── rail blocks ─────────────────────────────────────────────────────────────

export function WhoIsHereBlock({ count, people, hrefs }: { count: number; people: ForumPerson[]; hrefs: ForumHrefs }) {
  return (
    <section className="gf-rail-block">
      <SectionTitle>Who's here · {count}</SectionTitle>
      {people.length === 0 ? <p className="gf-rail-empty">Just you, or nobody signed in lately.</p> : (
        <p className="gf-present">
          {people.map((p) => <span key={p.id} className="gf-present-one"><span className="gf-present-dot" style={p.commentColor ? { background: p.commentColor } : undefined} /><PersonName person={p} hrefs={hrefs} /></span>)}
          {count > people.length && <span className="gf-present-more">+{count - people.length}</span>}
        </p>
      )}
    </section>
  );
}

export function NewMembersBlock({ people, hrefs, more }: { people: Array<ForumPerson & { joinedAt: Date }>; hrefs: ForumHrefs; more: string }) {
  return (
    <section className="gf-rail-block">
      <SectionTitle more={more}>New members</SectionTitle>
      {people.length === 0 ? <p className="gf-rail-empty">No one yet.</p> : (
        <ol className="gf-latest">
          {people.map((p) => <li key={p.id} className="gf-latest-row"><PersonName person={p} hrefs={hrefs} /><span className="gf-latest-when"> · {timeAgo(p.joinedAt)}</span></li>)}
        </ol>
      )}
    </section>
  );
}

// ── topics ──────────────────────────────────────────────────────────────────

export function TopicsIndex({ entries, hrefs, viewer, connectors }: { entries: ForumTopicEntry[]; hrefs: ForumHrefs; viewer: ForumViewer; connectors: ForumConnectors }) {
  const approved = entries.filter((e) => e.status === "approved");
  const proposed = entries.filter((e) => e.status === "proposed");
  const review = viewer.isGlobalAdmin ? `${hrefs.root().replace(/\/$/, "")}/topics/review` : null;
  return (
    <>
      <PageHead title="Topics" sub={plural(approved.length, "topic")} aside={review ? <a className="gf-tool" href={review}>Review proposals{proposed.length ? ` · ${proposed.length}` : ""}</a> : undefined} />
      {approved.length === 0 ? <Empty>No topics yet — org owners and guides can propose one from any forum's new-topic form.</Empty> : (
        <ul className="gf-topicgrid">
          {approved.map((e) => (
            <li key={e.id} className="gf-topicentry">
              <a className="gf-topicentry-name" href={hrefs.topic(e.slug) ?? "#"}>{e.name}</a>
              <span className="gf-topicentry-count">{plural(e.count, "topic")}</span>
              {e.description && <span className="gf-topicentry-desc">{e.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {proposed.length > 0 && !viewer.isGlobalAdmin && (
        <>
          <SectionTitle>Proposed by your orgs · awaiting review</SectionTitle>
          <p className="gf-topicscloud">{proposed.map((e) => <span key={e.id} className="gf-chip">{e.name}</span>)}</p>
        </>
      )}
    </>
  );
}

export function TopicReviewPage({ entries, hrefs, actionBase, back }: { entries: ForumTopicEntry[]; hrefs: ForumHrefs; actionBase: string; back: string }) {
  const pending = entries.filter((e) => e.status === "proposed");
  const base = actionBase.replace(/\/$/, "");
  return (
    <>
      <PageHead title="Review proposed topics" sub={plural(pending.length, "proposal")} />
      {pending.length === 0 ? <Empty>Nothing waiting.</Empty> : (
        <ol className="gf-review">
          {pending.map((e) => (
            <li key={e.id} className="gf-review-row">
              <span className="gf-review-main">
                <b>{e.name}</b> <span className="gf-chip">{e.slug}</span>
                <span className="gf-review-meta">proposed {timeAgo(e.createdAt)}{e.proposedBy && <> by <PersonName person={e.proposedBy} hrefs={hrefs} /></>}{e.orgId && <> · {e.orgId}</>} · used on {plural(e.count, "thread")}</span>
              </span>
              <span className="gf-review-actions">
                {(["approved", "rejected"] as const).map((d) => (
                  <form key={d} method="post" action={`${base}/review-topic`}>
                    <input type="hidden" name="topic" value={e.id} /><input type="hidden" name="decision" value={d} /><input type="hidden" name="back" value={back} />
                    <button type="submit" className={`gf-tool${d === "approved" ? " is-on" : ""}`}>{d === "approved" ? "Approve" : "Reject"}</button>
                  </form>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export { TopicList };
