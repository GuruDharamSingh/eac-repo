import type { ReactNode } from "react";
import {
  getCommunityFeed,
  getOrgFeed,
  type OrgFeedItem,
  type OrgSummary,
} from "./queries";
import { InquiryForm } from "./inquiry-form";
import { MediaUploadWidget } from "./media-upload";

type EmbedAttrs = Record<string, string>;

const ATTR_RE = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/=`]+)))?/g;
const EMBED_RE =
  /<eac-embed\b([^>]*)>[\s\S]*?<\/eac-embed>|<(div|section|article)\b([^>]*\bdata-eac-component\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*)>[\s\S]*?<\/\2>/gi;

function parseAttrs(input: string): EmbedAttrs {
  const attrs: EmbedAttrs = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(input))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function normalizeLimit(value: string | undefined, fallback: number): number {
  const limit = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(limit, 1), 8);
}

function isInline(attrs: EmbedAttrs): boolean {
  return attrs["data-variant"] === "inline";
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function isSessionLike(item: Pick<OrgFeedItem, "kind" | "scheduled_at">) {
  return (
    Boolean(item.scheduled_at) ||
    /workshop|session|class|event|meeting/i.test(item.kind)
  );
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HtmlSegment({ html }: { html: string }) {
  if (!html) return null;
  return <div className="contents" dangerouslySetInnerHTML={{ __html: html }} />;
}

function EmbedShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="border-y border-border bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-serif text-2xl leading-tight md:text-3xl">
          {title}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function EmptyEmbed({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function maybeWrap(
  attrs: EmbedAttrs,
  children: ReactNode,
  shell: { title: string; eyebrow: string }
) {
  if (isInline(attrs)) return children;
  return (
    <EmbedShell eyebrow={shell.eyebrow} title={shell.title}>
      {children}
    </EmbedShell>
  );
}

/* ---- The feed-list pen, server-rendered ---------------------------------- */

/**
 * Flatten authored HTML to plain text for the row's expanded preview.
 *
 * A regex is a poor HTML parser and a fine text extractor: the result is
 * rendered by React as a TEXT node, never as markup, so nothing it fails to
 * strip can execute. Do not reuse this to produce HTML.
 */
function plainText(html: string | null | undefined, max = 420): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "\u2026";
}

export type FeedPenRow = {
  id: string;
  title: string;
  kicker?: string | null;
  summary?: string | null;
  meta?: string | null;
  detail?: string | null;
  avatar?: string | null;
};

/**
 * The `feed-list` pen, rendered from live data
 * (packages/silex-nextcloud-connector/src/pens/feed-list).
 *
 * Deliberately the checkbox version, identical to the block an editor can
 * drop in Silex — a published org site should not need client JavaScript to
 * open a row, and a page that mixes a hand-built Feed List with a live feed
 * slot must not have two different-looking feeds on it. The React twin with
 * the FLIP morph (@elkdonis/cms-ui/pens) is for the apps, not for here.
 *
 * The stylesheet is the pen's own. Host apps import it once:
 *   @import "@elkdonis/cms-ui/feed-list.css";
 */
function FeedPen({
  rows,
  openLayout,
  frame = "card",
}: {
  rows: FeedPenRow[];
  openLayout: "stack" | "inline";
  frame?: "card" | "plain";
}) {
  return (
    <div
      className="eac-pen-feed"
      data-pen="feed-list"
      data-speed="normal"
      data-open-layout={openLayout}
      data-frame={frame}
    >
      <ul className="eac-pen-feed-list">
        {rows.map((row) => (
          <li className="eac-pen-feed-li" key={row.id}>
            <label className="eac-pen-feed-item">
              <input
                className="eac-pen-feed-toggle"
                type="checkbox"
                aria-label={`Open ${row.title}`}
              />
              {row.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="eac-pen-feed-avatar" src={row.avatar} alt="" />
              ) : (
                <span className="eac-pen-feed-avatar" aria-hidden />
              )}
              <div className="eac-pen-feed-body">
                {row.kicker ? <p className="eac-pen-feed-kicker">{row.kicker}</p> : null}
                <h3 className="eac-pen-feed-title">{row.title}</h3>
                {row.summary ? <p className="eac-pen-feed-summary">{row.summary}</p> : null}
                {row.meta ? <p className="eac-pen-feed-meta">{row.meta}</p> : null}
              </div>
              <div className="eac-pen-feed-extra">
                <div className="eac-pen-feed-extra-inner">
                  <p>{row.detail ?? "Nothing further was published with this one."}</p>
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Which shape a feed slot draws. `data-layout` is one trait rather than
 * three, so the editor's Settings panel stays a single choice.
 */
function feedLayout(attrs: EmbedAttrs): "cards" | "stack" | "inline" {
  const value = (attrs["data-layout"] || "").toLowerCase();
  if (value === "expand") return "stack";
  if (value === "expand-inline") return "inline";
  return "cards";
}

function OrgFeedCards({ items }: { items: OrgFeedItem[] }) {
  if (items.length === 0) {
    return <EmptyEmbed>No public updates have been published yet.</EmptyEmbed>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-md border border-border bg-card p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>{item.kind}</span>
            {formatDate(item.scheduled_at ?? item.published_at) && (
              <span>{formatDate(item.scheduled_at ?? item.published_at)}</span>
            )}
          </div>
          <h3 className="font-serif text-xl leading-snug">{item.title}</h3>
          {item.excerpt && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.excerpt}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function WorkshopCards({
  items,
  orgSlug,
}: {
  items: OrgFeedItem[];
  orgSlug: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyEmbed>
        No workshops are scheduled yet. Check back soon.
      </EmptyEmbed>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const sessionCount = Array.isArray(item.sessions)
          ? item.sessions.length
          : 0;
        const totalSessions = sessionCount + (item.scheduled_at ? 1 : 0);
        const priceLabel = formatPrice(item.price, item.currency);
        return (
          <article
            key={item.id}
            className="flex flex-col rounded-md border border-border bg-card p-5"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>Workshop</span>
              {formatDate(item.scheduled_at) && (
                <span>{formatDate(item.scheduled_at)}</span>
              )}
            </div>
            <h3 className="font-serif text-xl leading-snug">{item.title}</h3>
            {item.excerpt && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {item.excerpt}
              </p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Sessions</dt>
                <dd className="font-medium">
                  {totalSessions > 0 ? totalSessions : "TBA"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium">{priceLabel}</dd>
              </div>
              {item.duration_minutes ? (
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="font-medium">{item.duration_minutes} min</dd>
                </div>
              ) : null}
              {item.attendee_limit ? (
                <div>
                  <dt className="text-muted-foreground">Capacity</dt>
                  <dd className="font-medium">{item.attendee_limit}</dd>
                </div>
              ) : null}
            </dl>
            {item.is_rsvp_enabled && (
              <a
                href={`/login?mode=signup&org=${encodeURIComponent(orgSlug)}`}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reserve a place
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}

function formatPrice(
  price: string | number | null | undefined,
  currency: string | null | undefined
): string {
  if (price === null || price === undefined || price === "") return "Free";
  const num = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(num) || num <= 0) return "Free";
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
  } catch {
    return `${num} ${code}`;
  }
}

// ---------------------------------------------------------------------------
// Overlay blog cards — tall image cards, date badge, hover-reveal content.
// First CodePen design, two variants alternating: "overlay" and "header".
// ---------------------------------------------------------------------------

const BLOG_CARDS_OVERLAY_CSS = `
.eac-bco-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media(max-width:760px){.eac-bco-row{grid-template-columns:1fr}}
.eac-bco{overflow:hidden;border:2px solid var(--eac-surface-line,#40215c);transition:border-color .3s}
.eac-bco:hover{border-color:var(--eac-surface-rule,#9c40d8)}
.eac-bco a{color:inherit;text-decoration:none}
.eac-bco .eac-bco-wrap{background-color:var(--eac-surface-bg-soft,#050505);min-height:380px;position:relative;overflow:hidden;background-size:cover;background-position:center;background-repeat:no-repeat}
.eac-bco .eac-bco-wrap:hover .eac-bco-data{transform:translateY(0)}
.eac-bco .eac-bco-nophoto{position:absolute;inset:0;display:grid;place-items:center;color:var(--eac-surface-line,#40215c);font-size:4rem;font-weight:700;pointer-events:none}
.eac-bco .eac-bco-data{position:absolute;bottom:0;width:100%;transform:translateY(calc(70px + 1em));transition:transform .3s}
.eac-bco .eac-bco-content{padding:1em;position:relative;z-index:1}
.eac-bco .eac-bco-author{font-size:12px;color:var(--eac-surface-muted,#bca7cf);letter-spacing:.06em;text-transform:uppercase}
.eac-bco .eac-bco-title{margin-top:10px;font-size:1.15rem;font-weight:700;line-height:1.25}
.eac-bco .eac-bco-text{height:70px;margin:0;font-size:13px;line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical}
.eac-bco-v1 .eac-bco-date{position:absolute;top:0;left:0;background:var(--eac-surface-rule,#9c40d8);color:#fff;padding:.8em;z-index:2}
.eac-bco-v1 .eac-bco-date span{display:block;text-align:center}
.eac-bco-v1 .eac-bco-day{font-weight:700;font-size:24px;text-shadow:2px 3px 2px rgba(0,0,0,.18)}
.eac-bco-v1 .eac-bco-month{text-transform:uppercase}
.eac-bco-v1 .eac-bco-month,.eac-bco-v1 .eac-bco-year{font-size:12px}
.eac-bco-v1 .eac-bco-content{background:var(--eac-surface-bg-soft,#050505);box-shadow:0 5px 30px 10px rgba(0,0,0,.3)}
.eac-bco-v1 .eac-bco-title a{color:var(--eac-surface-accent,#ff8c00)}
.eac-bco-v1 .eac-bco-text{color:var(--eac-surface-fg,#e8e3e4)}
.eac-bco-v2 .eac-bco-header{display:flex;align-items:center;justify-content:space-between;color:#fff;padding:1em}
.eac-bco-v2 .eac-bco-date{font-size:12px;color:var(--eac-surface-fg,#e8e3e4)}
.eac-bco-v2 .eac-bco-data{color:var(--eac-surface-fg,#e8e3e4);transform:translateY(calc(70px + 4em))}
.eac-bco-v2 .eac-bco-title a{color:#fff}
.eac-bco-v2 .eac-bco-text{color:rgba(232,227,228,.85)}
.eac-bco-v2 .eac-bco-readmore{display:block;width:100px;margin:2em auto 1em;text-align:center;font-size:12px;color:var(--eac-surface-accent,#20d7ff);font-weight:700;position:relative}
.eac-bco-v2 .eac-bco-readmore::after{content:"\\2192";opacity:0;position:absolute;right:0;top:50%;transform:translate(0,-50%);transition:all .3s}
.eac-bco-v2 .eac-bco-readmore:hover::after{transform:translate(5px,-50%);opacity:1}
@media(prefers-reduced-motion:reduce){.eac-bco .eac-bco-data,.eac-bco-v2 .eac-bco-readmore::after{transition:none}}
`;

function parseBlogDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short" }),
    year: d.getFullYear(),
  };
}

function BlogCardsOverlayV1({
  item,
  orgName,
}: {
  item: OrgFeedItem;
  orgName: string;
}) {
  const date = parseBlogDate(item.published_at);
  return (
    <div className="eac-bco eac-bco-v1">
      <div className="eac-bco-wrap">
        <div className="eac-bco-nophoto" aria-hidden="true">
          {orgName.slice(0, 4).toUpperCase()}
        </div>
        {date && (
          <div className="eac-bco-date">
            <span className="eac-bco-day">{date.day}</span>
            <span className="eac-bco-month">{date.month}</span>
            <span className="eac-bco-year">{date.year}</span>
          </div>
        )}
        <div className="eac-bco-data">
          <div className="eac-bco-content">
            <h3 className="eac-bco-title">
              <a href={`/${item.slug}`}>{item.title}</a>
            </h3>
            {item.excerpt && <p className="eac-bco-text">{item.excerpt}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogCardsOverlayV2({
  item,
  orgName,
}: {
  item: OrgFeedItem;
  orgName: string;
}) {
  const date = parseBlogDate(item.published_at);
  return (
    <div className="eac-bco eac-bco-v2">
      <div className="eac-bco-wrap">
        <div className="eac-bco-nophoto" aria-hidden="true">
          {orgName.slice(0, 4).toUpperCase()}
        </div>
        <div className="eac-bco-header">
          {date && (
            <div className="eac-bco-date">
              <span>{date.day} {date.month} {date.year}</span>
            </div>
          )}
        </div>
        <div className="eac-bco-data">
          <div className="eac-bco-content">
            <h3 className="eac-bco-title">
              <a href={`/${item.slug}`}>{item.title}</a>
            </h3>
            {item.excerpt && <p className="eac-bco-text">{item.excerpt}</p>}
            <a href={`/${item.slug}`} className="eac-bco-readmore">Read more</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogCardsOverlay({
  items,
  orgName,
}: {
  items: OrgFeedItem[];
  orgName: string;
}) {
  if (items.length === 0) {
    return <EmptyEmbed>No blog posts have been published yet.</EmptyEmbed>;
  }
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CARDS_OVERLAY_CSS }} />
      <div className="eac-bco-row">
        {items.map((item, i) =>
          i % 2 === 0 ? (
            <BlogCardsOverlayV1 key={item.id} item={item} orgName={orgName} />
          ) : (
            <BlogCardsOverlayV2 key={item.id} item={item} orgName={orgName} />
          )
        )}
      </div>
    </>
  );
}

async function BlogCardsOverlayEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 4);
  const items = (await getOrgFeed(org.id, 20))
    .filter((t) => t.kind === "post")
    .slice(0, limit);
  return maybeWrap(
    attrs,
    <BlogCardsOverlay items={items} orgName={org.name} />,
    { eyebrow: org.name, title: attrs["data-title"] || "Blog" }
  );
}

// ---------------------------------------------------------------------------
// Horizontal blog cards — image left/right, hover-reveal author overlay.
// Second CodePen design, alternating direction.
// ---------------------------------------------------------------------------

const BLOG_CARDS_CSS = `
.eac-bc{display:flex;flex-direction:column;margin:0 0 14px;box-shadow:0 3px 7px -1px rgba(0,0,0,.3);background:var(--eac-surface-bg-soft,#050505);line-height:1.4;overflow:hidden;border:2px solid var(--eac-surface-line,#40215c);transition:border-color .2s}
.eac-bc a{color:inherit;text-decoration:none}.eac-bc a:hover{color:var(--eac-surface-accent,#20d7ff)}
.eac-bc:hover{border-color:var(--eac-surface-rule,#9c40d8)}
.eac-bc:hover .eac-bc-photo{transform:scale(1.3) rotate(3deg)}
.eac-bc:hover .eac-bc-details{left:0}
.eac-bc-meta{position:relative;z-index:0;height:200px;overflow:hidden}
.eac-bc-photo{position:absolute;inset:0;background-size:cover;background-position:center;background-color:var(--eac-surface-bg,#0a0a0a);transition:transform .2s}
.eac-bc-nophoto{position:absolute;inset:0;display:grid;place-items:center;color:var(--eac-surface-line,#40215c);font-size:3rem;font-weight:700;pointer-events:none}
.eac-bc-details{position:absolute;top:0;bottom:0;left:-100%;margin:auto;transition:left .2s;background:rgba(0,0,0,.7);color:var(--eac-surface-fg,#e8e3e4);padding:10px;width:100%;font-size:.9rem;display:flex;flex-direction:column;justify-content:center;gap:6px;list-style:none}
.eac-bc-details a{text-decoration:dotted underline}
.eac-bc-dlabel{color:var(--eac-surface-muted,#bca7cf);font-size:.78rem;letter-spacing:.06em;text-transform:uppercase}
.eac-bc-desc{padding:1rem;background:var(--eac-surface-bg-soft,#050505);position:relative;z-index:1}
.eac-bc-desc h3{line-height:1.15;margin:0;font-size:1.4rem;font-weight:700;color:var(--eac-surface-accent,#ff8c00)}
.eac-bc-desc h3 a{color:var(--eac-surface-accent,#ff8c00)}
.eac-bc-desc h3 a:hover{color:var(--eac-surface-fg,#20d7ff)}
.eac-bc-sub{font-size:.85rem;font-weight:300;text-transform:uppercase;color:var(--eac-surface-muted,#bca7cf);margin-top:5px}
.eac-bc-excerpt{position:relative;margin:1rem 0 0;color:var(--eac-surface-fg,#e8e3e4);font-size:.95rem;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.eac-bc-excerpt:first-of-type{margin-top:1.25rem}
.eac-bc-excerpt:first-of-type::before{content:"";position:absolute;height:4px;background:var(--eac-surface-rule,#9c40d8);width:35px;top:-.75rem;border-radius:3px}
.eac-bc-more{text-align:right;margin-top:.75rem}
.eac-bc-more a{color:var(--eac-surface-accent,#20d7ff);font-weight:700;font-size:.9rem;position:relative;display:inline-block}
.eac-bc-more a::after{content:" \\2192";margin-left:-10px;opacity:0;transition:margin .3s,opacity .3s}
.eac-bc-more a:hover::after{margin-left:5px;opacity:1}
@media(min-width:640px){.eac-bc{flex-direction:row}.eac-bc .eac-bc-meta{flex-basis:40%;height:auto;min-height:220px}.eac-bc .eac-bc-desc{flex-basis:60%}.eac-bc .eac-bc-desc::before{transform:skewX(-3deg);content:"";background:var(--eac-surface-bg-soft,#050505);width:30px;position:absolute;left:-10px;top:0;bottom:0;z-index:-1}.eac-bc-alt{flex-direction:row-reverse}.eac-bc-alt .eac-bc-desc::before{left:inherit;right:-10px;transform:skew(3deg)}.eac-bc-alt .eac-bc-details{padding-left:25px}}
@media(prefers-reduced-motion:reduce){.eac-bc-photo,.eac-bc-details,.eac-bc-more a::after{transition:none}}
`;

function formatBlogDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BlogCards({
  items,
  orgName,
}: {
  items: OrgFeedItem[];
  orgName: string;
}) {
  if (items.length === 0) {
    return <EmptyEmbed>No blog posts have been published yet.</EmptyEmbed>;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BLOG_CARDS_CSS }} />
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`eac-bc${i % 2 !== 0 ? " eac-bc-alt" : ""}`}
        >
          <div className="eac-bc-meta">
            <div className="eac-bc-photo" />
            <div className="eac-bc-nophoto" aria-hidden="true">
              {orgName.slice(0, 4).toUpperCase()}
            </div>
            <ul className="eac-bc-details">
              {formatBlogDate(item.published_at) && (
                <li>
                  <span className="eac-bc-dlabel">Date</span>{" "}
                  {formatBlogDate(item.published_at)}
                </li>
              )}
              {item.kind && (
                <li>
                  <span className="eac-bc-dlabel">Type</span>{" "}
                  {item.kind}
                </li>
              )}
            </ul>
          </div>
          <div className="eac-bc-desc">
            <h3>
              <a href={`/${item.slug}`}>{item.title}</a>
            </h3>
            {item.excerpt && <p className="eac-bc-excerpt">{item.excerpt}</p>}
            <p className="eac-bc-more">
              <a href={`/${item.slug}`}>Read More</a>
            </p>
          </div>
        </div>
      ))}
    </>
  );
}

async function BlogCardsEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 4);
  const items = (await getOrgFeed(org.id, 20))
    .filter((t) => t.kind === "post")
    .slice(0, limit);
  return maybeWrap(
    attrs,
    <BlogCards items={items} orgName={org.name} />,
    { eyebrow: org.name, title: attrs["data-title"] || "Blog" }
  );
}

async function OrgFeedEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 4);
  const items = await getOrgFeed(org.id, limit);
  const layout = feedLayout(attrs);
  const content =
    layout === "cards" ? (
      <OrgFeedCards items={items} />
    ) : items.length === 0 ? (
      <EmptyEmbed>No public updates have been published yet.</EmptyEmbed>
    ) : (
      <FeedPen
        openLayout={layout}
        rows={items.map((item) => ({
          id: item.id,
          title: item.title,
          kicker: item.kind,
          summary: item.excerpt,
          meta: [item.author_name, formatDate(item.scheduled_at ?? item.published_at)]
            .filter(Boolean)
            .join(" \u00b7 ") || null,
          detail: plainText(item.body) ?? item.excerpt,
          avatar: item.author_avatar,
        }))}
      />
    );
  return maybeWrap(attrs, content, {
    eyebrow: org.name,
    title: attrs["data-title"] || "Latest updates",
  });
}

async function WorkshopCardsEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 3);
  const items = (await getOrgFeed(org.id, 20))
    .filter((t) => t.kind === "workshop" || isSessionLike(t))
    .slice(0, limit);
  return maybeWrap(
    attrs,
    <WorkshopCards items={items} orgSlug={org.slug} />,
    { eyebrow: org.name, title: attrs["data-title"] || "Workshop sessions" }
  );
}

async function RsvpEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 3);
  const sessions = (await getOrgFeed(org.id, 20)).filter(isSessionLike).slice(0, limit);
  const content = (
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          {sessions.length > 0 ? (
            <OrgFeedCards items={sessions} />
          ) : (
            <EmptyEmbed>No upcoming RSVP sessions are published yet.</EmptyEmbed>
          )}
        </div>
        <a
          href={`/login?mode=signup&org=${encodeURIComponent(org.slug)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Join or RSVP
        </a>
      </div>
  );
  return maybeWrap(attrs, content, {
    eyebrow: "RSVP",
    title: attrs["data-title"] || "Reserve your place",
  });
}

async function CommunityFeedEmbed({ attrs }: { attrs: EmbedAttrs }) {
  const limit = normalizeLimit(attrs["data-limit"], 4);
  const items = await getCommunityFeed(limit);
  const layout = feedLayout(attrs);
  const content =
    items.length === 0 ? (
      <EmptyEmbed>The community feed is quiet right now.</EmptyEmbed>
    ) : layout !== "cards" ? (
      <FeedPen
        openLayout={layout}
        rows={items.map((item) => ({
          id: item.id,
          title: item.title,
          kicker: item.kind,
          summary: item.excerpt,
          meta: [item.authorName, item.orgName].filter(Boolean).join(" \u00b7 ") || null,
          detail: plainText(item.body) ?? item.excerpt,
          avatar: item.authorAvatar,
        }))}
      />
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-border bg-card p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>{item.kind}</span>
              <span>{item.orgName}</span>
            </div>
            <h3 className="font-serif text-xl leading-snug">{item.title}</h3>
            {item.excerpt && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.excerpt}
              </p>
            )}
          </article>
        ))}
      </div>
    );
  return maybeWrap(attrs, content, {
    eyebrow: "Network",
    title: attrs["data-title"] || "Across the network",
  });
}

function PollEmbed({ attrs }: { attrs: EmbedAttrs }) {
  const options = parseList(attrs["data-options"], [
    "Morning session",
    "Evening session",
    "Weekend intensive",
  ]);
  const content = (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>Poll</span>
        <span>{attrs["data-poll-type"] || "Single choice"}</span>
      </div>
      <h3 className="font-serif text-xl leading-snug">
        {attrs["data-question"] || "What should we offer next?"}
      </h3>
      {attrs["data-description"] && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {attrs["data-description"]}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {options.map((option, index) => (
          <div
            key={option}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <span>{option}</span>
            <span className="text-xs text-muted-foreground">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return maybeWrap(attrs, content, {
    eyebrow: "Poll",
    title: attrs["data-title"] || "Community pulse",
  });
}

async function CountdownEmbed({ org, attrs }: { org: OrgSummary; attrs: EmbedAttrs }) {
  const nextSession = (await getOrgFeed(org.id, 20)).find(isSessionLike);
  const date = formatDate(nextSession?.scheduled_at ?? null);
  const content = (
    <div className="rounded-md border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Next gathering
      </p>
      <h3 className="mt-2 font-serif text-2xl leading-tight">
        {nextSession?.title || attrs["data-title"] || "Next session soon"}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {parseList(attrs["data-stats"], [date || "Date TBA", "RSVP open", org.name]).map((item) => (
          <div key={item} className="rounded-md border border-border bg-background p-3 text-sm font-medium">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
  return maybeWrap(attrs, content, {
    eyebrow: org.name,
    title: attrs["data-title"] || "Countdown",
  });
}

async function LiveEmbed({ org, attrs }: { org: OrgSummary; attrs: EmbedAttrs }) {
  const nextSession = (await getOrgFeed(org.id, 20)).find(isSessionLike);
  const content = (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Live channel
          </p>
          <h3 className="mt-2 font-serif text-2xl leading-tight">
            {attrs["data-title"] || nextSession?.title || "Gathering room"}
          </h3>
        </div>
        <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium uppercase tracking-wider">
          {attrs["data-status"] || "Upcoming"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {attrs["data-description"] || "Use this area for live sessions, replays, or a Nextcloud Talk room handoff."}
      </p>
    </div>
  );
  return maybeWrap(attrs, content, {
    eyebrow: org.name,
    title: attrs["data-title"] || "Live gathering",
  });
}

function ResourcesEmbed({ attrs }: { attrs: EmbedAttrs }) {
  const items = parseList(attrs["data-items"], [
    "Preparation notes",
    "Session recording",
    "Shared document",
  ]);
  const content = (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item} className="flex items-center justify-between rounded-md border border-border bg-card p-4 text-sm">
          <span className="font-medium">{item}</span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Resource</span>
        </div>
      ))}
    </div>
  );
  return maybeWrap(attrs, content, {
    eyebrow: "Library",
    title: attrs["data-title"] || "Resources",
  });
}

function InquiryEmbed({ org, attrs }: { org: OrgSummary; attrs: EmbedAttrs }) {
  const content = (
    <InquiryForm orgSlug={org.slug} title={attrs["data-title"] || "Send your inquiry"} />
  );
  return maybeWrap(attrs, content, {
    eyebrow: "Contact",
    title: attrs["data-title"] || "Get in touch",
  });
}

/**
 * Sign-in state for this org, rendered server-side.
 *
 * A published Silex page is static HTML in Nextcloud, so it cannot know who is
 * looking at it. This embed is the seam: the session is read on the server at
 * request time, which means no auth flash, no client bundle, and the page still
 * works with JavaScript disabled.
 */
async function LoginEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const { getServerSession } = await import("@elkdonis/auth-server");
  const session = await getServerSession().catch(() => ({ user: null }));
  const user = session.user;
  const orgParam = encodeURIComponent(org.slug);

  const content = user ? (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Signed in
        </p>
        <p className="truncate text-sm font-medium text-foreground">
          {user.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href="/account"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Account
        </a>
        <a
          href="/api/auth/logout"
          className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Sign out
        </a>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card p-5">
      <p className="min-w-0 text-sm text-muted-foreground">
        {attrs["data-description"] ||
          `Sign in to RSVP, comment, and see member updates from ${org.name}.`}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`/login?org=${orgParam}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Sign in
        </a>
        <a
          href={`/login?mode=signup&org=${orgParam}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Join
        </a>
      </div>
    </div>
  );

  return maybeWrap(attrs, content, {
    eyebrow: "Members",
    title: attrs["data-title"] || (user ? "Your account" : "Members"),
  });
}

/**
 * Media upload for org members.
 *
 * Three states, decided on the server: signed out, signed in but not a member,
 * and permitted. Only the last one ships the client widget. The upload route
 * repeats both checks — this gate controls what is shown, not what is allowed.
 */
async function MediaUploadEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const shell = {
    eyebrow: "Media",
    title: attrs["data-title"] || "Upload media",
  };

  const { getServerSession } = await import("@elkdonis/auth-server");
  const session = await getServerSession().catch(() => ({ user: null }));
  const user = session.user;

  if (!user) {
    return maybeWrap(
      attrs,
      <EmptyEmbed>
        <a
          href={`/login?org=${encodeURIComponent(org.slug)}`}
          className="underline underline-offset-4"
        >
          Sign in
        </a>{" "}
        to add photos or video to {org.name}.
      </EmptyEmbed>,
      shell
    );
  }

  const { hasOrgRole } = await import("@elkdonis/services");
  const userId = user.db_user_id ?? user.id;
  const permitted = await hasOrgRole(userId, org.id, [
    "owner",
    "guide",
    "member",
  ]).catch(() => false);

  if (!permitted) {
    return maybeWrap(
      attrs,
      <EmptyEmbed>
        Uploading is open to members of {org.name}. Ask an organiser to add you.
      </EmptyEmbed>,
      shell
    );
  }

  return maybeWrap(
    attrs,
    <MediaUploadWidget
      orgSlug={org.slug}
      accept={attrs["data-accept"] || "image/*,video/*"}
    />,
    shell
  );
}

/**
 * The people published on this org, read live from org_profiles.
 *
 * This is the block that makes a visual page builder viable for a directory:
 * hand-placing artist cards would fork the roster away from the database the
 * moment someone joins. Here, adding a member is a row — every page carrying
 * this embed updates, portrait included.
 *
 * `onlyPublic` matters: signup drafts an org_profile for everyone who joins,
 * so an unfiltered list would expose people the org has not chosen to publish.
 */
async function DirectoryEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const { listOrgProfiles } = await import("@elkdonis/services");
  const limit = normalizeLimit(attrs["data-limit"], 8);
  const tags = parseList(attrs["data-tags"], []);

  const people = await listOrgProfiles(org.id, {
    onlyPublic: true,
    tags: tags.length ? tags : undefined,
  }).catch(() => []);

  const shown = people.slice(0, limit);

  const content =
    shown.length === 0 ? (
      <EmptyEmbed>No one has been published to this directory yet.</EmptyEmbed>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {shown.map((p) => (
          <article
            key={p.userId}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-4"
          >
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-sm text-muted-foreground">
                {(p.displayName || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {p.slug ? (
                  <a className="hover:underline" href={`/${p.slug}`}>
                    {p.displayName}
                  </a>
                ) : (
                  p.displayName
                )}
              </p>
              {p.roleTitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {p.roleTitle}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    );

  return maybeWrap(attrs, content, {
    eyebrow: "Directory",
    title: attrs["data-title"] || "Members",
  });
}

async function renderEmbed(attrs: EmbedAttrs, org: OrgSummary, key: string) {
  const component = attrs["data-eac-component"];
  if (component === "blog-cards-overlay") {
    return <BlogCardsOverlayEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "blog-cards") {
    return <BlogCardsEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "workshop-cards") {
    return <WorkshopCardsEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "inquiry") {
    return <InquiryEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "rsvp") {
    return <RsvpEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "community-feed") {
    return <CommunityFeedEmbed key={key} attrs={attrs} />;
  }
  if (component === "poll") {
    return <PollEmbed key={key} attrs={attrs} />;
  }
  if (component === "countdown") {
    return <CountdownEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "live") {
    return <LiveEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "resources") {
    return <ResourcesEmbed key={key} attrs={attrs} />;
  }
  if (component === "login") {
    return <LoginEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "media-upload") {
    return <MediaUploadEmbed key={key} org={org} attrs={attrs} />;
  }
  if (component === "directory") {
    return <DirectoryEmbed key={key} org={org} attrs={attrs} />;
  }
  return <OrgFeedEmbed key={key} org={org} attrs={attrs} />;
}

export async function renderSilexHtmlWithEmbeds(html: string, org: OrgSummary) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  EMBED_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMBED_RE.exec(html))) {
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(<HtmlSegment key={`html-${index}`} html={html.slice(cursor, start)} />);
    }

    const attrs = parseAttrs(match[1] ?? match[3] ?? "");
    nodes.push(await renderEmbed(attrs, org, `embed-${index}`));
    cursor = start + match[0].length;
    index += 1;
  }

  if (cursor < html.length) {
    nodes.push(<HtmlSegment key={`html-${index}`} html={html.slice(cursor)} />);
  }

  if (nodes.length === 0) return <HtmlSegment html={html} />;
  return nodes;
}
