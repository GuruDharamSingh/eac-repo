import * as React from "react";
import type { ForumModLogEntry, ForumSearchHit, Paged } from "@elkdonis/services";
import type { ForumHrefs } from "./connectors";
import { Avatar, Empty, PageHead, Pagination, PersonName, Time, plural, withParams } from "./parts";

// ============================================================================
// Search and the moderation log. Both are lists over the same row parts;
// the only new thing is the highlighted snippet, which arrives as HTML from
// ts_headline containing <mark> and nothing else.
// ============================================================================

export function SearchBox({ href, q, compact }: { href: string; q?: string; compact?: boolean }) {
  return (
    <form method="get" action={href} className={`gf-search${compact ? " gf-search--compact" : ""}`} role="search">
      <input name="q" className="gf-input gf-input--sm" defaultValue={q ?? ""} placeholder="⌕ Search" aria-label="Search the forum" />
    </form>
  );
}

/**
 * ts_headline's output is the only HTML the forum injects that it did not
 * sanitize itself — Postgres emits the fragment with our own StartSel and
 * StopSel around matches and escapes nothing else, so the source text's
 * own angle brackets arrive as text. Bodies were de-tagged before indexing
 * and before headlining, so no author markup can reach here.
 */
function Snippet({ html }: { html: string }) {
  return <span className="gf-hit-snippet" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SearchResults({ paged, q, hrefs, href, showOrg, only }: {
  paged: Paged<ForumSearchHit>; q: string; hrefs: ForumHrefs; href: string; showOrg: boolean; only: "all" | "thread" | "reply";
}) {
  const tabs = (
    <nav className="gf-sorts" aria-label="Kind">
      {([["all", "Everything"], ["thread", "Topics"], ["reply", "Replies"]] as const).map(([k, label]) => (
        <a key={k} href={withParams(href, { q, only: k === "all" ? null : k, page: null })} className={`gf-sort${only === k ? " is-current" : ""}`} aria-current={only === k ? "page" : undefined}>{label}</a>
      ))}
    </nav>
  );
  return (
    <>
      <PageHead title={q ? <>Search: <em className="gf-search-term">{q}</em></> : "Search"} sub={q ? plural(paged.total, "result") : undefined} aside={<span className="gf-pagehead-tools">{tabs}<SearchBox href={href} q={q} /></span>} />
      {!q ? (
        <Empty>Type something above. Quotes make a phrase; a leading minus excludes.</Empty>
      ) : paged.rows.length === 0 ? (
        <Empty>Nothing matches “{q}”.</Empty>
      ) : (
        <ol className="gf-hits">
          {paged.rows.map((h) => (
            <li key={`${h.kind}-${h.id}`} className="gf-hit">
              <span className="gf-hit-kind">{h.kind === "thread" ? "topic" : "reply"}</span>
              <span className="gf-hit-main">
                <a className="gf-hit-title" href={`${hrefs.thread(h.threadId, h.threadSlug)}${h.kind === "reply" ? `#reply-${h.id}` : ""}`} dangerouslySetInnerHTML={{ __html: h.titleHtml }} />
                <Snippet html={h.snippet} />
                <span className="gf-hit-kicker">
                  <Avatar person={h.author} size={24} />
                  <PersonName person={h.author} hrefs={hrefs} />
                  {h.feed.name && <> · <a href={hrefs.feed(h.org.slug, h.feed.slug)}>{h.feed.name}</a></>}
                  {showOrg && <> · <a href={hrefs.board(h.org.slug)}>{h.org.name}</a></>}
                  {" · "}<Time at={h.at} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <Pagination paged={paged} href={withParams(href, { q, only: only === "all" ? null : only })} />
    </>
  );
}

// ── moderation log ──────────────────────────────────────────────────────────

const MOD_LABEL: Record<string, string> = {
  content_pinned: "pinned", content_unpinned: "unpinned",
  content_locked: "locked", content_unlocked: "unlocked",
  content_hidden: "archived", content_unhidden: "restored",
  post_updated: "moved",
};

export function ModLog({ paged, hrefs, href, orgName }: { paged: Paged<ForumModLogEntry>; hrefs: ForumHrefs; href: string; orgName: string }) {
  return (
    <>
      <PageHead title="Moderation log" sub={`${orgName} · ${plural(paged.total, "action")}`} />
      {paged.rows.length === 0 ? <Empty>Nothing has been moderated here.</Empty> : (
        <ol className="gf-modlog">
          {paged.rows.map((e) => (
            <li key={e.id} className="gf-modlog-row">
              <span className="gf-modlog-action">{MOD_LABEL[e.action] ?? e.action}</span>
              <span className="gf-modlog-main">
                {e.thread ? <a href={hrefs.thread(e.thread.id, e.thread.slug)}>{e.thread.title}</a> : <em>a deleted topic</em>}
                {typeof e.data.to === "string" && <span className="gf-modlog-detail"> → {e.data.to}</span>}
                <span className="gf-modlog-by">{e.actor ? <>by <PersonName person={e.actor} hrefs={hrefs} /></> : "by someone"}</span>
              </span>
              <Time at={e.at} className="gf-modlog-when" />
            </li>
          ))}
        </ol>
      )}
      <Pagination paged={paged} href={href} />
    </>
  );
}
