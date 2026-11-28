import { SurfaceCard } from "@elkdonis/cms-ui/surface";

/**
 * "Recent work" for a member or follower: what the organisation has published lately, each a
 * link to the piece on the site. It replaces the old card-less member list. Draws nothing
 * when there is nothing (the old "Nothing published yet." line is not a card).
 */
export interface RecentItem {
  id: string;
  slug: string;
  kind: string;
  title: string;
}

export function RecentWorkFace({
  items,
  orgName,
  homeUrl,
}: {
  items: RecentItem[];
  orgName: string;
  homeUrl: string;
}) {
  if (items.length === 0) return null;
  return (
    <SurfaceCard
      kind="post"
      glyph="✎"
      kicker={orgName}
      layout="header"
      title="Recent work"
      href={homeUrl}
      cue="↗"
      ariaLabel={`Everything on the site of ${orgName}`}
      preview={
        <ul className="orgp-recent">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <a className="orgp-recent-a eac-face-live" href={`${homeUrl}/${it.slug}`} target="_blank" rel="noopener">
                <span className="orgp-recent-kind">{it.kind}</span>
                <span className="orgp-recent-title">{it.title}</span>
              </a>
            </li>
          ))}
        </ul>
      }
    />
  );
}
