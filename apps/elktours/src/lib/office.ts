// The Office (the board, renamed 2026-11-15): one read for its "Needs you" row and section counts.
// Design: pack/screens-board.md §1 (Guide + Office lists), screen 30. Plain server module, cheap counts only.
// guideUserId scopes the guide-owned counts (slots, tours, posts); owners pass none and see everything.

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { boardCounts } from "@/lib/tour-slots";
import { departuresSql } from "@/lib/departures";
import { countOverlaps } from "@/lib/slot-overlaps";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;

export interface OfficeNeed {
  key: "calls" | "overlaps" | "review" | "posts" | "suggestions" | "artists";
  label: string;
  count: number;
  href: string;
  /** Owner-only queues are hidden from guides. */
  ownerOnly: boolean;
}

export interface OfficeSummary {
  /** The "Needs you" tiles, in urgency order; zero counts included so the UI can say "All clear". */
  needs: OfficeNeed[];
  places: { featured: number; total: number };
  /** Linked stops: "N confirmed · N asked" per tour (design: Experiences on tours). */
  experiencesOnTours: Array<{ tourId: string; tourTitle: string; stops: number; confirmed: number; asked: number }>;
  /** Public experiences not on any tour stop yet (design: New from artists). */
  newFromArtists: Array<{ id: string; slug: string; title: string; artistName: string | null }>;
}

export async function getOfficeSummary(opts: { guideUserId?: string; isOwner: boolean }): Promise<OfficeSummary> {
  const g = opts.guideUserId ?? null;
  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (err) { console.error("[elktours] office:", err); return fallback; }
  };

  const [counts, overlapCount, review, posts, suggestions, waiting, places, onTours, fresh] = await Promise.all([
    safe(boardCounts({ guideUserId: g ?? undefined }), { belowMinimum: 0, withWaitlist: 0, nextSlot: null }),
    countOverlaps({ guideUserId: g ?? undefined }),
    safe(db`SELECT count(*) AS c FROM threads WHERE org_id = ${ORG} AND kind = 'experience' AND status = 'pending'` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`SELECT count(*) AS c FROM threads WHERE org_id = ${ORG} AND kind = 'post' AND section = 'feed' AND status = 'pending'` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`SELECT count(*) AS c FROM visitor_suggestions WHERE org_id = ${ORG} AND status = 'pending'` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`
      SELECT count(*) AS c FROM service_commissions c
      JOIN threads t ON t.id = c.tour_thread_id
      WHERE c.buyer_org_id = ${ORG} AND c.status = 'proposed' AND c.experience_thread_id IS NOT NULL
        AND (${g}::uuid IS NULL OR t.author_id = ${g}::uuid)
    ` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`
      SELECT (SELECT count(DISTINCT place_id) FROM place_favourites WHERE org_id = ${ORG} AND featured
                AND (${g}::uuid IS NULL OR user_id = ${g}::uuid)) AS featured,
             (SELECT count(*) FROM places WHERE org_id = ${ORG} AND is_public AND archived_at IS NULL) AS total
    ` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`
      SELECT t.id, t.title, count(DISTINCT s.id) AS stops,
             count(c.id) FILTER (WHERE c.status = 'accepted') AS confirmed,
             count(c.id) FILTER (WHERE c.status = 'proposed') AS asked
      FROM tour_stops s
      JOIN threads t ON t.id = s.thread_id AND t.kind = 'tour' AND t.status <> 'archived'
      LEFT JOIN service_commissions c ON c.stop_id = s.id AND c.experience_thread_id = s.experience_id
      LEFT JOIN ${departuresSql()} d ON d.id = c.departure_id
      WHERE s.org_id = ${ORG} AND s.experience_id IS NOT NULL
        AND (${g}::uuid IS NULL OR t.author_id = ${g}::uuid)
        AND (c.id IS NULL OR d.starts_at IS NULL OR d.starts_at > NOW())
      GROUP BY t.id, t.title ORDER BY t.title
    ` as unknown as Promise<Row[]>, [] as Row[]),
    safe(db`
      SELECT e.id, e.slug, e.title, u.display_name AS artist_name
      FROM threads e
      LEFT JOIN experience_people ep ON ep.thread_id = e.id AND ep.role = 'artist'
      LEFT JOIN users u ON u.id = ep.user_id
      WHERE e.org_id = ${ORG} AND e.kind = 'experience' AND e.status = 'published' AND e.visibility = 'PUBLIC'
        AND NOT EXISTS (SELECT 1 FROM tour_stops s WHERE s.experience_id = e.id)
      ORDER BY e.published_at DESC NULLS LAST LIMIT 6
    ` as unknown as Promise<Row[]>, [] as Row[]),
  ]);

  const needs: OfficeNeed[] = [
    { key: "calls", label: "Calls to make", count: counts.belowMinimum, href: "/manage/decisions", ownerOnly: false },
    { key: "overlaps", label: "Overlapping runs", count: overlapCount, href: "/manage/overlaps", ownerOnly: false },
    { key: "review", label: "Experiences to review", count: n(review[0]?.c), href: "/manage/experiences", ownerOnly: true },
    { key: "posts", label: "Posts to confirm", count: n(posts[0]?.c), href: "/manage/feed-review", ownerOnly: true },
    { key: "suggestions", label: "Suggestions", count: n(suggestions[0]?.c), href: "/manage/suggestions", ownerOnly: false },
    { key: "artists", label: "Waiting on artists", count: n(waiting[0]?.c), href: "/manage/invitations", ownerOnly: false },
  ].filter((x) => opts.isOwner || !x.ownerOnly) as OfficeNeed[];

  return {
    needs,
    places: { featured: n(places[0]?.featured), total: n(places[0]?.total) },
    experiencesOnTours: onTours.map((r) => ({ tourId: r.id as string, tourTitle: r.title as string, stops: n(r.stops), confirmed: n(r.confirmed), asked: n(r.asked) })),
    newFromArtists: fresh.map((r) => ({ id: r.id as string, slug: r.slug as string, title: r.title as string, artistName: (r.artist_name as string | null) ?? null })),
  };
}

/** The Office's "+" sheet (Justin 2026-11-15): three create tiles instead of going straight to New slots. */
export const OFFICE_CREATE = [
  { key: "tour", label: "New tour", line: "Route, stops and price", href: "/manage/tours/new" },
  { key: "experience", label: "New experience", line: "An artist's visit or workshop", href: "/manage/experiences/new" },
  { key: "dates", label: "New dates", line: "Slots for a tour", href: "/manage/schedule/new" },
] as const;
