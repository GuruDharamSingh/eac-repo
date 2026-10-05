import { loadBids, loadLots, loadStats } from "@/lib/auction-data";
import { loadDiscussion, loadPost, loadTopics } from "@/lib/article-data";

// ============================================================================
// What each data block shows, read from the database. Shared by the published
// page (resolvers in config.server.ts, a direct call). The editor's canvas uses
// the public /api/auction/* routes instead, so nothing here is reachable from
// a client bundle. Plain JSON out: Puck deep-copies resolver output.
// ============================================================================

type Props = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.trunc(v), min), max) : fallback;

export const BLOCK_DATA_IDS = [
  "au-lots",
  "au-timeline",
  "au-hero",
  "au-ticker",
  "au-stats",
  "au-countdown",
  "au-article",
  "au-discussion",
  "au-topics",
] as const;

/** The latest public topic of the org: what a page-wide block shows when no article is being read. */
async function latestSlug(): Promise<string | null> {
  const [t] = await loadTopics(1);
  return t ? t.readHref.replace(/^\/read\//, "") : null;
}

export async function loadBlockData(id: string, props: Props, ctx: Props = {}): Promise<Props> {
  const now = new Date().toISOString();
  const event = str(props.event);
  switch (id) {
    case "au-lots":
      return { now, lots: await loadLots({ event, scope: (str(props.scope) as never) ?? "open", limit: num(props.limit, 1, 48, 8) }) };
    case "au-timeline":
      return { now, lots: await loadLots({ event, scope: props.scope === "all" ? "all" : "open", limit: num(props.limit, 1, 60, 24) }) };
    case "au-hero":
      return { now, lots: await loadLots({ event, scope: "open", limit: 12 }) };
    case "au-ticker":
      return { now, bids: await loadBids({ event, limit: num(props.limit, 1, 30, 8) }) };
    case "au-stats":
    case "au-countdown":
      return { now, stats: await loadStats({ event }) };
    case "au-article": {
      const slug = str(ctx.slug) ?? str(props.slug) ?? (await latestSlug());
      return { post: slug ? await loadPost(slug) : null };
    }
    case "au-discussion": {
      let threadId = str(ctx.threadId);
      if (!threadId) {
        const slug = str(ctx.slug) ?? (await latestSlug());
        const post = slug ? await loadPost(slug) : null;
        threadId = post?.id;
      }
      return { discussion: threadId ? await loadDiscussion(threadId, num(props.limit, 1, 30, 8)) : null };
    }
    case "au-topics":
      return { topics: await loadTopics(num(props.limit, 1, 20, 6)) };
    default:
      return {};
  }
}

