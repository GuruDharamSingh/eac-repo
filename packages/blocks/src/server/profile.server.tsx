import {
  getAuthoredThreads,
  listUserGalleries,
  getUserGallery,
  getUserGalleryById,
  getUserGalleryByPage,
  listOrgHomes,
  WRITING_KIND,
  SCHEDULED_KINDS,
  type AuthoredThread,
  type OrgHome,
} from "@elkdonis/services";
import { ProfileFeed, type ProfileFeedProps, type ProfileFeedSource } from "../blocks/profile-feed";
import type { ThreadFeedItem } from "../blocks/thread-feed";
import {
  ProfileGalleries,
  type ProfileGalleriesProps,
  type ProfileGalleryItem,
} from "../blocks/profile-galleries";
import { ProfileGallery, type ProfileGalleryProps } from "../blocks/profile-gallery";
import { ProfileStore, type ProfileStoreProps } from "../blocks/profile-store";
import type { RowValue } from "../types";
import { getStoreShowcaseForUser, hasProfileSection } from "@elkdonis/commerce/queries";

// ============================================================================
// The fetching halves of the profile blocks.
//
// Behind the "@elkdonis/blocks/server" entry point, like loadThreadFeed, so
// that importing a profile block to DISPLAY it never pulls @elkdonis/db into
// the graph.
//
// ── The rule these loaders must not break ───────────────────────────────────
//
// Draft visibility is not a boolean here either. `viewerId` unlocks drafts
// only by MATCHING the profile's own user id — that check lives in
// getAuthoredThreads and these loaders simply pass the value through, so there
// is no second place for it to be got wrong.
// ============================================================================

const WRITING_KINDS = ["post", WRITING_KIND] as const;

export interface LoadProfileFeedOptions {
  source?: ProfileFeedSource;
  limit?: number;
  /** Set to the signed-in user. Drafts appear only when it equals `userId`. */
  viewerId?: string;
  /** Restrict to one org — "their posts on amrit-canada" rather than all of them. */
  orgId?: string;
  /**
   * Where a row links to. The default sends a reader to the org that published
   * it, on that org's own domain where it has one — a profile is an index,
   * and an index that keeps you on the index is not doing its job.
   */
  href?: (row: AuthoredThread, orgHome: string | null) => string;
}

function orgBases(homes: OrgHome[], networkUrl: string): Map<string, string> {
  return new Map(
    homes.map((h) => [
      h.orgId,
      h.primaryDomain ? `https://${h.primaryDomain}` : `${networkUrl}/sites/${h.orgSlug}`,
    ])
  );
}

/**
 * One person's threads, as feed items.
 *
 * `source` decides both the kinds and the ordering, because the two always go
 * together: writing reads newest-filed-first, an appearances list reads by
 * when the thing happens.
 */
export async function loadProfileFeed(
  userId: string,
  options: LoadProfileFeedOptions = {}
): Promise<ThreadFeedItem[]> {
  const { source = "writing", limit = 8, viewerId, orgId } = options;
  const networkUrl = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "";

  try {
    const [rows, homes] = await Promise.all([
      getAuthoredThreads(userId, {
        orgId,
        kinds:
          source === "writing"
            ? WRITING_KINDS
            : source === "events"
              ? SCHEDULED_KINDS
              : undefined,
        scheduledOnly: source === "events",
        order: source === "events" ? "scheduled" : "filed",
        viewerId,
        limit,
      }),
      listOrgHomes().catch(() => [] as OrgHome[]),
    ]);

    const bases = orgBases(homes, networkUrl);
    const href =
      options.href ??
      ((row: AuthoredThread, home: string | null) =>
        `${home ?? ""}/${row.section ?? "posts"}/${row.slug}`);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      href: href(row, bases.get(row.orgId) ?? null),
      kind: row.kind,
      // The org is the kicker on a profile feed, where an org feed uses the
      // section: on somebody's own page, WHERE they published is the fact
      // worth carrying.
      kicker: row.orgName,
      excerpt: row.excerpt,
      coverImageUrl: row.coverImageUrl,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      location: row.location,
    }));
  } catch (err) {
    // A feed that cannot load costs the feed, not the page — the same posture
    // loadThreadFeed takes.
    console.error(`[blocks] loadProfileFeed(${userId}, ${options.source ?? "writing"}):`, err);
    return [];
  }
}

export type ProfileFeedBlockProps = Omit<ProfileFeedProps, "items"> &
  LoadProfileFeedOptions & { userId: string };

export async function ProfileFeedBlock({
  userId,
  viewerId,
  orgId,
  href,
  ...display
}: ProfileFeedBlockProps) {
  const items = await loadProfileFeed(userId, {
    source: display.source as ProfileFeedSource | undefined,
    viewerId,
    orgId,
    href,
    // One source of truth for how many: the display prop, so the query and the
    // render cannot disagree about the count.
    limit: display.limit ?? 8,
  });
  return <ProfileFeed {...(display as ProfileFeedProps)} items={items} />;
}

export interface LoadProfileGalleriesOptions {
  /**
   * The signed-in user. Hidden galleries are listed, marked as hidden, only
   * when this is the person whose galleries these are.
   */
  viewerId?: string;
  /** Where a room lives. Required: galleries have no canonical host app yet. */
  href: (gallery: { slug: string }) => string;
  /**
   * The site asking, as an org id.
   *
   * A gallery names the sites it must NOT appear on (`hidden_on`, migration
   * 146) — "a gallery made on Dana's site starts with {ifac}; appearing on
   * IFAC is her choice". Passing the asking site is what makes that choice
   * mean anything, and this loader is the only shared reader of the table.
   *
   * Optional rather than required so existing callers keep compiling, but a
   * host that leaves it out is showing galleries their owner excluded.
   */
  site?: string;
}

export async function loadProfileGalleries(
  userId: string,
  options: LoadProfileGalleriesOptions
): Promise<ProfileGalleryItem[]> {
  const isSelf = Boolean(options.viewerId && options.viewerId === userId);
  try {
    const rows = await listUserGalleries(userId, { onlyPublic: !isSelf, site: options.site });
    return rows.map((g) => ({
      id: g.id,
      title: g.title,
      href: options.href({ slug: g.slug }),
      description: g.description,
      coverUrl: g.coverUrl,
      itemCount: g.itemCount,
      hidden: !g.isPublic,
    }));
  } catch (err) {
    console.error(`[blocks] loadProfileGalleries(${userId}):`, err);
    return [];
  }
}

export type ProfileGalleriesBlockProps = Omit<ProfileGalleriesProps, "items"> &
  LoadProfileGalleriesOptions & { userId: string };

export async function ProfileGalleriesBlock({
  userId,
  viewerId,
  href,
  site,
  ...display
}: ProfileGalleriesBlockProps) {
  // `site` is destructured, not left in `display`: it is a question for the
  // query, and anything still in `display` is spread onto the component and
  // from there onto the DOM.
  const items = await loadProfileGalleries(userId, { viewerId, href, site });
  return <ProfileGalleries {...display} items={items} />;
}


export interface LoadProfileGalleryOptions {
  /** A gallery's id or its slug. Omitted: the one for `pagePath`, else their first. */
  gallery?: string;
  /**
   * The site asking, as an org id. A gallery listing it in `hidden_on` is not
   * shown — see LoadProfileGalleriesOptions.site. An author placing the block
   * cannot override this; it is the gallery owner's setting, not the page's.
   */
  site?: string;
  /** The page being rendered, for a gallery tied to a `page_path`. */
  pagePath?: string;
  limit?: number;
  /** The signed-in user. A private gallery shows only to its owner. */
  viewerId?: string;
  /** Which of the block's link modes to build. */
  link?: string;
  /** Where a gallery's own page lives, for `link: "gallery"`. */
  galleryHref?: (gallery: { slug: string }) => string;
  /**
   * Where a listed piece lives, for `link: "marketplace"`.
   *
   * A FUNCTION rather than a marketplace URL, and the only way this loader
   * will ever link to one: resolving an artwork id to a sale page means
   * reading the artwork table, and @elkdonis/blocks must not grow a commerce
   * dependency to render a picture. A host that wants that mode knows how to
   * build the link; one that does not passes nothing and the pictures simply
   * do not link.
   */
  artworkHref?: (artworkId: string) => string | null;
}

/**
 * One gallery's pictures, in PictureWall's row shape.
 *
 * Reads `items[].url` and stops. An item may carry an `artworkId`, but the
 * url and title beside it are a snapshot written when the item was added
 * (migration 146) — which is exactly what lets this draw a piece that is a
 * draft, is archived, is sold, or was never in a store at all. Whether
 * something is for sale is a question for whoever asked for
 * `link: "marketplace"`, never a gate on the picture appearing.
 */
export async function loadProfileGallery(
  userId: string,
  options: LoadProfileGalleryOptions = {}
): Promise<{ title: string; pictures: RowValue[] } | null> {
  const isSelf = Boolean(options.viewerId && options.viewerId === userId);
  try {
    // An explicit choice first, then the page's own, then whatever they have.
    // `getUserGalleryById` takes a bare id and so cannot be scoped to a user
    // in the query — hence the ownership check below, which every path goes
    // through rather than being repeated per branch.
    const chosen =
      (options.gallery
        ? ((await getUserGalleryById(options.gallery)) ??
          (await getUserGallery(userId, options.gallery)))
        : null) ??
      (options.pagePath ? await getUserGalleryByPage(userId, options.pagePath) : null) ??
      (await firstVisibleGallery(userId, isSelf, options.site));

    if (!chosen || chosen.userId !== userId) return null;
    if (!chosen.isPublic && !isSelf) return null;
    if (options.site && chosen.hiddenOn.includes(options.site)) return null;

    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 24), 1), 200);
    const href = (item: { url: string; artworkId?: string }): string => {
      switch (options.link) {
        case "image":
          return item.url;
        case "gallery":
          return options.galleryHref?.({ slug: chosen.slug }) ?? "";
        case "marketplace":
          return (item.artworkId && options.artworkHref?.(item.artworkId)) || "";
        default:
          return "";
      }
    };

    return {
      title: chosen.title,
      pictures: chosen.items.slice(0, limit).map((i) => ({
        src: i.url,
        caption: i.title ?? "",
        // The title doubles as the alt text. A gallery item has one piece of
        // writing about it, and a picture with no description at all is worse
        // for a reader than one whose description repeats its caption.
        alt: i.title ?? "",
        href: href(i),
      })),
    };
  } catch (err) {
    console.error(`[blocks] loadProfileGallery(${userId}):`, err);
    return null;
  }
}

/** Their first gallery this site is allowed to show. */
async function firstVisibleGallery(userId: string, isSelf: boolean, site?: string) {
  // The listing already applies both `is_public` and `hidden_on`, so the
  // fallback cannot land on a gallery the site was never allowed to show.
  const [first] = await listUserGalleries(userId, { onlyPublic: !isSelf, site });
  return first ? await getUserGalleryById(first.id) : null;
}

export type ProfileGalleryBlockProps = Omit<
  ProfileGalleryProps,
  "pictures" | "galleryTitle"
> &
  LoadProfileGalleryOptions & { userId: string };

export async function ProfileGalleryBlock({
  userId,
  site,
  pagePath,
  viewerId,
  galleryHref,
  artworkHref,
  ...display
}: ProfileGalleryBlockProps) {
  const loaded = await loadProfileGallery(userId, {
    gallery: typeof display.gallery === "string" ? display.gallery : undefined,
    site,
    pagePath,
    viewerId,
    galleryHref,
    artworkHref,
    link: typeof display.link === "string" ? display.link : undefined,
    limit: typeof display.limit === "number" ? display.limit : 24,
  });
  return (
    <ProfileGallery
      {...(display as ProfileGalleryProps)}
      galleryTitle={loaded?.title ?? null}
      pictures={loaded?.pictures ?? []}
    />
  );
}


const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

export interface LoadProfileStoreOptions {
  limit?: number;
}

/**
 * One person's storefront, or nothing.
 *
 * ── The rule this loader must not break ─────────────────────────────────────
 *
 * The consent check lives HERE, not in the host. `users.profile_sections.store`
 * is how a person says "show my store on other people's sites", and a block
 * any editor on any org can drag onto any page is exactly the thing that must
 * not be able to forget to ask. Same posture as viewerId in loadProfileFeed:
 * one place, no second place to get it wrong.
 *
 * ── This is the FOR-SALE question ────────────────────────────────────────
 *
 * Unlike loadProfileGallery, this reads the artwork table and returns null
 * for anyone without an active, approved store. It must not fall back to
 * anything when it does — a "Store" heading over portfolio pictures would be
 * a lie about what is for sale. That question has its own block
 * (profile-gallery).
 */
export async function loadProfileStore(userId: string, options: LoadProfileStoreOptions = {}) {
  try {
    if (!(await hasProfileSection(userId, "store"))) return null;
    return await getStoreShowcaseForUser(userId, { limit: options.limit ?? 6 });
  } catch (err) {
    console.error(`[blocks] loadProfileStore(${userId}):`, err);
    return null;
  }
}

export type ProfileStoreBlockProps = Omit<
  ProfileStoreProps,
  "store" | "artworks" | "marketplaceUrl"
> &
  LoadProfileStoreOptions & { userId: string; from?: string | null };

export async function ProfileStoreBlock({ userId, from, ...display }: ProfileStoreBlockProps) {
  const showcase = await loadProfileStore(userId, {
    limit: typeof display.limit === "number" ? display.limit : 6,
  });
  return (
    <ProfileStore
      {...(display as ProfileStoreProps)}
      store={showcase?.store ?? null}
      artworks={showcase?.artworks ?? []}
      marketplaceUrl={MARKETPLACE_URL}
      from={from}
    />
  );
}
