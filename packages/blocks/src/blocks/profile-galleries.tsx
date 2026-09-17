import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A person's gallery pages.
//
// `user_galleries` (migration 124) lets someone keep any number of curated
// rooms. The table has been there since September and exactly one app has ever
// listed them — IFAC, in its own markup, on its own two profile routes. A
// person's galleries were unreachable from their network profile, from an org
// site, or from anywhere else.
//
// Presentational only: a caller hands it rooms. The fetching half is in
// ../server/profile.server.
// ============================================================================

/**
 * One room.
 *
 * Structural rather than the service's `UserGallerySummary`, so a caller can
 * satisfy it from a cache or a search index. Same posture as ThreadFeedItem.
 */
export interface ProfileGalleryItem {
  id: string;
  title: string;
  href: string;
  description?: string | null;
  coverUrl?: string | null;
  /** How many pieces are hung in it. */
  itemCount?: number | null;
  /** True for a gallery only its owner can see. Marked, not hidden. */
  hidden?: boolean;
}

const props = [
  {
    name: "limit",
    kind: "number",
    label: "How many to show",
    default: 8,
  },
  {
    name: "showCounts",
    kind: "boolean",
    label: "Show how many pieces are in each",
    default: true,
  },
  {
    name: "emptyMessage",
    kind: "string",
    label: "Message when there is nothing",
    default: "No galleries yet.",
  },
] as const;

export type ProfileGalleriesProps = PropsOf<typeof props> & {
  items: ProfileGalleryItem[];
};

export function ProfileGalleries({
  items = [],
  limit = 8,
  showCounts = true,
  emptyMessage = "No galleries yet.",
}: ProfileGalleriesProps) {
  const shown = items.slice(0, Math.max(0, limit));
  if (shown.length === 0) {
    return <div className="blk blk-feed-empty">{emptyMessage}</div>;
  }

  return (
    <ul className="blk blk-rooms">
      {shown.map((room) => (
        <li key={room.id} className="blk-room">
          {/* One anchor around the whole card. A click handler on a div would
              lose the middle-click, the keyboard and the reader. */}
          <a className="blk-room-link" href={room.href}>
            {room.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="blk-room-cover" src={room.coverUrl} alt="" loading="lazy" />
            ) : (
              <span className="blk-room-cover blk-room-cover-blank" aria-hidden="true" />
            )}
            <span className="blk-room-body">
              <span className="blk-room-title">
                {room.title}
                {room.hidden && <span className="blk-room-flag">Hidden</span>}
              </span>
              {room.description && <span className="blk-room-blurb">{room.description}</span>}
              {showCounts && typeof room.itemCount === "number" && (
                <span className="blk-room-count">
                  {room.itemCount === 1 ? "1 piece" : `${room.itemCount} pieces`}
                </span>
              )}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export const profileGalleries = defineBlock(
  {
    id: "profile-galleries",
    category: "listings",
    label: "Their galleries",
    description: "The curated gallery pages a person keeps, as a wall of doors.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    silexRoot: "eac-dossier-exhibits",
  },
  ProfileGalleries,
  () => ({
    items: [
      { id: "g1", title: "Tunnels", href: "#", itemCount: 18 },
      { id: "g2", title: "Jazz portraits, 1998—2006", href: "#", itemCount: 41 },
      { id: "g3", title: "Works on paper", href: "#", itemCount: 7 },
    ],
  })
);
