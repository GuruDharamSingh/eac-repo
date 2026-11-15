import { defineBlock, ThreadFeed, type PropsOf, type ThreadFeedItem } from "@elkdonis/blocks";

// ============================================================================
// ktp-studio-feed: what Katie publishes to her org from the Studio or Channel
// (posts, meetings, offerings) on her own site. This app has no thread pages,
// so each row links out to the item's page on the network
// (`https://katie-the-potter.<network host>/<slug>`, served by arts-collective's
// org subdomain; resolver in lib/puck/config.server.ts). Developer's choice
// 2026-11-14: "feed linking out".
//
// A heading over the shared ThreadFeed list. With nothing published the block
// draws nothing at all, so a visitor never meets an empty section; the editor
// shows sample rows (the third argument) so it can be placed and styled.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "From the studio" },
  { name: "intro", kind: "string", label: "Intro", default: "" },
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "list",
    options: [
      { value: "list", label: "List" },
      { value: "grid", label: "Grid" },
    ],
  },
  { name: "limit", kind: "number", label: "How many to show", default: 6, min: 1, max: 24, step: 1 },
  { name: "showCovers", kind: "boolean", label: "Show cover pictures", default: true },
  {
    name: "timeZone",
    kind: "string",
    label: "Time zone",
    description: "IANA zone the times are shown in, e.g. America/Toronto. Leave empty to use the reader's own.",
    default: "",
  },
] as const;

export type StudioFeedProps = PropsOf<typeof props> & { items?: ThreadFeedItem[] };

export function StudioFeed({ heading, intro, layout = "list", limit = 6, showCovers = true, timeZone, items = [] }: StudioFeedProps) {
  if (items.length === 0) return null;
  const title = typeof heading === "string" ? heading.trim() : "";
  const lede = typeof intro === "string" ? intro.trim() : "";
  return (
    <section className="blk ktp-works ktp-studio-feed">
      {title || lede ? (
        <header className="ktp-works-head">
          {title ? <h2 className="ktp-works-title">{title}</h2> : null}
          {lede ? <p className="ktp-works-intro">{lede}</p> : null}
        </header>
      ) : null}
      <ThreadFeed items={items} layout={layout} limit={limit} showCovers={showCovers} timeZone={timeZone || undefined} emptyMessage="" />
    </section>
  );
}

export const studioFeed = defineBlock(
  {
    id: "ktp-studio-feed",
    label: "From the studio",
    category: "listings",
    description: "Posts, gatherings and offerings published to this site's organisation. Each opens on the network. Hidden while there are none.",
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
    props,
  },
  StudioFeed,
  () => ({
    heading: "From the studio",
    intro: "",
    layout: "list" as const,
    limit: 6,
    showCovers: true,
    timeZone: "",
    items: [
      {
        id: "sample-1",
        title: "Sample: a new glaze test",
        href: "#",
        kind: "post",
        kicker: "Studio",
        excerpt: "Sample row. Published posts, gatherings and offerings show here.",
      },
      {
        id: "sample-2",
        title: "Sample: open studio afternoon",
        href: "#",
        kind: "meeting",
        kicker: "Services",
        scheduledAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        durationMinutes: 120,
      },
    ],
  })
);
