"use server";

import { getTourBySlug, loadTourFull } from "@/lib/tours";
import { buildMobileTour } from "./mobile-tour";
import type { TourQuick } from "@/components/surfaces/tour-quick-types";

const plain = (html: string | null | undefined) =>
  (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "\u2019").replace(/\s+/g, " ").trim();

/** The quick overview behind a tour card tap on the phone. Public: published, PUBLIC tours only (getTourBySlug). */
export async function tourQuickAction(slug: string): Promise<TourQuick | null> {
  if (typeof slug !== "string" || !slug || slug.length > 200) return null;
  try {
    const base = await getTourBySlug(slug);
    if (!base) return null;
    const m = await buildMobileTour(await loadTourFull(base, { upcomingOnly: true }));
    const text = plain(m.bodyHtml);
    return {
      slug: m.slug,
      title: m.title,
      typeLabel: m.typeLabel ?? null,
      cover: m.hero.photos[0]?.url ?? m.hero.map?.cover ?? m.hero.film?.poster ?? null,
      guide: m.guide ? { name: m.guide.name, craft: m.guide.craft, photo: m.guide.photo } : null,
      facts: m.facts,
      blurb: text ? (text.length > 360 ? `${text.slice(0, 360).replace(/\s+\S*$/, "")}\u2026` : text) : null,
      slots: m.slots,
      priced: m.priced,
      hasRoute: m.stops.length > 0,
    };
  } catch {
    return null;
  }
}
