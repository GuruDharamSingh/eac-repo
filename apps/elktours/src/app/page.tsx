import Link from "next/link";
import { TourCard } from "@/components/tours/tour-card";
import { getGuides, getSiteSections } from "@/lib/data";
import { listTours, nextDepartures } from "@/lib/tours";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { loadPage } from "@/lib/puck/store";
import { LANDING_SLUG } from "@/lib/puck/landing";
import { RESOLVED_KEYS } from "@/lib/puck/resolved";
import { EditPageButton } from "@/components/landing/EditPageButton";

/** What each stored block's resolver drew (a person, an Opens, a Card's record), by node id, for the editor: it draws them without asking again. Never saved. */
function resolvedByNode(list: unknown, out: Record<string, Record<string, unknown>> = {}) {
  if (!Array.isArray(list)) return out;
  for (const n of list as Array<{ type?: string; props?: Record<string, unknown> }>) {
    if (!n?.props) continue;
    const keys = typeof n.type === "string" && Object.prototype.hasOwnProperty.call(RESOLVED_KEYS, n.type) ? RESOLVED_KEYS[n.type] : [];
    const got = Object.fromEntries(keys.filter((k) => n.props![k] != null).map((k) => [k, n.props![k]]));
    if (typeof n.props.id === "string" && Object.keys(got).length) out[n.props.id] = got;
    for (const v of Object.values(n.props)) if (Array.isArray(v)) resolvedByNode(v, out);
  }
  return out;
}

/**
 * Landing page: the featured tour (pinned, else the newest), the rest of the
 * tours, how booking works, and the guides. Copy for the hero and the
 * "how it works" band comes from org_site_sections (/manage/pages) with
 * defaults here.
 *
 * Owners and guides can edit it in place with the direct editor (2026-11-03, pilot). Until
 * that is saved it draws from this code. After saving, `puck:landing` is the page: the words
 * stop following /manage/pages, and the parts below stay live. "Restore" returns to this code.
 */
export default async function HomePage() {
  const [tours, guides, sections, viewer, tree] = await Promise.all([
    listTours(),
    getGuides().catch(() => []),
    getSiteSections(),
    getViewer().catch(() => null),
    loadPage(LANDING_SLUG, new Set(Object.keys(serverPuckConfig.components))),
  ]);
  const next = await nextDepartures(tours.map((t) => t.id));
  const [lead, ...rest] = tours;
  const hero = sections.hero ?? {};

  // The parts that stay live when the page is edited as a tree of boxes: they follow the
  // tours and guides. Each root element carries its name, so the editor leaves it alone
  // and the stored tree draws it from here.
  const parts = {
    "hero-backdrop": (lead?.film || lead?.coverImageUrl) ? (
      <div className="absolute inset-0 -z-10" data-landing-part="hero-backdrop" data-edit-name="Lead tour's film or picture">
        {lead.film ? (
          <video
            src={lead.film.url720 ?? lead.film.url}
            poster={lead.film.poster ?? lead.coverImageUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.coverImageUrl!} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        {/* Cropped Google 3D tiles: repeat the credit the film carries at its edges. */}
        {lead.film && (
          <span className="absolute bottom-2 right-3 text-[0.65rem] text-muted-foreground">Imagery: Google · For promotional purposes only</span>
        )}
      </div>
    ) : null,
    "hero-actions": (
      <div className="mt-8 flex flex-wrap gap-3" data-landing-part="hero-actions" data-edit-name="Tour buttons">
        <Link href="/tours" className="bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">See the tours</Link>
        {lead && (
          <Link href={`/tours/${lead.slug}`} className="border border-border bg-background/80 px-5 py-3 text-sm backdrop-blur">
            {lead.title}
          </Link>
        )}
      </div>
    ),
    "tour-cards": (
      <div data-landing-part="tour-cards" data-edit-name="Tour cards">
        {tours.length === 0 ? (
          <p className="mt-6 text-muted-foreground">The first tours are being written.</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[lead!, ...rest].slice(0, 6).map((t) => (
              <TourCard key={t.id} tour={t} next={next.get(t.id)} />
            ))}
          </div>
        )}
      </div>
    ),
    guides: (
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-landing-part="guides" data-edit-name="Guides">
        {guides.map((g) => (
          <li key={g.userId} className="flex gap-4">
            {g.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.photoUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="size-16 shrink-0 rounded-full bg-muted" />
            )}
            <div>
              <p className="font-medium">{g.displayName}</p>
              {g.roleTitle && <p className="text-sm text-muted-foreground">{g.roleTitle}</p>}
              {g.bio && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{g.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    ),
  };

  // Once the page has been saved as a tree, the tree is the page.
  if (tree) {
    const metadata = { orgId: siteConfig.orgId, slug: LANDING_SLUG, parts };
    const filled = await resolveAllData(tree.data as Data, serverPuckConfig, metadata);
    return (
      <div className="elk-landing">
        <Render config={serverPuckConfig} data={filled as Data} metadata={metadata} />
        {viewer?.canEdit && <EditPageButton tree={tree.data as PuckDoc} resolved={resolvedByNode(filled.content)} />}
      </div>
    );
  }

  return (
    <div className="elk-landing">
      <section className="relative overflow-hidden" data-edit-section="hero" data-edit-name="Opening">
        {parts["hero-backdrop"]}
        <div className="mx-auto max-w-6xl px-5 pt-28 pb-16 sm:pt-40">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
            {hero.title ?? "Walk Paris with someone who lives here."}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {hero.body ?? "Small groups, unhurried routes, places the guidebooks skip. Choose a tour, pick a date, and you are booked."}
          </p>
          {parts["hero-actions"]}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" data-edit-section="tours" data-edit-name="Tours">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-3xl">Tours</h2>
          <Link href="/tours" className="text-sm underline underline-offset-4">All tours</Link>
        </div>
        {parts["tour-cards"]}
      </section>

      <section className="border-y border-border bg-card" data-edit-section="how" data-edit-name="How it works">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
          {[
            ["Choose", "Every tour page shows the route, stop by stop, with a map and street-level views so you know what to expect."],
            ["Book", "Pick a date, say how many you are, and pay by card. Your ticket is a link in your email; no account needed."],
            ["Meet", "Your guide is at the meeting point at the time on your ticket. Rain or shine; the pace is yours."],
          ].map(([title, body], i) => (
            <div key={title}>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">0{i + 1}</p>
              <h3 className="mt-2 font-serif text-2xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {guides.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16" data-edit-section="guides" data-edit-name="Your guides">
          <h2 className="font-serif text-3xl">Your guides</h2>
          {parts.guides}
        </section>
      )}
      {viewer?.canEdit && <EditPageButton tree={null} />}
    </div>
  );
}
