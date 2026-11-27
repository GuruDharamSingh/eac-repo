"use server";

import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { listOrgDepartures } from "@/lib/departures";
import { getTourById, listGuides, listTours, type Tour } from "@/lib/tours";
import { listTourStops, type TourStop } from "@elkdonis/commerce/server";
import { db } from "@elkdonis/db";
import { getTourBookingDefaults, loadTours, type TourBookingDefaults } from "@/lib/tour-slots";
import { parisDayOf, parisTimeOf, parisToday } from "@/lib/schedule-plan";
import { getPlace, listPlaces } from "@/lib/places";
import type { Place } from "@/lib/catalogue-types";

/**
 * Reads for the hub's office popups (components/office/*). Writes go through the existing actions
 * (slot-actions createSlots, tour-actions, custom-place-actions), which keep their own checks.
 */

export interface ScheduleSheetTour {
  id: string;
  title: string;
  published: boolean;
  authorId: string | null;
  durationMinutes: number;
  minToRun: number | null;
  closeBeforeMinutes: number;
}

export interface ScheduleSheetSlot {
  id: string;
  tourId: string;
  tourTitle: string;
  /** Paris day YYYY-MM-DD and wall-clock HH:MM. */
  day: string;
  time: string;
  status: "scheduled" | "cancelled";
  seatsTaken: number;
  capacity: number;
  guideName: string | null;
}

export interface ScheduleSheet {
  today: string;
  isOwner: boolean;
  /** The viewer, when a guide: they schedule their own tours and lead them. */
  selfGuideId: string | null;
  tours: ScheduleSheetTour[];
  /** Upcoming runs for the next six months (a standing listing reaches that far), cancelled included (the calendar marks them). */
  slots: ScheduleSheetSlot[];
  /** Owners assign a guide; null for a guide. */
  guides: Array<{ id: string; name: string }> | null;
}

export async function getScheduleSheet(): Promise<ScheduleSheet> {
  const viewer = await requireOrgEditor();
  const isOwner = viewer.role === "owner";
  const from = new Date();
  const to = new Date(from.getTime() + 190 * 24 * 3600_000);
  const [tours, departures, guides] = await Promise.all([
    loadTours(),
    listOrgDepartures(siteConfig.orgId, { from, to, includeCancelled: true }).catch(() => [] as Awaited<ReturnType<typeof listOrgDepartures>>),
    isOwner ? listGuides().catch(() => []) : Promise.resolve(null),
  ]);
  const list = [...tours.values()]
    .filter((t) => !t.archived && (isOwner || t.authorId == null || t.authorId === viewer.userId))
    .sort((a, b) => Number(b.published) - Number(a.published) || a.title.localeCompare(b.title))
    .map((t) => ({
      id: t.id,
      title: t.title,
      published: t.published,
      authorId: t.authorId ?? null,
      durationMinutes: t.durationMinutes,
      minToRun: t.defaults.minToRun,
      closeBeforeMinutes: t.defaults.closeBeforeMinutes,
    }));
  return {
    today: parisToday(),
    isOwner,
    selfGuideId: isOwner ? null : viewer.userId,
    tours: list,
    slots: departures.map((d): ScheduleSheetSlot => ({
      id: d.id,
      tourId: d.threadId,
      tourTitle: d.tourTitle,
      day: parisDayOf(d.startsAt),
      time: parisTimeOf(d.startsAt),
      status: d.status === "cancelled" ? "cancelled" : "scheduled",
      seatsTaken: d.seatsTaken,
      capacity: d.capacity,
      guideName: d.guideName,
    })),
    guides: guides ? guides.map((g) => ({ id: g.id, name: g.name })) : null,
  };
}

/** A place for the Add place popup's second step: the record and its website (hand-set first, then found links). */
export async function getPlaceSheet(placeId: string): Promise<{ place: Place; website: string | null } | null> {
  await requireOrgEditor();
  const p = await getPlace(placeId);
  if (!p) return null;
  const website = p.links.find((l) => l.kind === "website")?.url ?? null;
  return { place: p, website };
}

/** The places, for the Add place popup's "Catalogue of places" view: title, address, tags, who made it. */
export async function listPlaceSheet(q?: string): Promise<Array<{ id: string; title: string; address: string | null; tags: string[]; lat: number | null; lng: number | null }>> {
  await requireOrgEditor();
  const rows = await listPlaces({ q: q ?? undefined, limit: 300 }).catch(() => []);
  return rows
    .filter((p) => !p.archivedAt)
    .map((p) => ({ id: p.id, title: p.title, address: p.address ?? null, tags: p.tags, lat: p.lat ?? null, lng: p.lng ?? null }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// ── Create Tour wizard (components/office/create-tour) ─────────────────────

export interface TourSheet {
  tour: Tour;
  /** Stops in order, guide notes included (editors only). */
  stops: TourStop[];
  /** tour_stops.excerpt by stop id (the short line the tour page shows); TourStop does not carry the column. Only stops with one are listed. */
  excerpts: Record<string, string>;
  /** Minimum to run, cutoff and waitlist size shared by the tour's dates; null when they could not be read. */
  bookingDefaults: TourBookingDefaults | null;
}

/** One tour and its stops for the wizard. Guides open only tours they wrote; owners any. */
export async function getTourSheet(tourId: string): Promise<TourSheet | null> {
  const viewer = await requireOrgEditor();
  const tour = await getTourById(tourId);
  if (!tour) return null;
  if (viewer.role !== "owner" && tour.authorId !== viewer.userId) return null;
  const stops = await listTourStops(tour.id).catch(() => [] as TourStop[]);
  const rows = (await db`SELECT id, excerpt FROM tour_stops WHERE thread_id = ${tour.id} AND org_id = ${siteConfig.orgId} AND excerpt IS NOT NULL`.catch(
    () => []
  )) as unknown as { id: string; excerpt: string }[];
  const excerpts: Record<string, string> = {};
  for (const r of rows) excerpts[r.id] = r.excerpt;
  const bookingDefaults = await getTourBookingDefaults(tour.id).catch(() => null);
  return { tour, stops, excerpts, bookingDefaults };
}

/** Tours the viewer may open in the wizard, drafts and published (owners: every one; guides: their own). */
export async function listEditableTourSheet(): Promise<Array<{ id: string; title: string; published: boolean }>> {
  const viewer = await requireOrgEditor();
  const tours = await listTours({ includeDrafts: true }).catch(() => [] as Tour[]);
  return tours
    .filter((t) => viewer.role === "owner" || t.authorId === viewer.userId)
    .map((t) => ({ id: t.id, title: t.title, published: t.status === "published" }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export interface NearbyPlace {
  id: string;
  title: string;
  lat: number;
  lng: number;
  address: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  tags: string[];
}

/** Our places around a point (Route step map), nearest first. */
export async function nearbyPlaceSheet(lat: number, lng: number, radiusM = 1500): Promise<NearbyPlace[]> {
  await requireOrgEditor();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const rows = await listPlaces({ near: { lat, lng, radiusM: Math.min(Math.max(radiusM, 100), 5000) }, limit: 80 }).catch(() => []);
  return rows
    .filter((p) => !p.archivedAt && p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      title: p.title,
      lat: p.lat!,
      lng: p.lng!,
      address: p.address ?? null,
      excerpt: p.excerpt ?? null,
      imageUrl: (p as { imageUrl?: string | null }).imageUrl ?? null,
      tags: p.tags,
    }));
}
