import {
  PERSONAL_ORG_ID,
  getPersonPage,
  listOrgHomes,
  listPersonThreads,
  listProfileOrgs,
  listUserGalleries,
  listWriting,
  personThreadHref,
  servicePriceLabel,
  type OrgHome,
  type PersonThread,
} from "@elkdonis/services";
import { getStoreForUser, getStoreShowcaseForUser } from "@elkdonis/commerce/queries";
import { marketplaceLinks } from "@elkdonis/commerce/links";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Artwork } from "@elkdonis/commerce/types";
import type { OfferingRecord, PersonBlockContext, PersonBlockSection } from "../person-context";

// ============================================================================
// Loading a person page for the person blocks — the server half of
// ../person-context.ts.
//
// One read of everything a person page shows, in the shape the blocks draw,
// passed to Puck as `metadata.person` by the host (published render and
// editor alike). The rules are getPersonPage's (@elkdonis/services): drafts
// and switched-off sections reach the person themselves (and global admins)
// only, through `viewerId`, which the host takes from the session.
//
// Links are the host's to decide (where writing reads, where a gallery
// lives), so they are passed in. `offerings` — what a spotlight or card may
// be filled from — are public records only, whoever is viewing: a featured
// page is a public page, and a draft chosen in the editor must not appear on it.
// ============================================================================

export interface LoadPersonBlockContextOptions {
  /** The signed-in viewer, from the session. Drafts show only to the person or an admin. */
  viewerId?: string | null;
  /** The network hub, for links to a post's home site. */
  networkUrl: string;
  /** The marketplace, for store and artwork links. */
  marketplaceUrl: string;
  /** Sent to the marketplace as `from`, so it can send a visitor back. */
  from: string;
  /** Where a person's writing reads: `${writingBase}/${pieceSlug}`. */
  writingBase: (personKey: string) => string;
  /** Where one of their galleries lives. */
  galleryHref: (personKey: string, gallerySlug: string) => string;
  /** How many listed pieces the store section shows. Default 6, as the plain page. */
  storeLimit?: number;
  /**
   * Where a service homed on the personal org (ArtDirect's `oad`) is booked,
   * e.g. `/<personKey>/services/<slug>`. Services homed on an org link to
   * that org's site. Omitted, every service links to its home site.
   */
  serviceHref?: (personKey: string, serviceSlug: string) => string;
}

/** Thread kinds a spotlight can promote besides writing: things a visitor can attend or book. */
const OFFERING_THREAD_KINDS = ["event", "meeting", "workshop", "reading_group", "service", "offering", "class", "course"];

const BOOKED_KINDS = new Set(["workshop", "service", "offering", "class", "course"]);

function day(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function threadItem(t: PersonThread, when: string | null, networkUrl: string) {
  return {
    href: personThreadHref(t, { networkUrl }),
    title: t.title,
    meta: [when, t.location, `on ${t.orgName}`].filter(Boolean).join(" · "),
    excerpt: t.excerpt,
    external: true,
    draft: t.status !== "published",
  };
}

/** A service's line: price, then where it is from. */
function serviceMeta(t: PersonThread): string {
  return [servicePriceLabel(t), `on ${t.orgName}`].filter(Boolean).join(" · ");
}

function priceOf(a: Artwork): string | null {
  const v = a.variants?.find((x) => x.priceMinor > 0);
  return v ? formatMoney(v.priceMinor, v.currency) : null;
}

/**
 * Everything the person blocks draw for one person, or null when there is no
 * such person. The host decides beforehand whether the viewer may see the
 * page at all (ArtDirect's `directory_listed` rule); this does not repeat it.
 */
export async function loadPersonBlockContext(
  slug: string,
  opts: LoadPersonBlockContextOptions
): Promise<PersonBlockContext | null> {
  const viewerId = opts.viewerId ?? null;
  const page = await getPersonPage(slug, { orgId: PERSONAL_ORG_ID, viewerId });
  if (!page) return null;
  const { profile } = page;
  const uid = profile.userId;
  const key = profile.slug ?? uid;

  const [memberships, homes, ownStore, events, writing, galleries] = await Promise.all([
    listProfileOrgs(uid, { onlyPublic: true }).catch(() => []),
    listOrgHomes().catch(() => [] as OrgHome[]),
    getStoreForUser(uid).catch(() => null),
    listPersonThreads(uid, { orgId: PERSONAL_ORG_ID, viewerId: null, kinds: OFFERING_THREAD_KINDS, order: "scheduled", limit: 50 }),
    listWriting(uid, { limit: 50 }),
    listUserGalleries(uid, { onlyPublic: true }).catch(() => []),
  ]);

  // The store: shown on the page when active and switched on (as the plain
  // page); offered to a spotlight whenever it is active.
  const active = ownStore?.status === "active";
  const showcase = active
    ? await getStoreShowcaseForUser(uid, { limit: Math.max(opts.storeLimit ?? 6, 24) }).catch(() => null)
    : null;
  const links = marketplaceLinks(opts.marketplaceUrl, { from: opts.from });

  const homeByOrgId = new Map(
    homes.map((h) => [
      h.orgId,
      h.primaryDomain ? `https://${h.primaryDomain}` : `${opts.networkUrl.replace(/\/$/, "")}/sites/${h.orgSlug}`,
    ])
  );

  const hrefOf = (t: PersonThread) =>
    t.kind === "service" && t.orgId === PERSONAL_ORG_ID && opts.serviceHref
      ? opts.serviceHref(key, t.slug)
      : personThreadHref(t, { networkUrl: opts.networkUrl });

  const offerings: OfferingRecord[] = [
    ...(showcase?.artworks ?? []).map((a) => ({
      ref: `artwork:${a.id}`,
      kind: "artwork",
      title: a.title,
      href: links.artwork(a.id),
      image: a.primaryImageUrl ?? null,
      kicker: a.status === "reserved" ? "Reserved" : "For sale",
      excerpt: null,
      meta: [a.yearCreated ? String(a.yearCreated) : null, a.medium, priceOf(a)].filter(Boolean).join(" · ") || null,
      action: a.status === "reserved" ? "View" : "Buy",
    })),
    ...events.map((t) => ({
      ref: `thread:${t.id}`,
      kind: t.kind.replace(/_/g, " "),
      title: t.title,
      href: hrefOf(t),
      image: t.coverImageUrl,
      kicker: null,
      excerpt: t.excerpt,
      meta:
        (t.kind === "service"
          ? servicePriceLabel(t)
          : [day(t.scheduledAt), t.location].filter(Boolean).join(" · ")) || null,
      action: BOOKED_KINDS.has(t.kind) ? "Book" : "RSVP",
    })),
    ...writing.map((w) => ({
      ref: `writing:${w.id}`,
      kind: "writing",
      title: w.title,
      href: `${opts.writingBase(key)}/${w.slug}`,
      image: w.coverImageUrl,
      kicker: null,
      excerpt: w.lede,
      meta: [day(w.publishedAt), w.readingMinutes ? `${w.readingMinutes} min read` : null].filter(Boolean).join(" · ") || null,
      action: "Read",
    })),
    ...galleries.map((g) => ({
      ref: `gallery:${g.id}`,
      kind: "gallery",
      title: g.title,
      href: opts.galleryHref(key, g.slug),
      image: g.coverUrl,
      kicker: null,
      excerpt: g.description,
      meta: g.itemCount ? `${g.itemCount} ${g.itemCount === 1 ? "work" : "works"}` : null,
      action: "View",
    })),
  ];

  const sections = Object.fromEntries(page.sections.map((s) => [s.key, s.on])) as Partial<
    Record<PersonBlockSection, boolean>
  >;

  return {
    userId: uid,
    slug: key,
    canEdit: page.canEdit,
    person: {
      displayName: profile.displayName,
      role: profile.headline ?? null,
      bio: profile.bio ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      city: profile.city ?? null,
      verified: Boolean(profile.verified),
      socialLinks: (profile.socialLinks ?? []).map((l) => ({ label: l.label ?? null, url: l.url })),
    },
    sections,
    portfolio: page.portfolio.map((item, i) => ({
      id: item.id ?? `${key}-${i}`,
      url: item.url,
      title: item.title ?? "",
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })),
    galleries: page.galleries.map((g) => ({
      href: opts.galleryHref(key, g.slug),
      title: g.title,
      coverUrl: g.coverUrl,
      meta: g.itemCount ? `${g.itemCount} ${g.itemCount === 1 ? "work" : "works"}` : null,
      draft: !g.isPublic,
    })),
    writing: page.writing,
    writingBase: opts.writingBase(key),
    posts: page.posts.map((t) => threadItem(t, day(t.publishedAt), opts.networkUrl)),
    events: page.events.map((t) => threadItem(t, day(t.scheduledAt), opts.networkUrl)),
    services: page.services.map((t) => ({
      ...threadItem(t, null, opts.networkUrl),
      href: hrefOf(t),
      meta: serviceMeta(t),
      external: hrefOf(t).startsWith("http"),
    })),
    memberships: memberships
      .filter((o) => o.orgId !== PERSONAL_ORG_ID)
      .map((o) => ({
        name: o.orgName,
        href: homeByOrgId.get(o.orgId) ?? `${opts.networkUrl.replace(/\/$/, "")}/sites/${o.orgSlug}`,
        role: o.roleTitle ?? null,
      })),
    store:
      showcase && page.show.store
        ? {
            store: showcase.store,
            artworks: showcase.artworks.slice(0, opts.storeLimit ?? 6),
            marketplaceUrl: opts.marketplaceUrl,
            from: opts.from,
          }
        : null,
    offerings,
  };
}
