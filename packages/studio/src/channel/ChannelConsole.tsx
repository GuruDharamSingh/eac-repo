import type { ReactNode } from "react";
import { buildChannelNav, channelHref, recentFailures, type ChannelIcon, type ChannelNavGroup } from "./nav";
import type { ChannelAccount, ChannelArtwork, ChannelData, ChannelJob, ChannelPost, ChannelPostArtworkAction, ChannelViewId } from "./types";

// ============================================================================
// The Channel console shell and its five views. A server component with no
// client state: folds and the org picker are <details>, filters are links,
// "Post this" is a form posting to the host's server action. Markup and
// classes: docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md §4.
// ============================================================================

const ICON_PATHS: Record<ChannelIcon | "chevron" | "out" | "back" | "menu", ReactNode> = {
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  post: <path d="M2.5 3h11v7.5h-6L4.5 13v-2.5h-2z" />,
  artwork: <path d="M5.5 2h5M6.2 2c0 2.2-2.7 3.2-2.7 6.8 0 2.7 2 4.7 4.5 4.7s4.5-2 4.5-4.7C12.5 5.2 9.8 4.2 9.8 2" />,
  writing: (
    <>
      <path d="M3 13l.9-3.4 7-7 2.5 2.5-7 7z" />
      <path d="M9.4 4.1l2.5 2.5" />
    </>
  ),
  video: (
    <>
      <rect x="1.5" y="3.5" width="9" height="9" rx="1.5" />
      <path d="M10.5 7l4-2.5v7l-4-2.5" />
    </>
  ),
  recording: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </>
  ),
  meeting: (
    <>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </>
  ),
  series: (
    <>
      <rect x="2" y="2" width="12" height="3" rx="1" />
      <rect x="2" y="6.5" width="12" height="3" rx="1" />
      <rect x="2" y="11" width="12" height="3" rx="1" />
    </>
  ),
  newsletter: (
    <>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="M2 4l6 5 6-5" />
    </>
  ),
  comments: (
    <>
      <path d="M2 2.5h8v6H5.5L3 10.5v-2H2z" />
      <path d="M12 5.5h2v6h-1v2l-2.5-2H7V10" />
    </>
  ),
  live: <path d="M1 8h3l2-5 4 10 2-5h3" />,
  accounts: (
    <>
      <path d="M6.5 9.5l3-3" />
      <path d="M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" />
    </>
  ),
  activity: <path d="M6 4h8M6 8h8M6 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5" />,
  pages: (
    <>
      <path d="M4 1.5h5.5l3 3v10H4z" />
      <path d="M9.5 1.5v3h3" />
    </>
  ),
  style: <path d="M8 1.5c2.5 3.5 4.5 5.7 4.5 8.2a4.5 4.5 0 0 1-9 0C3.5 7.2 5.5 5 8 1.5z" />,
  details: (
    <>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <circle cx="5.5" cy="7" r="1.5" />
      <path d="M3.5 11c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5M9.5 6.5h3M9.5 9h3" />
    </>
  ),
  people: (
    <>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4" />
      <path d="M10.5 3a2.5 2.5 0 0 1 0 5M12 9.7c1.3.6 2.2 1.9 2.5 3.8" />
    </>
  ),
  center: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  store: (
    <>
      <path d="M3 5h10l-.8 9H3.8z" />
      <path d="M5.5 5V4a2.5 2.5 0 0 1 5 0v1" />
    </>
  ),
  directory: <path d="M8 3.5C6.3 2.2 4.5 2.2 2.5 3v10c2-.8 3.8-.8 5.5.5 1.7-1.3 3.5-1.3 5.5-.5V3c-2-.8-3.8-.8-5.5.5zM8 3.5v10" />,
  chevron: <path d="M4 6l4 4 4-4" />,
  out: <path d="M6 3.5h6.5V10M12.5 3.5L4 12" />,
  back: <path d="M10 3L5 8l5 5" />,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
};

type IconName = keyof typeof ICON_PATHS;

function Sprite() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      {(Object.keys(ICON_PATHS) as IconName[]).map((id) => (
        <symbol key={id} id={`ch-i-${id}`} viewBox="0 0 16 16">
          {ICON_PATHS[id]}
        </symbol>
      ))}
    </svg>
  );
}

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={`ch-icon ${className}`.trim()} aria-hidden="true">
      <use href={`#ch-i-${name}`} />
    </svg>
  );
}

const PROVIDER: Record<string, string> = { meta: "Facebook", page: "Facebook", instagram: "Instagram", threads: "Threads", youtube: "YouTube" };
const providerName = (p: string) => PROVIDER[p] ?? p;

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const STATUS_LABEL: Record<string, string> = { available: "For sale", reserved: "Reserved", sold: "Sold", draft: "Draft" };
const pieceState = (s: string) => STATUS_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

function sized(src: string, w: number): string {
  return src.startsWith("/api/media/") && !src.includes("?") ? `${src}?w=${w}` : src;
}

// --- shell -----------------------------------------------------------------

function Nav({ groups, label }: { groups: ChannelNavGroup[]; label: string }) {
  return (
    <nav className="ch-nav" aria-label={label}>
      {groups.map((g) => (
        <details key={g.id} className="ch-group" open={g.open}>
          <summary className="ch-group__head">
            <span>{g.label}</span>
            <Icon name="chevron" className="ch-group__chev" />
          </summary>
          <ul className="ch-group__list">
            {g.items.map((item) => (
              <li key={item.id}>
                {item.soon && !item.href ? (
                  <span className="ch-item ch-item--soon" aria-disabled="true">
                    <Icon name={item.icon} className="ch-item__icon" />
                    <span className="ch-item__label">{item.label}</span>
                    <span className="ch-item__soon">Soon</span>
                  </span>
                ) : (
                  <a className="ch-item" href={item.href ?? "#"} aria-current={item.current ? "page" : undefined}>
                    <Icon name={item.icon} className="ch-item__icon" />
                    <span className="ch-item__label">{item.label}</span>
                    {item.count ? <span className={`ch-item__count${item.alert ? " ch-item__count--alert" : ""}`}>{item.count}</span> : null}
                    {!item.view ? <Icon name="out" className="ch-item__out" /> : null}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}

function OrgPicker({ data }: { data: ChannelData }) {
  const current = data.org?.name ?? "Just me";
  const opts = [{ orgId: null as string | null, name: "Just me", role: "Your own channel" }, ...data.orgs.map((o) => ({ orgId: o.orgId, name: o.name, role: "" }))];
  return (
    <details className="ch-org">
      <summary className="ch-org__current">
        <span className="ch-org__for">For</span>
        <span className="ch-org__name">{current}</span>
        <Icon name="chevron" />
      </summary>
      <ul className="ch-org__list">
        {opts.map((o) => (
          <li key={o.orgId ?? "me"}>
            <a className="ch-org__opt" href={channelHref(data.links, data.view, o.orgId)} aria-current={(data.org?.orgId ?? null) === o.orgId ? "true" : undefined}>
              <span>{o.name}</span>
              {o.role ? <span className="ch-org__role">{o.role}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

const VIEW_TITLE: Record<ChannelViewId, string> = { overview: "Overview", posts: "Posts", artwork: "Artwork", accounts: "Accounts", activity: "Activity" };

export interface ChannelConsoleProps {
  data: ChannelData;
  postArtwork: ChannelPostArtworkAction;
}

export function ChannelConsole({ data, postArtwork }: ChannelConsoleProps) {
  const groups = buildChannelNav(data).map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, current: i.view === data.view })),
  }));
  const who = data.org?.name ?? "Your channel";

  return (
    <div className="ch">
      <Sprite />
      <a className="ch-skip" href="#ch-main">
        Skip to content
      </a>
      <header className="ch-top">
        <details className="ch-menu">
          <summary className="ch-menu__toggle">
            <Icon name="menu" />
            Menu
          </summary>
          <div className="ch-menu__panel">
            {data.today ? <Today today={data.today} /> : null}
            <Nav groups={groups} label="Channel menu" />
          </div>
        </details>
        {data.links.writing ? (
          <a className="ch-top__back" href={data.links.writing}>
            <Icon name="back" />
            Studio
          </a>
        ) : null}
        <span className="ch-top__mark">Channel</span>
        <OrgPicker data={data} />
        <span className="ch-top__spacer" />
        {data.links.center ? (
          <a className="ch-top__link" href={data.links.center}>
            Center
          </a>
        ) : null}
      </header>
      <div className="ch-frame">
        <aside className="ch-side">
          {data.today ? <Today today={data.today} /> : null}
          <Nav groups={groups} label="Channel" />
        </aside>
        <main className="ch-main" id="ch-main" tabIndex={-1}>
          {data.today ? <Today today={data.today} main /> : null}
          <nav aria-label="Breadcrumb">
            <ol className="ch-crumbs">
              <li>{data.links.site ? <a href={data.links.site}>{who}</a> : who}</li>
              <li>
                <a href={channelHref(data.links, "overview", data.org?.orgId ?? null)}>Channel</a>
              </li>
              <li aria-current="page">{VIEW_TITLE[data.view]}</li>
            </ol>
          </nav>
          {data.notice ? (
            <p className="ch-card ch-card__body" role="status" style={{ marginBottom: "var(--ch-s4)" }}>
              {data.notice}
            </p>
          ) : null}
          {data.view === "artwork" ? (
            <ArtworkView data={data} postArtwork={postArtwork} />
          ) : data.view === "posts" ? (
            <PostsView data={data} />
          ) : data.view === "accounts" ? (
            <AccountsView data={data} />
          ) : data.view === "activity" ? (
            <ActivityView data={data} />
          ) : (
            <OverviewView data={data} postArtwork={postArtwork} />
          )}
        </main>
      </div>
    </div>
  );
}

function Today({ today, main }: { today: NonNullable<ChannelData["today"]>; main?: boolean }) {
  return (
    <div className={`ch-today${main ? " ch-today--main" : ""}`}>
      <div className="ch-today__label">Today</div>
      <div className="ch-today__title">{today.label}</div>
      <a className="ch-today__go" href={today.href}>
        Open the step
      </a>
    </div>
  );
}

function Head({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <div className="ch-head">
      <div>
        <h1 className="ch-head__title">{title}</h1>
        <p className="ch-head__sub">{sub}</p>
      </div>
      {actions ? <div className="ch-head__actions">{actions}</div> : null}
    </div>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="ch-empty">
      <p className="ch-empty__title">{title}</p>
      <p className="ch-empty__text">{text}</p>
      {action}
    </div>
  );
}

function Card({ id, title, more, wide, children }: { id: string; title: string; more?: { href: string; label: string } | null; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`ch-card${wide ? " ch-card--wide" : ""}`} aria-labelledby={id}>
      <div className="ch-card__head">
        <h2 className="ch-card__title" id={id}>
          {title}
        </h2>
        {more ? (
          <a className="ch-card__more" href={more.href}>
            {more.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PostThisForm({ data, piece, again, postArtwork }: { data: ChannelData; piece: ChannelArtwork; again?: boolean; postArtwork: ChannelPostArtworkAction }) {
  return (
    <form action={postArtwork}>
      <input type="hidden" name="artworkId" value={piece.id} />
      <input type="hidden" name="orgId" value={data.org?.orgId ?? ""} />
      <button type="submit" className={`ch-btn ch-btn--sm${again ? "" : " ch-btn--primary"}`}>
        {again ? "Post again" : "Post this"}
        <span className="ch-sr">: {piece.title}</span>
      </button>
    </form>
  );
}

function shareStatus(post: ChannelPost, jobs: ChannelJob[]): ReactNode {
  const failed = jobs.filter((j) => j.sourceKind === "social_post" && j.sourceId === post.id && j.status === "failed");
  if (post.shares.length === 0 && failed.length === 0) return <span className="ch-status ch-status--wait">Draft</span>;
  return (
    <>
      {post.shares.map((s, i) => (
        <span key={`${s.kind}-${i}`} className="ch-status ch-status--ok">
          {providerName(s.kind)} ✓
        </span>
      ))}
      {failed.slice(0, 2).map((j) => (
        <span key={j.id} className="ch-status ch-status--fail">
          {providerName(j.provider)} failed !
        </span>
      ))}
    </>
  );
}

// --- views ------------------------------------------------------------------

function OverviewView({ data, postArtwork }: ChannelConsoleProps) {
  const orgId = data.org?.orgId ?? null;
  const who = data.org?.name ?? "you";
  const unposted = data.artworks.filter((a) => a.postCount === 0 && a.status !== "draft");
  const failed = recentFailures(data.jobs);
  const month = Date.now() - 30 * 86_400_000;
  const recentPosts = data.posts.filter((p) => Date.parse(p.updatedAt) > month).length;
  const channels = data.accounts.filter((a) => a.isOrgChannel || a.targets.some((t) => t.isOrgChannel)).length;
  const nothing = data.posts.length === 0 && data.jobs.length === 0 && data.artworks.length === 0;

  return (
    <>
      <Head
        title={data.org?.name ?? "Your channel"}
        sub={`What ${who} has published, where it went, and what is waiting.`}
        actions={
          <>
            {data.links.writing ? (
              <a className="ch-btn" href={data.links.writing}>
                New writing
              </a>
            ) : null}
            {data.links.post ? (
              <a className="ch-btn ch-btn--primary" href={data.links.post}>
                New post
              </a>
            ) : null}
          </>
        }
      />
      <h2 className="ch-sr">At a glance</h2>
      <div className="ch-tiles">
        <a className="ch-tile" href={channelHref(data.links, "posts", orgId)}>
          <span className="ch-tile__n">{recentPosts}</span>
          <span className="ch-tile__label">posts in the last 30 days</span>
        </a>
        <a className="ch-tile" href={channelHref(data.links, "artwork", orgId, { filter: "unposted" })}>
          <span className="ch-tile__n">{unposted.length}</span>
          <span className="ch-tile__label">pieces not yet posted</span>
        </a>
        <a className={`ch-tile${failed ? " ch-tile--alert" : ""}`} href={channelHref(data.links, "activity", orgId, { filter: "failed" })}>
          <span className="ch-tile__n">{failed}</span>
          <span className="ch-tile__label">failed sends</span>
        </a>
        <a className="ch-tile" href={channelHref(data.links, "accounts", orgId)}>
          <span className="ch-tile__n">{data.accounts.filter((a) => a.status === "connected").length}</span>
          <span className="ch-tile__label">{data.org ? `accounts connected · ${channels} post for ${data.org.name}` : "accounts connected"}</span>
        </a>
      </div>

      {nothing ? (
        <section className="ch-card">
          <Empty
            title={`Nothing published from ${data.org?.name ?? "your channel"} yet.`}
            text="Posts, writing and videos you publish show up here, with where each one went."
            action={data.links.post ? <a className="ch-btn ch-btn--primary" href={data.links.post}>New post</a> : null}
          />
        </section>
      ) : (
        <div className="ch-grid">
          {data.artworks.length > 0 ? (
            <Card id="ch-unposted" title="Not yet posted" wide more={{ href: channelHref(data.links, "artwork", orgId), label: "All artwork" }}>
              {unposted.length === 0 ? (
                <Empty title="Every piece has been posted." text="Post one again, or follow it up with a video or writing, from Artwork." />
              ) : (
                <ul className="ch-rows">
                  {unposted.slice(0, 4).map((a) => (
                    <li key={a.id} className="ch-row">
                      {a.imageUrl ? <img src={sized(a.imageUrl, 256)} alt="" width={44} height={44} style={{ borderRadius: 6, objectFit: "cover", flex: "none" }} /> : <Icon name="artwork" className="ch-row__icon" />}
                      <span className="ch-row__main">
                        {a.href ? (
                          <a className="ch-row__title" href={a.href}>
                            {a.title}
                          </a>
                        ) : (
                          <span className="ch-row__title">{a.title}</span>
                        )}
                        <span className="ch-row__meta">{[pieceState(a.status), a.priceLabel].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="ch-row__act">
                        <PostThisForm data={data} piece={a} postArtwork={postArtwork} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card id="ch-recent" title="Recent posts" more={data.posts.length ? { href: channelHref(data.links, "posts", orgId), label: "All posts" } : null}>
            {data.posts.length === 0 ? (
              <Empty title="No posts yet." text="A post is a short text with pictures, sent to the network and to the accounts you choose." />
            ) : (
              <ul className="ch-rows">
                {data.posts.slice(0, 5).map((p) => (
                  <li key={p.id} className="ch-row">
                    <span className="ch-row__main">
                      <a className="ch-row__title" href={p.editHref}>
                        {p.title}
                      </a>
                      <span className="ch-row__meta" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {shareStatus(p, data.jobs)}
                      </span>
                    </span>
                    <span className="ch-row__act ch-row__meta">{shortDate(p.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card id="ch-accounts" title="Accounts" more={data.links.connections ? { href: data.links.connections, label: "Manage" } : null}>
            <AccountRows data={data} limit={4} />
          </Card>

          <Card id="ch-follow" title="Follow a piece up">
            <ul className="ch-rows">
              {data.links.video ? (
                <li className="ch-row">
                  <Icon name="video" className="ch-row__icon" />
                  <span className="ch-row__main">
                    <a className="ch-row__title" href={data.links.video}>
                      Make a short video
                    </a>
                    <span className="ch-row__meta">Photos or a phone clip, in the Studio&rsquo;s video maker.</span>
                  </span>
                </li>
              ) : null}
              {data.links.writing ? (
                <li className="ch-row">
                  <Icon name="writing" className="ch-row__icon" />
                  <span className="ch-row__main">
                    <a className="ch-row__title" href={data.links.writing}>
                      Write about a piece
                    </a>
                    <span className="ch-row__meta">A longer piece for the site and the newsletter.</span>
                  </span>
                </li>
              ) : null}
              {data.links.newsletter ? (
                <li className="ch-row">
                  <Icon name="newsletter" className="ch-row__icon" />
                  <span className="ch-row__main">
                    <a className="ch-row__title" href={data.links.newsletter}>
                      Send a newsletter
                    </a>
                    <span className="ch-row__meta">To {data.org?.name ?? "your"} subscribers, from the email suite.</span>
                  </span>
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function ArtworkView({ data, postArtwork }: ChannelConsoleProps) {
  const orgId = data.org?.orgId ?? null;
  const filter = data.filter === "unposted" || data.filter === "posted" ? data.filter : "all";
  const shown = data.artworks.filter((a) => (filter === "unposted" ? a.postCount === 0 : filter === "posted" ? a.postCount > 0 : true));
  const opt = (id: string, label: string, n: number) => (
    <a className="ch-filter__opt" href={channelHref(data.links, "artwork", orgId, id === "all" ? {} : { filter: id })} aria-current={filter === id ? "page" : undefined}>
      {label} · {n}
    </a>
  );

  return (
    <>
      <Head
        title="Artwork"
        sub={`Pieces in ${data.org ? `${data.org.name}’s store` : "your stores"}. "Post this" makes a draft from the piece; nothing is sent until you press Post.`}
        actions={
          data.links.store ? (
            <a className="ch-btn" href={data.links.store}>
              Open the store
            </a>
          ) : null
        }
      />
      {data.artworks.length === 0 ? (
        <section className="ch-card">
          <Empty
            title="No pieces in the store."
            text="Add pieces in the store, then post them from here."
            action={data.links.store ? <a className="ch-btn" href={data.links.store}>Open the store</a> : null}
          />
        </section>
      ) : (
        <>
          <div className="ch-filter" style={{ marginBottom: "var(--ch-s4)" }}>
            {opt("all", "All", data.artworks.length)}
            {opt("unposted", "Not posted", data.artworks.filter((a) => a.postCount === 0).length)}
            {opt("posted", "Posted", data.artworks.filter((a) => a.postCount > 0).length)}
          </div>
          <ul className="ch-pieces">
            {shown.map((a) => (
              <li key={a.id} className="ch-piece">
                {a.imageUrl ? (
                  <img className="ch-piece__img" src={sized(a.imageUrl, 512)} alt="" loading="lazy" />
                ) : (
                  <span className="ch-piece__img">
                    <Icon name="artwork" />
                  </span>
                )}
                <div className="ch-piece__body">
                  {a.href ? (
                    <a className="ch-piece__title" href={a.href}>
                      {a.title}
                    </a>
                  ) : (
                    <span className="ch-piece__title">{a.title}</span>
                  )}
                  <span className="ch-piece__meta">
                    {[a.priceLabel, pieceState(a.status), a.postCount ? `Posted ${a.postCount} time${a.postCount === 1 ? "" : "s"}, last ${shortDate(a.lastPostedAt)}` : "not posted"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <div className="ch-piece__acts">
                    <PostThisForm data={data} piece={a} again={a.postCount > 0} postArtwork={postArtwork} />
                    {data.links.video ? (
                      <a className="ch-piece__link" href={data.links.video}>
                        Video<span className="ch-sr">: {a.title}</span>
                      </a>
                    ) : null}
                    {data.links.writing ? (
                      <a className="ch-piece__link" href={data.links.writing}>
                        Writing<span className="ch-sr">: {a.title}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function PostsView({ data }: { data: ChannelData }) {
  return (
    <>
      <Head
        title="Posts"
        sub="Short posts with pictures, and where each one was sent."
        actions={
          data.links.post ? (
            <a className="ch-btn ch-btn--primary" href={data.links.post}>
              New post
            </a>
          ) : null
        }
      />
      <section className="ch-card">
        {data.posts.length === 0 ? (
          <Empty title="No posts yet." text="A post is a short text with pictures, sent to the network and to the accounts you choose." />
        ) : (
          <table className="ch-table">
            <caption className="ch-sr">Posts from {data.org?.name ?? "your channel"}, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col">Sent to</th>
                <th scope="col">Changed</th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map((p) => (
                <tr key={p.id}>
                  <td data-label="Post">
                    <a href={p.editHref}>{p.title}</a>
                    {p.excerpt && p.excerpt !== p.title ? <span className="ch-row__meta">{p.excerpt.slice(0, 120)}</span> : null}
                  </td>
                  <td data-label="Sent to">
                    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>{shareStatus(p, data.jobs)}</span>
                  </td>
                  <td data-label="Changed" className="ch-table__when">
                    {shortDate(p.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function accountLine(a: ChannelAccount, orgName: string | null): { title: string; meta: string; isChannel: boolean } {
  const pages = a.targets.filter((t) => t.canPublish);
  const channelPages = a.targets.filter((t) => t.isOrgChannel);
  const isChannel = a.isOrgChannel || channelPages.length > 0;
  const name = a.accountName ?? a.label;
  const title = `${providerName(a.provider)} · ${name}`;
  const parts: string[] = [];
  if (a.status === "error") parts.push(a.error ? `Needs reconnecting: ${a.error.slice(0, 80)}` : "Needs reconnecting");
  else if (a.status === "pending") parts.push("Not finished connecting");
  if (a.provider === "meta") parts.push(pages.length ? `Pages: ${pages.map((t) => t.name + (t.instagramUsername ? ` (Instagram @${t.instagramUsername})` : "")).join(", ")}` : "No Page ticked");
  if (orgName) parts.push(isChannel ? `Posts for ${orgName}` : `Not set to post for ${orgName}`);
  return { title, meta: parts.join(" · "), isChannel };
}

function AccountRows({ data, limit }: { data: ChannelData; limit?: number }) {
  if (data.accounts.length === 0) {
    return (
      <Empty
        title="No accounts connected."
        text="Connect Facebook, Instagram, Threads or YouTube to post there from the Studio."
        action={data.links.connections ? <a className="ch-btn" href={data.links.connections}>Connect an account</a> : null}
      />
    );
  }
  const rows = limit ? data.accounts.slice(0, limit) : data.accounts;
  return (
    <ul className="ch-rows">
      {rows.map((a) => {
        const line = accountLine(a, data.org?.name ?? null);
        return (
          <li key={a.id} className="ch-row">
            <Icon name="accounts" className="ch-row__icon" />
            <span className="ch-row__main">
              {a.accountUrl ? (
                <a className="ch-row__title" href={a.accountUrl}>
                  {line.title}
                </a>
              ) : (
                <span className="ch-row__title">{line.title}</span>
              )}
              <span className="ch-row__meta">{line.meta}</span>
            </span>
            <span className="ch-row__act">
              {a.status === "connected" ? (
                <span className={`ch-status ${data.org && line.isChannel ? "ch-status--ok" : "ch-status--wait"}`}>{data.org && line.isChannel ? "Posts here ✓" : "Connected ✓"}</span>
              ) : (
                <span className="ch-status ch-status--warn">Reconnect ↻</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AccountsView({ data }: { data: ChannelData }) {
  return (
    <>
      <Head
        title="Accounts"
        sub={
          data.org
            ? `Your connected accounts, and which of them post for ${data.org.name}. Connecting, reconnecting and choosing are done in Connections.`
            : "Your connected accounts. Connecting, reconnecting and removing are done in Connections."
        }
        actions={
          data.links.connections ? (
            <a className="ch-btn ch-btn--primary" href={data.links.connections}>
              Open Connections
            </a>
          ) : null
        }
      />
      <section className="ch-card">
        <AccountRows data={data} />
      </section>
    </>
  );
}

function ActivityView({ data }: { data: ChannelData }) {
  const orgId = data.org?.orgId ?? null;
  const filter = data.filter === "failed" || data.filter === "sent" ? data.filter : "all";
  const jobs = data.jobs.filter((j) => (filter === "failed" ? j.status === "failed" : filter === "sent" ? j.status === "done" : true));
  const opt = (id: string, label: string) => (
    <a className="ch-filter__opt" href={channelHref(data.links, "activity", orgId, id === "all" ? {} : { filter: id })} aria-current={filter === id ? "page" : undefined}>
      {label}
    </a>
  );
  const status = (j: ChannelJob) =>
    j.status === "done" ? (
      <span className="ch-status ch-status--ok">Sent ✓</span>
    ) : j.status === "failed" ? (
      <span className="ch-status ch-status--fail">Failed !</span>
    ) : (
      <span className="ch-status ch-status--wait">Queued ◷</span>
    );

  return (
    <>
      <Head title="Activity" sub="Every send to Facebook, Instagram and Threads, newest first." />
      <div className="ch-filter" style={{ marginBottom: "var(--ch-s4)" }}>
        {opt("all", "All")}
        {opt("failed", "Failed")}
        {opt("sent", "Sent")}
      </div>
      <section className="ch-card">
        {jobs.length === 0 ? (
          filter === "failed" ? (
            <Empty title="No failed sends." text="Sends that fail are listed here with the reason." />
          ) : (
            <Empty title="Nothing sent yet." text="Each time a post goes to Facebook, Instagram or Threads, the send is listed here." />
          )
        ) : (
          <table className="ch-table">
            <caption className="ch-sr">Sends from {data.org?.name ?? "your channel"}, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Where</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td data-label="When" className="ch-table__when">
                    {shortDate(j.createdAt)}
                  </td>
                  <td data-label="What">{j.sourceHref ? <a href={j.sourceHref}>{j.sourceTitle ?? (j.sourceKind === "thread" ? "A piece" : "A post")}</a> : (j.sourceTitle ?? "A post")}</td>
                  <td data-label="Where">
                    {providerName(j.provider)} · {j.targetLabel}
                  </td>
                  <td data-label="Status">
                    {status(j)}{" "}
                    {j.externalUrl ? (
                      <a href={j.externalUrl}>
                        View<span className="ch-sr"> on {providerName(j.provider)}</span>
                      </a>
                    ) : null}
                    {j.error ? <span className="ch-table__err">{j.error.slice(0, 200)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
