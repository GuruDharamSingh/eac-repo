// Collaborate (design screen 36) and the artist's invitations (screen 30): reads and pure helpers. Server only.
// Writes: lib/collaborate-actions.ts. An invitation is a service_commissions row for one experience on one
// departure, with the drafted columns stop_id and arrival_at and a nullable service_thread_id
// (migrations-draft/service_commissions_experience_invites.sql).
import { departuresSql, tourBookingsSql } from "@/lib/departures";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getAvailability } from "@/lib/artist-wizard";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

export type InvitationStatus = "proposed" | "accepted" | "declined" | "cancelled" | "completed";
export type DateChipState = "confirmed" | "asked" | "declined" | "free" | "not_free";

// ── pure rules ──────────────────────────────────────────────────────────────

/** Minutes after the tour starts that the group reaches stop `index` (0-based) of `count`, rounded to 5. */
export function stopOffsetMinutes(durationMinutes: number | null, index: number, count: number): number {
  if (!durationMinutes || count <= 0) return 0;
  return Math.round((durationMinutes * index) / count / 5) * 5;
}

/**
 * Arrival time at each stop of a run: start + duration x index / number of stops, rounded to 5 minutes.
 * Stops are taken in position order. `arrivalAt` is an ISO instant.
 */
export function stopArrivalTimes(
  tour: { durationMinutes: number | null; stops: Array<{ id: string; position: number }> },
  departure: { startsAt: string | Date }
): Array<{ stopId: string; index: number; offsetMinutes: number; arrivalAt: string }> {
  const start = new Date(departure.startsAt).getTime();
  const stops = [...tour.stops].sort((a, b) => a.position - b.position);
  return stops.map((s, index) => {
    const offsetMinutes = stopOffsetMinutes(tour.durationMinutes, index, stops.length);
    return { stopId: s.id, index, offsetMinutes, arrivalAt: new Date(start + offsetMinutes * 60_000).toISOString() };
  });
}

/** Paris wall-clock weekday (0 = Monday) and part of day (before 12:00 morning, before 17:00 afternoon, else evening). */
export function slotOf(at: Date | string): { weekday: number; part: "morning" | "afternoon" | "evening" } {
  const d = new Date(at);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: siteConfig.timeZone, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
  return { weekday: weekday < 0 ? 0 : weekday, part: hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening" };
}

/**
 * Whether the artist ticked that weekday and part of day. False when they have saved nothing, and
 * false until the artist_availability table exists (nobody is "free" by default).
 */
export async function artistFreeAt(userId: string, at: Date | string): Promise<boolean> {
  const a = await getAvailability(userId);
  if (!a.available) return false;
  const { weekday, part } = slotOf(at);
  return a.cells.some((c) => c.weekday === weekday && c.part === part);
}

/** Do the drafted service_commissions columns exist yet? */
export async function invitationColumnsExist(): Promise<boolean> {
  try {
    const [r] = (await db`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_commissions' AND column_name = 'stop_id')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_commissions' AND column_name = 'arrival_at')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_commissions' AND column_name = 'service_thread_id' AND is_nullable = 'YES') AS ok
    `) as unknown as Row[];
    return Boolean(r?.ok);
  } catch {
    return false;
  }
}

// ── invitations ─────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  status: InvitationStatus;
  experience: { id: string; slug: string; title: string };
  tour: { id: string; slug: string; title: string };
  /** `position` is 0-based (as stored); `number` is 1-based, for roman numerals (Stop IV). */
  stop: { id: string; position: number; number: number; title: string } | null;
  departureId: string;
  startsAt: string;
  arrivalAt: string | null;
  artist: { userId: string; name: string | null };
  /** Who leads that run: the departure's guide, else the tour's author. Null when neither is known. */
  guide: { name: string } | null;
  /** Fee asked, in cents, with its unit (per run or per guest). */
  feeCents: number | null;
  unit: "per_run" | "per_guest" | "flat";
  currency: string | null;
  /** Guests booked on that run so far. */
  guestsBooked: number;
  respondedAt: string | null;
}

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

/**
 * Invitations for one artist or one tour, soonest run first. An artist reads their own; editors read any.
 * Empty until the migration exists.
 */
export async function listInvitations(opts: { artistUserId?: string; tourId?: string; experienceId?: string; upcomingOnly?: boolean } = {}): Promise<Invitation[]> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return [];
  if (!viewer.canEdit && opts.artistUserId !== viewer.userId) return [];
  if (!(await invitationColumnsExist())) return [];
  // Artist: own. Guide: invitations to them and those on tours they wrote. Owner: all.
  const guideScope = viewer.canEdit && viewer.role !== "owner";
  const rows = (await db`
    SELECT c.id, c.status, c.arrival_at, c.unit, c.price_cents, c.currency, c.responded_at, c.seller_user_id, c.departure_id,
           e.id AS exp_id, e.slug AS exp_slug, e.title AS exp_title,
           t.id AS tour_id, t.slug AS tour_slug, t.title AS tour_title,
           s.id AS stop_id, s.position AS stop_pos, s.title AS stop_title,
           d.starts_at, u.display_name AS artist_name, COALESCE(dg.display_name, ta.display_name) AS guide_name,
           COALESCE((SELECT SUM(b.party_size) FROM ${tourBookingsSql()} b WHERE b.departure_id = d.id AND b.status = 'confirmed'), 0)::int AS booked
    FROM service_commissions c
    JOIN threads e ON e.id = c.experience_thread_id
    JOIN threads t ON t.id = c.tour_thread_id
    JOIN ${departuresSql()} d ON d.id = c.departure_id
    LEFT JOIN tour_stops s ON s.id = c.stop_id
    LEFT JOIN users u ON u.id = c.seller_user_id
    LEFT JOIN users dg ON dg.id = d.guide_user_id
    LEFT JOIN users ta ON ta.id = t.author_id
    WHERE c.buyer_org_id = ${ORG}
      ${opts.artistUserId ? db`AND c.seller_user_id = ${opts.artistUserId}` : db``}
      ${opts.tourId ? db`AND c.tour_thread_id = ${opts.tourId}` : db``}
      ${opts.experienceId ? db`AND c.experience_thread_id = ${opts.experienceId}` : db``}
      ${opts.upcomingOnly ? db`AND d.starts_at > NOW()` : db``}
      ${guideScope ? db`AND (c.seller_user_id = ${viewer.userId} OR t.author_id = ${viewer.userId})` : db``}
    ORDER BY d.starts_at, s.position
    LIMIT 300
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as InvitationStatus,
    experience: { id: r.exp_id as string, slug: r.exp_slug as string, title: r.exp_title as string },
    tour: { id: r.tour_id as string, slug: r.tour_slug as string, title: r.tour_title as string },
    stop: r.stop_id ? { id: r.stop_id as string, position: Number(r.stop_pos), number: Number(r.stop_pos) + 1, title: r.stop_title as string } : null,
    departureId: r.departure_id as string,
    startsAt: iso(r.starts_at)!,
    arrivalAt: iso(r.arrival_at),
    artist: { userId: r.seller_user_id as string, name: (r.artist_name as string | null) ?? null },
    guide: r.guide_name ? { name: r.guide_name as string } : null,
    feeCents: r.price_cents == null ? null : Number(r.price_cents),
    unit: r.unit as Invitation["unit"],
    currency: (r.currency as string | null) ?? null,
    guestsBooked: Number(r.booked ?? 0),
    respondedAt: iso(r.responded_at),
  }));
}

// ── Collaborate screen ──────────────────────────────────────────────────────

export interface CollaborateStop {
  stopId: string;
  position: number;
  title: string;
  offsetMinutes: number;
  experience: { id: string; slug: string; title: string; artistUserId: string | null; artistName: string | null } | null;
  /** One chip per upcoming run, only for a stop with an experience. */
  dates: Array<{ departureId: string; startsAt: string; arrivalAt: string; state: DateChipState; invitationId: string | null }>;
}

/**
 * The tour's stops as a timeline, each with its experience and one chip per upcoming date:
 * Confirmed (accepted), Asked (proposed), Declined, "+ Invite" (free) or Not free. Editors only.
 */
export async function getCollaborate(tourId: string): Promise<CollaborateStop[]> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer?.canEdit) return [];
  const [tour] = (await db`SELECT id, duration_minutes, author_id FROM threads WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour'`) as unknown as Row[];
  if (!tour) return [];
  // A guide reads only the tours they wrote; the office reads all.
  if (viewer.role !== "owner" && tour.author_id !== viewer.userId) return [];
  const stops = (await db`
    SELECT s.id, s.position, s.title, s.experience_id, e.slug AS exp_slug, e.title AS exp_title,
           (SELECT ep.user_id FROM experience_people ep WHERE ep.thread_id = e.id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_id,
           (SELECT u.display_name FROM experience_people ep JOIN users u ON u.id = ep.user_id WHERE ep.thread_id = e.id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_name
    FROM tour_stops s LEFT JOIN threads e ON e.id = s.experience_id AND e.kind = 'experience'
    WHERE s.thread_id = ${tourId} AND s.org_id = ${ORG} ORDER BY s.position
  `) as unknown as Row[];
  const deps = (await db`
    SELECT id, starts_at FROM ${departuresSql()} d
    WHERE thread_id = ${tourId} AND org_id = ${ORG} AND starts_at > NOW() AND status <> 'cancelled' ORDER BY starts_at LIMIT 40
  `) as unknown as Row[];
  const invites = await listInvitations({ tourId, upcomingOnly: true });
  const times = stopArrivalTimes(
    { durationMinutes: tour.duration_minutes == null ? null : Number(tour.duration_minutes), stops: stops.map((s) => ({ id: s.id as string, position: Number(s.position) })) },
    { startsAt: new Date().toISOString() }
  );
  const offset = new Map(times.map((t) => [t.stopId, t.offsetMinutes]));
  const out: CollaborateStop[] = [];
  for (const s of stops) {
    const stopId = s.id as string;
    const off = offset.get(stopId) ?? 0;
    const artistId = (s.artist_id as string | null) ?? null;
    const dates: CollaborateStop["dates"] = [];
    if (s.experience_id) {
      for (const d of deps) {
        const startsAt = iso(d.starts_at)!;
        const arrivalAt = new Date(new Date(startsAt).getTime() + off * 60_000).toISOString();
        const inv = invites.find((i) => i.departureId === (d.id as string) && i.stop?.id === stopId && i.experience.id === (s.experience_id as string) && i.status !== "cancelled");
        const state: DateChipState = inv
          ? inv.status === "accepted" || inv.status === "completed" ? "confirmed" : inv.status === "declined" ? "declined" : "asked"
          : artistId && (await artistFreeAt(artistId, arrivalAt)) ? "free" : "not_free";
        dates.push({ departureId: d.id as string, startsAt, arrivalAt, state, invitationId: inv?.id ?? null });
      }
    }
    out.push({
      stopId,
      position: Number(s.position),
      title: s.title as string,
      offsetMinutes: off,
      experience: s.experience_id ? { id: s.experience_id as string, slug: s.exp_slug as string, title: s.exp_title as string, artistUserId: artistId, artistName: (s.artist_name as string | null) ?? null } : null,
      dates,
    });
  }
  return out;
}

// ── what guests see ─────────────────────────────────────────────────────────

/** Dates an artist has accepted for an experience (upcoming, not cancelled, tour published). The experience page lists only these. */
export async function listAcceptedDates(experienceId: string): Promise<Array<{ departureId: string; startsAt: string; arrivalAt: string | null; tour: { slug: string; title: string }; stopPosition: number | null }>> {
  if (!(await invitationColumnsExist())) return [];
  try {
    const rows = (await db`
      SELECT c.departure_id, c.arrival_at, d.starts_at, t.slug AS tour_slug, t.title AS tour_title, s.position AS stop_pos
      FROM service_commissions c
      JOIN ${departuresSql()} d ON d.id = c.departure_id AND d.starts_at > NOW() AND d.status <> 'cancelled'
      JOIN threads t ON t.id = c.tour_thread_id AND t.status = 'published' AND t.visibility = 'PUBLIC'
      LEFT JOIN tour_stops s ON s.id = c.stop_id
      WHERE c.experience_thread_id = ${experienceId} AND c.buyer_org_id = ${ORG} AND c.status = 'accepted'
      ORDER BY d.starts_at
    `) as unknown as Row[];
    return rows.map((r) => ({
      departureId: r.departure_id as string,
      startsAt: iso(r.starts_at)!,
      arrivalAt: iso(r.arrival_at),
      tour: { slug: r.tour_slug as string, title: r.tour_title as string },
      stopPosition: r.stop_pos == null ? null : Number(r.stop_pos),
    }));
  } catch (err) {
    console.error("[elktours] listAcceptedDates:", err);
    return [];
  }
}

/** The public experience at each stop (guests see an experience on a stop only when it is published and PUBLIC). */
export async function publicExperiencesAtStops(stopIds: string[]): Promise<Map<string, { id: string; slug: string; title: string; artistName: string | null }>> {
  const out = new Map<string, { id: string; slug: string; title: string; artistName: string | null }>();
  if (!stopIds.length) return out;
  const rows = (await db`
    SELECT s.id AS stop_id, e.id, e.slug, e.title,
      (SELECT u.display_name FROM experience_people ep JOIN users u ON u.id = ep.user_id WHERE ep.thread_id = e.id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_name
    FROM tour_stops s JOIN threads e ON e.id = s.experience_id AND e.kind = 'experience' AND e.org_id = ${ORG}
      AND e.status = 'published' AND e.visibility = 'PUBLIC'
    WHERE s.id = ANY(${stopIds}::uuid[])
  `) as unknown as Row[];
  for (const r of rows) out.set(r.stop_id as string, { id: r.id as string, slug: r.slug as string, title: r.title as string, artistName: (r.artist_name as string | null) ?? null });
  return out;
}
