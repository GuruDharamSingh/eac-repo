import type { ReactNode } from "react";
import { listOrgPeople } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getOrgFeed, type OrgFeedItem } from "@/lib/org";
import type { SiteContext } from "@/lib/site-context";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { loadCards } from "@/lib/cards/store";
import { feedItem } from "@/lib/cards/catalog";
import { FeedCards } from "@/components/cards/FeedCards";

/**
 * The landing page an org gets before it has designed one or published
 * anything: a page built from its identity rather than "Nothing published
 * yet". Name, headline, logo, place; the statement; the offering card when
 * there is one; what's on; the people; the links. The same facts `/profile`
 * shows, arranged as a front page.
 *
 * Editors keep their prompt (post from the hub, or design the page) in a
 * band of their own; visitors never see it.
 */
const KIND_LABEL: Record<string, string> = {
  post: "Essay",
  meeting: "Gathering",
  event: "Event",
  service: "Offering",
  workshop: "Workshop",
  series: "Series",
};

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Kicker({ children }: { children: ReactNode }) {
  return <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">{children}</h2>;
}

export async function OrgDefaultPage({
  ctx,
  offering,
}: {
  ctx: SiteContext;
  /** The org's featured item, when one exists; drawn as a card rather than a page. */
  offering: OrgFeedItem | null;
}) {
  const { org, identity, user, canEdit, mainSiteUrl } = ctx;
  // Pass 3: an org that designed its feed cards (/hub/sites/<slug>/cards) gets "What's on" drawn with them.
  const cards = await loadCards(org.id);
  const [feed, roster] = await Promise.all([
    getOrgFeed(org.id, Math.max(6, (cards?.limit ?? 6) + 1)),
    listOrgPeople(org.id).catch(() => []),
  ]);
  const recent = feed.filter((t) => t.id !== offering?.id);
  const people = roster.filter((p) => p.role !== "viewer");
  const place = [identity?.city, identity?.region, identity?.country].filter(Boolean).join(", ");
  const bio = identity?.bio?.trim() || org.description?.trim() || null;
  const designHref = `${ctx.proto}://${ctx.rootHost}/hub/sites/${encodeURIComponent(org.slug)}/design`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeStyle orgId={org.id} pageKey="home" />
      <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} signedIn={Boolean(user)} />

      <main className="mx-auto max-w-3xl px-6 py-12" data-page="org-default">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {org.tier === "partner" ? "Partner organisation" : org.tier === "supported" ? "Supported organisation" : "Organisation"}
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">{org.name}</h1>
            {identity?.headline && <p className="mt-2 text-lg text-muted-foreground">{identity.headline}</p>}
            {place && (
              <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">{place}</p>
            )}
          </div>
          {identity?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.avatarUrl}
              alt=""
              className="h-28 w-28 shrink-0 rounded-md border border-border object-cover"
            />
          )}
        </header>

        {canEdit && (
          <aside className="mt-6 rounded-lg border border-dashed border-border bg-card p-4 text-sm" data-editor-band>
            <p className="text-muted-foreground">
              {offering
                ? "This is your default landing page. Pin a post, event or service from your hub to lead with it, or design the page yourself."
                : "Nothing published yet. Post from your hub and it will appear here as your offering, or design the page yourself."}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <a href={ctx.hubUrl} className="underline underline-offset-4">Go to your hub →</a>
              <a href={designHref} className="underline underline-offset-4">Design this page →</a>
              <a href={designHref.replace(/\/design$/, "/classifieds")} className="underline underline-offset-4">Make a classifieds page →</a>
              <a href={designHref.replace(/\/design$/, "/cards")} className="underline underline-offset-4">Design the feed cards →</a>
            </p>
          </aside>
        )}

        {bio && (
          <section className="mt-10">
            <Kicker>About</Kicker>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed">{bio}</p>
          </section>
        )}

        {offering && (
          <section className="mt-10">
            <Kicker>{offering.pinned ? "Featured" : "Now"}</Kicker>
            <article className="mt-3 rounded-lg border border-border bg-card p-6">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {KIND_LABEL[offering.kind] ?? offering.kind}
              </p>
              <h3 className="mt-2 font-serif text-3xl leading-tight">
                <a href={offering.slug ? `/${offering.slug}` : "/offering"} className="hover:underline underline-offset-4">
                  {offering.title}
                </a>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {[when(offering.scheduled_at), offering.location].filter(Boolean).join(" · ")}
              </p>
              {offering.excerpt && <p className="mt-4 text-base leading-relaxed">{offering.excerpt}</p>}
            </article>
          </section>
        )}

        <section className="mt-10">
          <Kicker>What&rsquo;s on</Kicker>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {offering ? "Nothing else published just now." : canEdit ? "Nothing published yet." : "Nothing on just now. Check back soon."}
            </p>
          ) : cards ? (
            <div className="mt-3">
              <FeedCards doc={cards} items={recent.map((t) => feedItem(t))} heading={false} />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {recent.map((t) => (
                <li key={t.id} className="py-3">
                  <a href={t.slug ? `/${t.slug}` : "#"} className="block hover:opacity-80">
                    <span className="block font-serif text-lg">{t.title}</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {KIND_LABEL[t.kind] ?? t.kind}
                      {t.scheduled_at && ` · ${new Date(t.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <Kicker>People</Kicker>
          {people.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No members listed.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {people.map((p) => (
                <li key={p.userId} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
                  {p.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  )}
                  <span>{p.displayName ?? "A member"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <Kicker>Links</Kicker>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li><a href="/profile" className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent">About {org.name}</a></li>
            <li><a href="/community" className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent">Community</a></li>
            {user && <li><a href="/center" className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent">Center</a></li>}
            {identity?.socialLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener" className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent">
                  {l.label ?? l.url.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
