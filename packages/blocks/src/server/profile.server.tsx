import {
  getAuthoredThreads,
  listUserGalleries,
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
}

export async function loadProfileGalleries(
  userId: string,
  options: LoadProfileGalleriesOptions
): Promise<ProfileGalleryItem[]> {
  const isSelf = Boolean(options.viewerId && options.viewerId === userId);
  try {
    const rows = await listUserGalleries(userId, { onlyPublic: !isSelf });
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
  ...display
}: ProfileGalleriesBlockProps) {
  const items = await loadProfileGalleries(userId, { viewerId, href });
  return <ProfileGalleries {...display} items={items} />;
}
