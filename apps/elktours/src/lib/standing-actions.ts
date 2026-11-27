"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getOfferByThread } from "@elkdonis/checkout/booking-server";
import { requireOrgEditor, type Viewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { listGuides } from "@/lib/tours";
import type { ActionResult } from "@/lib/tour-actions";
import { loadTours } from "@/lib/tour-slots";
import { previewSlots } from "@/lib/slot-actions";
import { fixturesOn, PREVIEW_REFUSAL } from "@/lib/tour-slot-fixtures";
import { checkStandingShape, getStandingRule, materialiseRule, standingStarts } from "@/lib/standing-rules";

/**
 * Standing listings (2026-11-24): save, preview, list and stop standing rules. The rule and the slots it makes are
 * described in lib/standing-rules.ts. Same access as slot-actions: a guide acts on their own tours, owners on all.
 */

const ORG = siteConfig.orgId;

export interface StandingInput {
  tourId: string;
  /** ISO weekdays, Mon = 1 … Sun = 7. */
  weekdays: number[];
  /** HH:MM Paris wall clock, at most four. */
  times: string[];
  maxPlaces: number;
  /** Days ahead to keep runs made, 1 to 183 (six months). */
  aheadDays: number;
  /** Last day of the listing, YYYY-MM-DD; null = open-ended. */
  validUntil?: string | null;
  /** Null or omitted = the tour's author. Guides always lead their own. */
  guideUserId?: string | null;
}

export interface StandingRuleRow {
  id: string;
  tourId: string;
  tourTitle: string;
  weekdays: number[];
  times: string[];
  capacity: number;
  aheadDays: number;
  validUntil: string | null;
  guideName: string | null;
  active: boolean;
  /** Scheduled runs this rule has made that are still ahead. */
  upcoming: number;
}

async function resolve(input: StandingInput, viewer: Viewer): Promise<{ error: string } | { guideId: string | null; tourId: string; tourSlug: string; tourTitle: string }> {
  const tour = (await loadTours()).get(input.tourId);
  if (!tour) return { error: "That tour is not on this site." };
  if (viewer.role !== "owner" && tour.authorId !== viewer.userId) return { error: "That is not your tour." };
  let guideId: string | null = viewer.role === "owner" ? input.guideUserId || null : viewer.userId;
  if (guideId) {
    const guides = await listGuides();
    if (!guides.some((g) => g.id === guideId)) return { error: "That guide is not on this site." };
  }
  const bad = checkStandingShape({
    weekdays: input.weekdays ?? [],
    times: input.times ?? [],
    capacity: Math.floor(Number(input.maxPlaces)),
    aheadDays: Math.floor(Number(input.aheadDays)),
    validFrom: null,
    validUntil: input.validUntil ?? null,
  });
  if (bad) return { error: bad };
  guideId = guideId || null;
  return { guideId, tourId: tour.id, tourSlug: tour.slug, tourTitle: tour.title };
}

function revalidate(slug?: string) {
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath("/manage/tours");
  revalidatePath("/manage/schedule");
  if (slug) revalidatePath(`/tours/${slug}`);
}

export interface StandingPreview {
  /** Runs that would be made now. */
  runs: number;
  /** Starts that already have a run. */
  existing: number;
  /** Runs that overlap another run of the same guide (still made). */
  clashes: number;
  /** The first few overlaps, "Sat 12 Dec 10:00: Clashes with Latin Quarter at 10:00". */
  clashSamples: string[];
  /** Last day covered. */
  through: string;
}

/** What saving a rule would make today, with overlaps. Writes nothing. */
export async function previewStandingRule(input: StandingInput): Promise<ActionResult<{ preview: StandingPreview }>> {
  const viewer = await requireOrgEditor();
  try {
    const r = await resolve(input, viewer);
    if ("error" in r) return { ok: false, error: r.error };
    const shape = { weekdays: input.weekdays, times: input.times, validFrom: null, validUntil: input.validUntil ?? null, aheadDays: Math.floor(Number(input.aheadDays)) };
    const starts = standingStarts(shape);
    if (starts.length === 0) return { ok: true, preview: { runs: 0, existing: 0, clashes: 0, clashSamples: [], through: "" } };
    const days = [...new Set(starts.map((s) => s.day))];
    const p = await previewSlots({
      tourId: r.tourId,
      dates: days,
      times: [...new Set(input.times)],
      maxPlaces: Math.floor(Number(input.maxPlaces)),
      guideUserId: r.guideId,
    });
    if (!p.ok) return { ok: false, error: p.error };
    const clash = p.preview.items.filter((i) => i.ok && i.reason === "clash");
    return {
      ok: true,
      preview: {
        runs: p.preview.ready,
        existing: p.preview.items.filter((i) => i.reason === "exists").length,
        clashes: p.preview.clashes,
        clashSamples: clash.slice(0, 3).map((i) => `${i.day} ${i.time}: ${i.message ?? "overlaps another run"}`),
        through: starts[starts.length - 1]!.day,
      },
    };
  } catch (err) {
    console.error("[elktours] previewStandingRule:", err);
    return { ok: false, error: "Could not work out the runs." };
  }
}

/** Save a standing rule and make its runs now. The daily top-up keeps them made up to the horizon. */
export async function saveStandingRule(input: StandingInput): Promise<ActionResult<{ ruleId: string; created: number; skipped: number; through: string }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  try {
    const r = await resolve(input, viewer);
    if ("error" in r) return { ok: false, error: r.error };
    const offer = await getOfferByThread(ORG, r.tourId);
    if (!offer || offer.mode !== "set_dates") return { ok: false, error: "This tour has no booking set-up yet." };
    const times = [...new Set(input.times)].sort();
    const weekdays = [...new Set(input.weekdays)].sort();
    const rows = await db<{ id: string }[]>`
      INSERT INTO booking_standing_rules (offer_id, org_id, weekdays, times, capacity, guide_user_id, valid_until, ahead_days, created_by)
      VALUES (${offer.id}, ${ORG}, ${db.array(weekdays)}::smallint[], ${db.array(times)}, ${Math.floor(Number(input.maxPlaces))}, ${r.guideId},
              ${input.validUntil ?? null}, ${Math.floor(Number(input.aheadDays))}, ${viewer.userId})
      RETURNING id
    `;
    const id = rows[0]!.id;
    const rule = await getStandingRule(id);
    if (!rule) return { ok: false, error: "Could not save the standing listing." };
    let made;
    try {
      made = await materialiseRule(rule);
    } catch (err) {
      // The rule is saved; the hourly top-up retries the runs.
      console.error("[elktours] saveStandingRule: materialise:", err);
      revalidate(r.tourSlug);
      return { ok: false, error: "The standing listing is saved, but its runs could not be made yet. They are retried every hour." };
    }
    revalidate(r.tourSlug);
    return { ok: true, ruleId: id, created: made.created, skipped: made.skipped, through: made.through };
  } catch (err) {
    console.error("[elktours] saveStandingRule:", err);
    return { ok: false, error: "Could not save the standing listing." };
  }
}

/** The site's standing rules the viewer may manage, newest first. */
export async function listStandingRules(): Promise<ActionResult<{ rules: StandingRuleRow[] }>> {
  const viewer = await requireOrgEditor();
  try {
    const tours = await loadTours();
    const rows = await db<
      Array<{ id: string; thread_id: string; weekdays: number[]; times: string[]; capacity: number; ahead_days: number; valid_until: string | Date | null; guide_name: string | null; active: boolean; upcoming: number }>
    >`
      SELECT r.id, o.thread_id, r.weekdays, r.times, r.capacity, r.ahead_days, r.valid_until, r.active,
             COALESCE(u.display_name, u.email) AS guide_name,
             (SELECT COUNT(*)::int FROM booking_slots s
               WHERE s.org_id = ${ORG} AND s.standing_rule_id = r.id AND s.status = 'scheduled' AND s.starts_at > NOW()) AS upcoming
      FROM booking_standing_rules r
      JOIN booking_offers o ON o.id = r.offer_id
      LEFT JOIN users u ON u.id = r.guide_user_id
      WHERE r.org_id = ${ORG} AND r.active
      ORDER BY r.created_at DESC
    `;
    const out: StandingRuleRow[] = [];
    for (const r of rows) {
      const tour = tours.get(r.thread_id);
      if (!tour) continue;
      if (viewer.role !== "owner" && tour.authorId !== viewer.userId) continue;
      out.push({
        id: r.id,
        tourId: r.thread_id,
        tourTitle: tour.title,
        weekdays: r.weekdays.map(Number),
        times: r.times,
        capacity: r.capacity,
        aheadDays: r.ahead_days,
        validUntil: r.valid_until == null ? null : typeof r.valid_until === "string" ? r.valid_until.slice(0, 10) : r.valid_until.toISOString().slice(0, 10),
        guideName: r.guide_name,
        active: r.active,
        upcoming: Number(r.upcoming),
      });
    }
    return { ok: true, rules: out };
  } catch (err) {
    // Migration 291 not applied yet: no rules to show.
    if ((err as { code?: string }).code === "42P01") return { ok: true, rules: [] };
    console.error("[elktours] listStandingRules:", err);
    return { ok: false, error: "Could not load the standing listings." };
  }
}

/**
 * Stop a standing rule: no more runs are made. Runs already made stay, with their bookings; `removeEmpty` also deletes
 * the rule's future runs that nobody has booked (a run with any booking is kept).
 */
export async function stopStandingRule(id: string, opts: { removeEmpty?: boolean } = {}): Promise<ActionResult<{ removed: number }>> {
  const viewer = await requireOrgEditor();
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  try {
    const rule = await getStandingRule(id);
    if (!rule) return { ok: false, error: "That standing listing is not on this site." };
    const tour = (await loadTours()).get(rule.tourId);
    if (!tour) return { ok: false, error: "That tour is not on this site." };
    if (viewer.role !== "owner" && tour.authorId !== viewer.userId) return { ok: false, error: "That is not your tour." };
    await db`UPDATE booking_standing_rules SET active = FALSE, updated_at = NOW() WHERE id = ${id} AND org_id = ${ORG}`;
    let removed = 0;
    if (opts.removeEmpty) {
      const gone = await db<{ id: string }[]>`
        DELETE FROM booking_slots s
        WHERE s.org_id = ${ORG} AND s.standing_rule_id = ${id} AND s.status = 'scheduled' AND s.starts_at > NOW()
          AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id)
        RETURNING s.id
      `;
      removed = gone.length;
    }
    revalidate(tour.slug);
    return { ok: true, removed };
  } catch (err) {
    console.error("[elktours] stopStandingRule:", err);
    return { ok: false, error: "Could not stop the standing listing." };
  }
}
