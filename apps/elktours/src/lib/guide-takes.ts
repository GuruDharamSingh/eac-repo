// Server only. Guides' own takes on a tour (tour_guide_takes, migration 279; developer, 2026-11-19): a take is
// public on the tour page while its guide leads an upcoming run of the tour (a run with no guide set is led by the
// tour's author).

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { departuresSql } from "@/lib/departures";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

export interface GuideTake {
  id: string;
  threadId: string;
  /** Null = about the whole tour. */
  stopId: string | null;
  guideUserId: string;
  guideName: string | null;
  body: string | null;
  mediaUrl: string | null;
  updatedAt: string;
}

export function mapTake(r: Row): GuideTake {
  return {
    id: r.id as string,
    threadId: r.thread_id as string,
    stopId: (r.stop_id as string | null) ?? null,
    guideUserId: r.guide_user_id as string,
    guideName: (r.guide_name as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    mediaUrl: (r.media_url as string | null) ?? null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** The takes shown on the public tour page: guides with an upcoming scheduled run of this tour. */
export async function publicTakesFor(threadId: string, authorId: string | null): Promise<GuideTake[]> {
  try {
    const rows = (await db`
      SELECT k.*, u.display_name AS guide_name
      FROM tour_guide_takes k JOIN users u ON u.id = k.guide_user_id
      WHERE k.org_id = ${ORG} AND k.thread_id = ${threadId}
        AND (k.body IS NOT NULL OR k.media_url IS NOT NULL)
        AND EXISTS (
          SELECT 1 FROM ${departuresSql()} d
          WHERE d.thread_id = k.thread_id AND d.org_id = ${ORG} AND d.status = 'scheduled' AND d.starts_at >= NOW()
            AND COALESCE(d.guide_user_id, ${authorId}::uuid) = k.guide_user_id
        )
      ORDER BY u.display_name, k.stop_id NULLS FIRST
    `) as unknown as Row[];
    return rows.map(mapTake);
  } catch (err) {
    console.error("[elktours] publicTakesFor:", err);
    return [];
  }
}
