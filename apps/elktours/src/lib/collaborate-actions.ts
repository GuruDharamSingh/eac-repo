"use server";
// Collaborate writes (design screen 36) and the artist's answer (screen 30). Reads: lib/collaborate.ts.
// Invitations are service_commissions rows with the drafted columns; until that migration is applied
// the link action says "available after migration" and changes nothing.

import { departuresSql } from "@/lib/departures";
import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";
import { respondCommission } from "@/lib/commissions";
import { artistFreeAt, invitationColumnsExist, stopArrivalTimes } from "@/lib/collaborate";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

function revalidateAll(tourSlug?: string) {
  revalidatePath("/manage");
  revalidatePath("/experiences");
  if (tourSlug) revalidatePath(`/tours/${tourSlug}`);
}

/**
 * Put an experience on a tour stop (or clear it with null). Guides may do it on their own tours; the office on any.
 * Sets tour_stops.experience_id, then creates one invitation per upcoming run the artist is free for, timed to when the
 * group reaches the stop. A run the artist is not free for gets none (the screen offers "Not free"). Linking again is
 * idempotent: a run with a live invitation is skipped. Changing or clearing the experience cancels the old live invitations
 * for that stop. The experience must be published.
 */
export async function linkExperienceToStopAction(stopId: string, experienceId: string | null): Promise<Result<{ invited: number; skippedNotFree: number }>> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only guides and the office can do this." };
  if (!UUID.test(stopId)) return { ok: false, error: "Not found." };
  if (!(await invitationColumnsExist())) return { ok: false, error: "available after migration" };

  const [stop] = (await db`
    SELECT s.id, s.thread_id, s.experience_id, t.slug, t.author_id, t.duration_minutes
    FROM tour_stops s JOIN threads t ON t.id = s.thread_id
    WHERE s.id = ${stopId} AND s.org_id = ${ORG} AND t.kind = 'tour'
  `) as unknown as Row[];
  if (!stop) return { ok: false, error: "That stop is not on this site." };
  if (viewer.role !== "owner" && stop.author_id !== viewer.userId) return { ok: false, error: "That is not your tour." };

  let artistId: string | null = null;
  let offer: { onTour?: { fee?: number; unit?: string } } = {};
  if (experienceId) {
    const [exp] = (await db`
      SELECT e.id, e.status, e.metadata,
        (SELECT ep.user_id FROM experience_people ep WHERE ep.thread_id = e.id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_id
      FROM threads e WHERE e.id = ${experienceId} AND e.org_id = ${ORG} AND e.kind = 'experience'
    `) as unknown as Row[];
    if (!exp) return { ok: false, error: "That experience is not on this site." };
    if (exp.status !== "published") return { ok: false, error: "That experience is not published yet." };
    artistId = (exp.artist_id as string | null) ?? null;
    offer = ((exp.metadata as Record<string, unknown> | null)?.offer ?? {}) as typeof offer;
  }

  let invited = 0;
  let skippedNotFree = 0;
  try {
    // Cancel what belonged to the previous experience on this stop.
    if (stop.experience_id && stop.experience_id !== experienceId) {
      await db`
        UPDATE service_commissions SET status = 'cancelled', updated_at = NOW()
        WHERE stop_id = ${stopId} AND experience_thread_id = ${stop.experience_id as string} AND status IN ('proposed','accepted')
      `;
    }
    await db`UPDATE tour_stops SET experience_id = ${experienceId} WHERE id = ${stopId}`;

    if (experienceId && artistId) {
      const stops = (await db`SELECT id, position FROM tour_stops WHERE thread_id = ${stop.thread_id as string} ORDER BY position`) as unknown as Row[];
      const deps = (await db`
        SELECT id, starts_at FROM ${departuresSql()} d
        WHERE thread_id = ${stop.thread_id as string} AND org_id = ${ORG} AND starts_at > NOW() AND status <> 'cancelled' ORDER BY starts_at
      `) as unknown as Row[];
      const feeCents = typeof offer.onTour?.fee === "number" ? Math.round(offer.onTour.fee * 100) : null;
      const unit = offer.onTour?.unit === "per_guest" ? "per_guest" : "per_run";
      const tourInfo = { durationMinutes: stop.duration_minutes == null ? null : Number(stop.duration_minutes), stops: stops.map((s) => ({ id: s.id as string, position: Number(s.position) })) };
      for (const d of deps) {
        const startsAt = new Date(d.starts_at as string).toISOString();
        const arrivalAt = stopArrivalTimes(tourInfo, { startsAt }).find((t) => t.stopId === stopId)?.arrivalAt ?? startsAt;
        if (!(await artistFreeAt(artistId, arrivalAt))) { skippedNotFree++; continue; }
        const rows = (await db`
          INSERT INTO service_commissions (service_thread_id, seller_user_id, buyer_org_id, requested_by, experience_thread_id, tour_thread_id,
                                           departure_id, stop_id, arrival_at, unit, quantity, price_cents, currency)
          SELECT NULL, ${artistId}, ${ORG}, ${viewer.userId}, ${experienceId}, ${stop.thread_id as string},
                 ${d.id as string}, ${stopId}, ${arrivalAt}, ${unit}, 1, ${feeCents}, ${siteConfig.currency}
          WHERE NOT EXISTS (
            SELECT 1 FROM service_commissions x
            WHERE x.experience_thread_id = ${experienceId} AND x.departure_id = ${d.id as string} AND x.status IN ('proposed','accepted')
          )
          RETURNING id
        `) as unknown as Row[];
        if (rows[0]) invited++;
      }
    }
  } catch (err) {
    console.error("[elktours] linkExperienceToStopAction:", err);
    return { ok: false, error: "Could not link the experience. Try again." };
  }
  revalidateAll(stop.slug as string);
  return { ok: true, invited, skippedNotFree };
}

/** One manual "+ Invite" for a run the artist is free for (or the guide chooses anyway). Editors only. */
export async function inviteForDepartureAction(stopId: string, departureId: string): Promise<Result<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only guides and the office can do this." };
  if (!UUID.test(stopId) || !UUID.test(departureId)) return { ok: false, error: "Not found." };
  if (!(await invitationColumnsExist())) return { ok: false, error: "available after migration" };
  const [s] = (await db`
    SELECT s.id, s.thread_id, s.experience_id, t.slug, t.author_id, t.duration_minutes,
      (SELECT ep.user_id FROM experience_people ep WHERE ep.thread_id = s.experience_id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_id,
      (SELECT e.metadata->'offer'->'onTour' FROM threads e WHERE e.id = s.experience_id) AS on_tour
    FROM tour_stops s JOIN threads t ON t.id = s.thread_id WHERE s.id = ${stopId} AND s.org_id = ${ORG}
  `) as unknown as Row[];
  if (!s || !s.experience_id || !s.artist_id) return { ok: false, error: "This stop has no experience with an artist." };
  if (viewer.role !== "owner" && s.author_id !== viewer.userId) return { ok: false, error: "That is not your tour." };
  const [d] = (await db`SELECT id, starts_at FROM ${departuresSql()} d WHERE id = ${departureId} AND thread_id = ${s.thread_id as string} AND org_id = ${ORG} AND starts_at > NOW() AND status <> 'cancelled'`) as unknown as Row[];
  if (!d) return { ok: false, error: "That date is not open." };
  const stops = (await db`SELECT id, position FROM tour_stops WHERE thread_id = ${s.thread_id as string}`) as unknown as Row[];
  const arrivalAt = stopArrivalTimes(
    { durationMinutes: s.duration_minutes == null ? null : Number(s.duration_minutes), stops: stops.map((x) => ({ id: x.id as string, position: Number(x.position) })) },
    { startsAt: new Date(d.starts_at as string).toISOString() }
  ).find((t) => t.stopId === stopId)?.arrivalAt ?? null;
  const onTour = (s.on_tour ?? {}) as { fee?: number; unit?: string };
  const rows = (await db`
    INSERT INTO service_commissions (service_thread_id, seller_user_id, buyer_org_id, requested_by, experience_thread_id, tour_thread_id,
                                     departure_id, stop_id, arrival_at, unit, quantity, price_cents, currency)
    SELECT NULL, ${s.artist_id as string}, ${ORG}, ${viewer.userId}, ${s.experience_id as string}, ${s.thread_id as string},
           ${departureId}, ${stopId}, ${arrivalAt}, ${onTour.unit === "per_guest" ? "per_guest" : "per_run"}, 1,
           ${typeof onTour.fee === "number" ? Math.round(onTour.fee * 100) : null}, ${siteConfig.currency}
    WHERE NOT EXISTS (
      SELECT 1 FROM service_commissions x
      WHERE x.experience_thread_id = ${s.experience_id as string} AND x.departure_id = ${departureId} AND x.status IN ('proposed','accepted')
    )
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "That date already has an invitation." };
  revalidateAll(s.slug as string);
  return { ok: true, id: rows[0].id as string };
}

/** The artist answers an invitation addressed to them. */
export async function respondInvitationAction(id: string, answer: "accept" | "decline"): Promise<Result<{ status: "accepted" | "declined" }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!UUID.test(id)) return { ok: false, error: "Not found." };
  if (answer !== "accept" && answer !== "decline") return { ok: false, error: "Unknown answer." };
  try {
    const status = answer === "accept" ? "accepted" : "declined";
    await respondCommission(id, viewer.userId, status);
    revalidateAll();
    return { ok: true, status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "This invitation cannot be answered." };
  }
}
