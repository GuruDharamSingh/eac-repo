"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { createDeparture } from "@elkdonis/commerce/server";
import { requireOrgEditor } from "@/lib/auth";
import { getTourById } from "@/lib/tours";
import type { ActionResult } from "@/lib/tour-actions";
import { checkRepeatInput, parisInstant, planRepeat, type RepeatPlan, type RepeatPlanInput } from "@/lib/schedule-plan";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;

const repeatSchema = z.object({
  tourId: z.string().min(1, "Pick a tour"),
  weekdays: z.array(z.coerce.number().int()).max(7),
  times: z.array(z.string().trim()).max(8, "At most eight start times"),
  from: z.string(),
  to: z.string(),
  capacity: z.coerce.number().int().min(1, "At least one place").max(500),
  guideUserId: z.string().optional().or(z.literal("")),
});
export type RepeatScheduleValues = z.input<typeof repeatSchema>;

interface RepeatRequest extends RepeatPlanInput {
  tourId: string;
  capacity: number;
  guideUserId: string | null;
}

type Prepared = { error: string } | { plan: RepeatPlan; tour: { id: string; slug: string }; data: RepeatRequest };

/** Validate, then plan against the tour's scheduled departures in the range. */
async function prepare(input: RepeatScheduleValues): Promise<Prepared> {
  const parsed = repeatSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const p = parsed.data;
  const d: RepeatRequest = {
    tourId: p.tourId,
    weekdays: p.weekdays ?? [],
    times: p.times ?? [],
    from: p.from,
    to: p.to,
    capacity: p.capacity,
    guideUserId: p.guideUserId || null,
  };
  const bad = checkRepeatInput(d);
  if (bad) return { error: bad };
  const tour = await getTourById(d.tourId);
  if (!tour) return { error: "That tour is not on this site." };
  const from = parisInstant(d.from)!;
  const to = parisInstant(d.to, "23:59")!;
  const rows = await db<{ starts_at: Date }[]>`
    SELECT starts_at FROM tour_departures
    WHERE org_id = ${ORG} AND thread_id = ${tour.id} AND status = 'scheduled'
      AND starts_at >= ${from.toISOString()}::timestamptz AND starts_at <= ${to.toISOString()}::timestamptz
  `;
  const existing = new Set(rows.map((r) => new Date(r.starts_at).getTime()));
  return { plan: planRepeat(d, existing), tour: { id: tour.id, slug: tour.slug }, data: d };
}

/** The dates a repeat request would create, without writing anything. */
export async function previewScheduleAction(input: RepeatScheduleValues): Promise<ActionResult<{ plan: RepeatPlan }>> {
  await requireOrgEditor();
  try {
    const p = await prepare(input);
    if (!("plan" in p)) return { ok: false, error: p.error };
    return { ok: true, plan: p.plan };
  } catch (err) {
    console.error("[elktours] previewScheduleAction:", err);
    return { ok: false, error: "Could not work out the dates." };
  }
}

/**
 * Create the planned departures. Re-plans on the server, so a slot added
 * elsewhere since the preview is skipped rather than doubled.
 */
export async function createScheduleAction(input: RepeatScheduleValues): Promise<ActionResult<{ added: number; skipped: number; overCap: number }>> {
  await requireOrgEditor();
  let added = 0;
  try {
    const p = await prepare(input);
    if (!("plan" in p)) return { ok: false, error: p.error };
    const todo = p.plan.items.filter((i) => i.status === "new");
    if (todo.length === 0) return { ok: false, error: "Nothing new to create: every slot is past or already scheduled." };
    for (const item of todo) {
      await createDeparture(ORG, p.tour.id, {
        startsAt: new Date(item.startsAt),
        capacity: p.data.capacity,
        guideUserId: p.data.guideUserId,
      });
      added += 1;
    }
    revalidateSchedule(p.tour.slug);
    return { ok: true, added, skipped: p.plan.existing + p.plan.past, overCap: p.plan.overCap };
  } catch (err) {
    console.error("[elktours] createScheduleAction:", err);
    revalidateSchedule();
    const msg = err instanceof Error ? err.message : "Could not create the departures.";
    return { ok: false, error: added ? `${added} created, then: ${msg}` : msg };
  }
}

function revalidateSchedule(slug?: string) {
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath("/manage/tours");
  revalidatePath("/manage/schedule");
  revalidatePath("/manage/bookings");
  if (slug) revalidatePath(`/tours/${slug}`);
}
