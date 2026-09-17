import { defineBlock, type PropsOf } from "../registry";
import { CycleBadge } from "./cycle-badge";

// ============================================================================
// A list of threads.
//
// This is the block that demonstrates the split, so it is worth being explicit
// about what is where:
//
//   THIS FILE   the presentational half. Props in, markup out. No `async`, no
//               database, no `@elkdonis/db` anywhere in its import graph.
//   ./server    the fetching half. Reads the threads, renders this.
//
// Why bother, when the app could just `await` and map inline (which is what
// apps/amrit-canada/src/app/[feed]/page.tsx does today)?
//
//   - It can be previewed. An editor canvas, a palette thumbnail or a
//     screenshot test can render it from `sample()` with no database at all.
//     An async server component cannot render in any of those places.
//   - It can be tested without a database.
//   - It can be reused by a caller that already has the rows — a search
//     result page, a profile, a digest email preview — without a second query.
//
// The third one is the reason this pays for itself even if no drag-and-drop
// editor is ever built. The first one is the reason it would be cheap if one
// is.
// ============================================================================

/**
 * One row.
 *
 * Deliberately NOT the app's `Thread` view-model, which carries 30-odd fields
 * including Talk tokens and reminder settings. A block should ask for what it
 * draws, so a caller can satisfy it from a search index or a cache without
 * having to produce a whole thread. Structural, so an app's richer object
 * passes straight in with no adapter — the same posture cms-ui/hub takes.
 */
export interface ThreadFeedItem {
  id: string;
  title: string;
  href: string;
  kind?: string | null;
  /** Shown in the kicker beside the kind, e.g. the section's name. */
  kicker?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  /** ISO string or Date. Absent for undated items such as writing. */
  scheduledAt?: string | Date | null;
  durationMinutes?: number | null;
  location?: string | null;
  authorName?: string | null;
  attendanceCount?: number | null;
  cycleStatus?: "confirmed" | "cancelled" | "pending" | null;
  /** Any CSS colour, for this row's hairline. */
  accent?: string | null;
}

const props = [
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
  {
    name: "limit",
    kind: "number",
    label: "How many to show",
    default: 10,
  },
  {
    name: "showCovers",
    kind: "boolean",
    label: "Show cover images",
    default: true,
  },
  {
    name: "emptyMessage",
    kind: "string",
    label: "Message when there is nothing",
    default: "Nothing here yet.",
  },
  {
    name: "timeZone",
    kind: "string",
    label: "Time zone",
    description:
      "IANA zone the times are shown in, e.g. America/Toronto. Leave empty to use the reader's own.",
  },
] as const;

export type ThreadFeedProps = PropsOf<typeof props> & {
  items: ThreadFeedItem[];
};

/**
 * Times are shown in ONE stated zone, not converted to the reader's.
 *
 * Carried over from the amrit-canada formatter, whose comment explains it: a
 * physical community at one address needs "4:00 AM" to mean 4am at the door,
 * not 4am wherever the browser happens to be. A traveller checking the
 * schedule should see the time they need to show up.
 *
 * The zone is a PROP here rather than a module constant, because the block
 * serves more than one city.
 */
function formatWhen(value: string | Date, timeZone?: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone) opts.timeZone = timeZone;

  try {
    return new Intl.DateTimeFormat("en-CA", opts).format(date);
  } catch {
    // An invalid zone should cost the zone, not the date.
    delete opts.timeZone;
    return new Intl.DateTimeFormat("en-CA", opts).format(date);
  }
}

function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function ThreadFeed({
  // Defaulted because `items` is supplied by a fetch, not by the author: a
  // block that has been placed but not yet resolved has none, and a published
  // page whose feed query failed has none either. Neither may crash the page.
  items = [],
  layout = "list",
  limit = 10,
  showCovers = true,
  emptyMessage = "Nothing here yet.",
  timeZone,
}: ThreadFeedProps) {
  // Trimming here rather than trusting the caller: the same `limit` an editor
  // set has to hold whether the rows came from the server wrapper, a cache, or
  // a page that fetched its own.
  const shown = items.slice(0, Math.max(0, limit));

  if (shown.length === 0) {
    return <div className="blk blk-feed-empty">{emptyMessage}</div>;
  }

  return (
    <div className="blk blk-feed" data-layout={layout}>
      {shown.map((item) => {
        const when = item.scheduledAt ? formatWhen(item.scheduledAt, timeZone) : "";
        const duration = formatDuration(item.durationMinutes);

        return (
          <article
            key={item.id}
            className="blk-item"
            data-kind={item.kind ?? undefined}
            style={
              item.accent
                ? ({ "--blk-item-accent": item.accent } as React.CSSProperties)
                : undefined
            }
          >
            {showCovers && item.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="blk-item-cover" src={item.coverImageUrl} alt="" loading="lazy" />
            )}

            {(item.kind || item.kicker) && (
              <span className="blk-item-kicker">
                {[item.kind, item.kicker].filter(Boolean).join(" · ")}
              </span>
            )}

            <h3 className="blk-item-title">
              {/* A real anchor, not a click handler on the card. Without
                  JavaScript, in a reader, or from a search result this still
                  goes somewhere, and a modifier-click keeps its meaning. */}
              <a href={item.href}>{item.title}</a>
            </h3>

            {item.excerpt && <p className="blk-item-blurb">{item.excerpt}</p>}

            <div className="blk-item-meta">
              {when && (
                <span>
                  <b>{when}</b>
                  {duration ? ` · ${duration}` : ""}
                </span>
              )}
              {item.location && <span>{item.location}</span>}
              {typeof item.attendanceCount === "number" && item.attendanceCount > 0 && (
                <span>
                  <b>{item.attendanceCount}</b> coming
                </span>
              )}
              {item.authorName && <span>with {item.authorName}</span>}
            </div>

            {item.cycleStatus && (
              <div style={{ marginTop: 4 }}>
                <CycleBadge status={item.cycleStatus} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export const threadFeed = defineBlock(
  {
    id: "thread-feed",
    category: "listings",
    label: "Feed",
    description:
      "A list of gatherings, workshops or writing from this organisation, newest or soonest first.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  ThreadFeed,
  () => ({
    items: [
      {
        id: "sample-1",
        title: "Morning Sadhana",
        href: "#",
        kind: "meeting",
        kicker: "Daily practice",
        excerpt: "Kundalini kriya and meditation before dawn. Newcomers welcome.",
        scheduledAt: new Date(Date.now() + 864e5).toISOString(),
        durationMinutes: 150,
        location: "Toronto",
        attendanceCount: 7,
        cycleStatus: "confirmed" as const,
      },
      {
        id: "sample-2",
        title: "On the ambrosial hours",
        href: "#",
        kind: "post",
        kicker: "Writing",
        excerpt: "Why the hours before sunrise have been kept apart in every tradition.",
        authorName: "Guru Dharam",
      },
    ],
  })
);
