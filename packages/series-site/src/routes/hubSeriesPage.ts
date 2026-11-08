import { NextRequest, NextResponse } from "next/server";
import { getSeriesPageSettings, listSeriesForPage, saveSeriesPageSettings } from "@elkdonis/services";
import type { SeriesSite } from "../config";
import { apiMember } from "../config";
import { readerOf } from "../lib/series";

export function hubSeriesPageRoutes(site: SeriesSite) {

/**
 * The public Series page's settings (2026-10-18): the eyebrow, heading and
 * introduction at the top of /series, the order of the series and which one
 * is featured (also first in the landing slides). Members read; organisers
 * (guide, owner) write. See packages/services/src/series-page.ts.
 */

async function GET() {
  const viewer = await apiMember(site);
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });
  const settings = await getSeriesPageSettings(site.orgId);
  const entries = await listSeriesForPage(site.orgId, { count: 6, settings, viewer: await readerOf(site) });
  return NextResponse.json({
    settings,
    canEdit: viewer.canEdit,
    series: entries.map((e) => ({
      id: e.series.id,
      title: e.series.title,
      href: `/series/${e.series.slug}`,
      plannerHref: `/hub/series/${e.series.id}`,
      cover: e.series.cover,
      accent: e.accent.mark,
      listed: e.listed,
      featured: e.featured,
      ended: e.ended,
      upcoming: e.upcoming,
      published: e.series.sessions.filter((s) => s.isPublished && !s.isPast).length,
    })),
  });
}

async function POST(request: NextRequest) {
  const viewer = await apiMember(site);
  if (!viewer) return NextResponse.json({ error: "Members only" }, { status: 403 });
  if (!viewer.canEdit) return NextResponse.json({ error: "Only an organiser can change the Series page." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    eyebrow?: unknown;
    heading?: unknown;
    introHtml?: unknown;
    order?: unknown;
    featuredId?: unknown;
  };
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  try {
    const settings = await saveSeriesPageSettings({
      orgId: site.orgId,
      eyebrow: str(body.eyebrow),
      heading: str(body.heading),
      introHtml: str(body.introHtml),
      order: Array.isArray(body.order) ? body.order.filter((x): x is string => typeof x === "string") : undefined,
      featuredId: body.featuredId === null ? null : str(body.featuredId),
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

  return { GET, POST };
}
