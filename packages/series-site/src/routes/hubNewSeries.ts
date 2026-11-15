import { NextRequest, NextResponse } from "next/server";
import { createSiteSeries } from "@elkdonis/services";
import type { SeriesSite } from "../config";
import { apiMember } from "../config";

export function hubNewSeriesRoutes(site: SeriesSite) {

/**
 * Start a new series from the planner's "+ New series" tab.
 *
 * Organisers only (guide, owner), the same people who may publish a dated
 * thing from Compose. What it makes is what Compose › Meeting › Series makes
 * (`createSeries` in lib/cms/actions.ts): a `series` thread, its weekly
 * schedule, its settings and a calendar entry, so the planner opens on it at
 * once. The planner reads PUBLISHED series only, so the thread is published.
 *
 * It is created UNLISTED (`listed: false`, `landing: false`): it does not
 * appear on the public Series page or in the landing slides until an organiser
 * lists it in its own settings. Its weeks are all drafts until written and
 * published, so nothing is public beyond the empty series page. The series is
 * from the form's schedule; the planner's "+ New series" tab then applies the
 * rest of its form (about, cover, colour, listing, joining) to the new id
 * through `/api/hub/series`.
 *
 * POST { title, lede?, firstDate: "YYYY-MM-DD", time: "HH:MM", timeZone,
 *        weekday?: 0-6 (default: the first date's), intervalWeeks?: 1-4, monthly?: boolean,
 *        lastDate?: "YYYY-MM-DD", alsoZones?: string[], durationMinutes? }
 *   or, for a series on chosen dates (2026-11-14, `recurrence_pattern` CUSTOM):
 *      { title, lede?, timeZone, dates: ["YYYY-MM-DDTHH:MM", ...] (1-60, in the zone),
 *        alsoZones?, durationMinutes? }  (no firstDate/time/weekday/lastDate)
 *   → { ok, id, slug, href, warnings }
 */

async function POST(request: NextRequest) {
  const viewer = await apiMember(site);
  if (!viewer?.canEdit) return NextResponse.json({ error: "Only organisers can start a series." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const result = await createSiteSeries(
    viewer.userId,
    site.orgId,
    {
      title: str(body.title) ?? "",
      lede: str(body.lede) ?? null,
      timeZone: str(body.timeZone) ?? "",
      durationMinutes: Number(body.durationMinutes ?? 60),
      firstDate: str(body.firstDate),
      time: str(body.time),
      weekday: body.weekday === undefined || body.weekday === null ? null : Number(body.weekday),
      intervalWeeks: Number(body.intervalWeeks ?? 1),
      monthly: body.monthly === true,
      lastDate: str(body.lastDate) ?? null,
      dates: Array.isArray(body.dates) ? (body.dates as unknown[]).map((d) => (typeof d === "string" ? d : "")) : undefined,
      alsoZones: Array.isArray(body.alsoZones) ? (body.alsoZones as unknown[]).map((z) => (typeof z === "string" ? z : "")) : null,
    },
    site.alsoZones
  );
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: result.status });
  const { id, slug, warnings } = result.value;
  return NextResponse.json({ ok: true, id, slug, href: `/hub/series/${id}`, warnings });
}

  return { POST };
}
