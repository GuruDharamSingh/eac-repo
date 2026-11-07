import type { SocialFeed, InstagramPost, YoutubeVideo } from "@elkdonis/services";
import { PersonSectionPanel } from "@elkdonis/cms-ui/profile";
import { YoutubeTile } from "./YoutubeTile";
import styles from "./SocialSections.module.css";

// ============================================================================
// Instagram and YouTube sections on a person's ArtDirect page (2026-11-01).
// Server-rendered from getInstagramFeed / getYoutubeFeed (cached an hour).
// A visitor sees a section only when it has something to show; the owner is
// also told when a connected account returned nothing or an error.
// ============================================================================

function accountLink(url: string | null, name: string | null, fallback: string) {
  const label = name ?? fallback;
  return url ? (
    <a className={styles.account} href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : null;
}

export function InstagramSection({ feed, isOwner }: { feed: SocialFeed<InstagramPost>; isOwner: boolean }) {
  if (feed.ok === false) {
    return isOwner ? (
      <PersonSectionPanel title="Instagram">
        <p className="eac-person-empty">Could not read your Instagram just now: {feed.error}</p>
      </PersonSectionPanel>
    ) : null;
  }
  if (feed.items.length === 0 && !isOwner) return null;
  return (
    <PersonSectionPanel title="Instagram" action={accountLink(feed.account.url, feed.account.name, "Instagram")}>
      {feed.items.length === 0 ? (
        <p className="eac-person-empty">No posts yet.</p>
      ) : (
        <ul className={styles.grid}>
          {feed.items.map((p) => (
            <li key={p.id}>
              <a href={p.permalink} target="_blank" rel="noopener noreferrer" className={styles.cell}>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.caption ? p.caption.slice(0, 140) : "Instagram post"} loading="lazy" />
                ) : (
                  <span className={styles.noImage}>Post</span>
                )}
                {p.isVideo ? <span className={styles.badge}>Video</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </PersonSectionPanel>
  );
}

export function YoutubeSection({ feed, isOwner }: { feed: SocialFeed<YoutubeVideo>; isOwner: boolean }) {
  if (feed.ok === false) {
    return isOwner ? (
      <PersonSectionPanel title="YouTube">
        <p className="eac-person-empty">Could not read your YouTube channel just now: {feed.error}</p>
      </PersonSectionPanel>
    ) : null;
  }
  if (feed.items.length === 0 && !isOwner) return null;
  return (
    <PersonSectionPanel title="YouTube" action={accountLink(feed.account.url, feed.account.name, "YouTube")}>
      {feed.items.length === 0 ? (
        <p className="eac-person-empty">No public videos yet. Private and unlisted videos are not shown.</p>
      ) : (
        <ul className={styles.videos}>
          {feed.items.map((v) => (
            <li key={v.id}>
              <YoutubeTile id={v.id} title={v.title} thumbnailUrl={v.thumbnailUrl} />
            </li>
          ))}
        </ul>
      )}
    </PersonSectionPanel>
  );
}
