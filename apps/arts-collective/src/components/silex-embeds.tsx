import type { ReactNode } from "react";
import { getCommunityFeed } from "@/lib/community-feed";
import { getOrgFeed, type OrgFeedItem, type OrgSummary } from "@/lib/org";

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

async function OrgFeedEmbed({
  org,
  attrs,
}: {
  org: OrgSummary;
  attrs: EmbedAttrs;
}) {
  const limit = normalizeLimit(attrs["data-limit"], 4);
  const items = await getOrgFeed(org.id, limit);
  return maybeWrap(
    attrs,
    <OrgFeedCards items={items} />,
    { eyebrow: org.name, title: attrs["data-title"] || "Latest updates" }
  );
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
  const content =
    items.length === 0 ? (
      <EmptyEmbed>The community feed is quiet right now.</EmptyEmbed>
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

async function renderEmbed(attrs: EmbedAttrs, org: OrgSummary, key: string) {
  const component = attrs["data-eac-component"];
  if (component === "workshop-cards") {
    return <WorkshopCardsEmbed key={key} org={org} attrs={attrs} />;
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