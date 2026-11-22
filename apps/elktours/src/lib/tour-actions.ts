"use server";

import { ensureFolderSoon } from "@/lib/media-folders";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug } from "@elkdonis/services";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { slugifyTitle } from "@/lib/cms/schema";
import {
  saveTourStops,
  type TourStopInput,
} from "@elkdonis/commerce/server";
import { bookingAvailability, publicOriginFrom, startBookingCheckout, startTourCheckout } from "@elkdonis/checkout/booking";
import { getOfferByThread, saveOffer } from "@elkdonis/checkout/booking-server";
import { closedAlready } from "@elkdonis/checkout/booking-core";
import { cancelDeparture, cancelTourBooking, createDeparture, getDeparture, removeCancelledDeparture, updateDeparture } from "@/lib/departures";
import { getViewer, requireOrgEditor } from "@/lib/auth";
import { bookingTablesOn, getTourBookingDefaults } from "@/lib/tour-slots";
import { PREVIEW_REFUSAL, fixturesOn } from "@/lib/tour-slot-fixtures";
import { parisInputToDate } from "@/lib/format";
import { getTourById, getTourBySlug, type TourDetails, type TourRoute } from "@/lib/tours";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;

export type ActionResult<T = unknown> = ({ ok: true; error?: undefined } & T) | { ok: false; error: string };

// ── the tour itself ───────────────────────────────────────────────────────

const lines = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(/\r?\n/)).map((s) => s.trim()).filter(Boolean).slice(0, 30));

const optNum = (lo: number, hi: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().min(lo).max(hi).optional()
  );

const tourFormSchema = z.object({
  title: z.string().trim().min(2, "Give the tour a title").max(200),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  body: z.string().optional().or(z.literal("")),
  coverImageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  price: optNum(0, 100000),
  durationMinutes: optNum(0, 24 * 60),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  meetingLat: optNum(-90, 90),
  meetingLng: optNum(-180, 180),
  highlights: lines.default([]),
  includes: lines.default([]),
  languages: lines.default([]),
  maxParty: optNum(1, 20),
  effort: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
});
export type TourFormValues = z.input<typeof tourFormSchema>;

export async function saveTourAction(input: TourFormValues, threadId?: string): Promise<ActionResult<{ id: string; slug: string }>> {
  const editor = await requireOrgEditor();
  const parsed = tourFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;

  const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(d.title), threadId);
  const body = sanitizeRichText(d.body ?? "");
  const excerpt = deriveExcerpt(body, { explicit: d.excerpt });
  // The cached route belongs to the stops, not this form: carry it over on an edit.
  const existing = threadId ? await getTourById(threadId) : null;
  if (threadId && !existing) return { ok: false, error: "Not found" };
  const details: TourDetails = {
    highlights: d.highlights,
    includes: d.includes,
    languages: d.languages,
    meetingPoint: d.meetingLat != null && d.meetingLng != null ? { lat: d.meetingLat, lng: d.meetingLng } : null,
    maxParty: d.maxParty ?? null,
    effort: d.effort || null,
    route: existing?.details.route ?? null,
    // The form leaves the city out unless it shows it: keep the stored one then.
    city: d.city !== undefined ? d.city || null : existing?.details.city ?? null,
    // The dragged path belongs to the route step, not this form: carry it over.
    via: existing?.details.via ?? null,
  };
  // Keep keys other features write (cover, timeZone, …): merge, do not assign.
  const patch = JSON.parse(JSON.stringify({ ...(d.coverImageUrl ? { coverImageUrl: d.coverImageUrl } : {}), tour: details })) as Record<string, string>;
  const publishedAt = d.status === "published" ? new Date() : null;

  try {
    if (threadId) {
      await db`
        UPDATE threads SET
          title = ${d.title}, slug = ${slug}, body = ${body || null}, excerpt = ${excerpt},
          status = ${d.status}, price = ${d.price ?? null}, currency = ${siteConfig.currency},
          duration_minutes = ${d.durationMinutes ?? null}, location = ${d.location || null},
          metadata = (COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl') || ${db.json(patch)},
          published_at = COALESCE(published_at, ${publishedAt}), updated_at = NOW()
        WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
      `;
      const { refreshTourRoute } = await import("@/lib/tour-cache");
      await refreshTourRoute(threadId).catch(() => null);
      await ensureTourOffer(threadId, d.durationMinutes ?? null, d.maxParty ?? null);
      revalidateTour(slug);
      return { ok: true, id: threadId, slug };
    }
    const id = nanoid(21);
    await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility,
        metadata, price, currency, duration_minutes, location, format, published_at
      ) VALUES (
        ${id}, ${ORG}, ${editor.userId}, 'tour', ${siteConfig.toursFeed}, ${d.title}, ${slug},
        ${body || null}, ${excerpt}, ${d.status}, 'PUBLIC',
        ${db.json(patch)}, ${d.price ?? null}, ${siteConfig.currency},
        ${d.durationMinutes ?? null}, ${d.location || null}, 'in_person', ${publishedAt}
      )
    `;
    await ensureTourOffer(id, d.durationMinutes ?? null, d.maxParty ?? null);
    // Tours/<slug>/ and its Private/ in Nextcloud (2026-11-20); a storage failure does not fail the save.
    ensureFolderSoon("tour", id);
    revalidateTour(slug);
    return { ok: true, id, slug };
  } catch (err) {
    console.error("[elktours] saveTourAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
}

/**
 * A tour needs a set-dates booking offer before it can be given dates on the booking tables (createSlots refuses
 * "This tour has no booking set-up yet"). Migration 274 made one for every tour that existed on 2026-11-16; tours
 * created later had none (found 2026-11-19). Creates it with 274's defaults when missing; never changes an
 * existing offer. A failure is logged and does not fail the tour save.
 */
async function ensureTourOffer(threadId: string, durationMinutes: number | null, maxParty: number | null): Promise<void> {
  if (!bookingTablesOn()) return;
  try {
    if (await getOfferByThread(ORG, threadId)) return;
    const r = await saveOffer({
      orgId: ORG,
      threadId,
      offer: {
        mode: "set_dates",
        durationMinutes: durationMinutes && durationMinutes >= 5 ? durationMinutes : 120,
        timeZone: siteConfig.timeZone,
        capacityPerSlot: 8,
        minParty: 1,
        maxParty: maxParty ?? 20,
        priceUnit: "per_person",
        leadTimeMinutes: 0,
        closeBeforeMinutes: 0,
        maxAheadDays: 366,
        approval: "instant",
        status: "open",
      },
    });
    if (r.ok === false) console.error(`[elktours] ensureTourOffer(${threadId}):`, r.error);
  } catch (err) {
    console.error(`[elktours] ensureTourOffer(${threadId}):`, err);
  }
}

export async function setTourStatusAction(threadId: string, status: "draft" | "published" | "archived"): Promise<ActionResult> {
  await requireOrgEditor();
  try {
    await db`
      UPDATE threads SET status = ${status},
        published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
    `;
    revalidateTour();
    return { ok: true };
  } catch (err) {
    console.error("[elktours] setTourStatusAction:", err);
    return { ok: false, error: "Could not update." };
  }
}

export async function setTourPinnedAction(threadId: string, pinned: boolean): Promise<ActionResult> {
  await requireOrgEditor();
  await db`UPDATE threads SET pinned = ${pinned}, updated_at = NOW() WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'`;
  revalidateTour();
  return { ok: true };
}

// ── stops ─────────────────────────────────────────────────────────────────

export async function saveStopsAction(threadId: string, stops: TourStopInput[]): Promise<ActionResult<{ stills?: { made: number; skipped: number } }>> {
  await requireOrgEditor();
  try {
    const tour = await getTourById(threadId);
    if (!tour) return { ok: false, error: "Not found" };
    await saveTourStops(
      ORG,
      threadId,
      stops.slice(0, 60).map((s) => ({ ...s, body: s.body ? sanitizeRichText(s.body) : null, guideNotes: s.guideNotes ? sanitizeRichText(s.guideNotes) : null }))
    );
    // One routing call and one still per changed stop, here, so visitors never trigger either.
    const { ensureStopStills, refreshTourRoute } = await import("@/lib/tour-cache");
    const [stills] = await Promise.all([ensureStopStills(threadId), refreshTourRoute(threadId)]);
    revalidateTour(tour.slug);
    return { ok: true, stills };
  } catch (err) {
    console.error("[elktours] saveStopsAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the stops." };
  }
}

/**
 * The walking path's dragged points (Create Tour wizard, Route step): replaces `metadata.tour.via` and
 * recomputes the route through them. Keys are "<from>><to>" with "meet" or a stop id of this tour; up to 8
 * points per leg, inside the city's box. Owners any tour; guides the tours they wrote.
 */
export async function saveRouteViaAction(threadId: string, via: Record<string, [number, number][]>): Promise<ActionResult<{ route: TourRoute | null }>> {
  const viewer = await requireOrgEditor();
  const tour = await getTourById(threadId);
  if (!tour) return { ok: false, error: "Not found" };
  if (viewer.role !== "owner" && tour.authorId !== viewer.userId) return { ok: false, error: "That is not your tour." };
  const stopIds = new Set((await db`SELECT id::text FROM tour_stops WHERE thread_id = ${threadId} AND org_id = ${ORG}`).map((r) => (r as { id: string }).id));
  const okKey = (k: string) => {
    const [a, b, extra] = k.split(">");
    return extra === undefined && !!a && !!b && (a === "meet" || stopIds.has(a)) && stopIds.has(b);
  };
  const clean: Record<string, [number, number][]> = {};
  for (const [k, list] of Object.entries(via ?? {})) {
    if (!okKey(k) || !Array.isArray(list)) continue;
    const pts = list
      .filter((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "number" && Number.isFinite(x)))
      .filter(([lng, lat]) => Math.abs(lat - 48.86) < 0.6 && Math.abs(lng - 2.35) < 0.9)
      .slice(0, 8)
      .map(([lng, lat]) => [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as [number, number]);
    if (pts.length) clean[k] = pts;
  }
  try {
    await db`
      UPDATE threads SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tour,via}', ${db.json(clean as never)}, true), updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
    `;
    const { refreshTourRoute } = await import("@/lib/tour-cache");
    const route = await refreshTourRoute(threadId);
    revalidateTour(tour.slug);
    return { ok: true, route };
  } catch (err) {
    console.error("[elktours] saveRouteViaAction:", err);
    return { ok: false, error: "Could not save the path." };
  }
}

// ── departures ────────────────────────────────────────────────────────────

const departureSchema = z.object({
  /** `datetime-local`, Paris wall clock. */
  startsAt: z.string().min(1, "Pick a date and time"),
  capacity: z.coerce.number().int().min(1).max(500),
  guideUserId: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type DepartureFormValues = z.input<typeof departureSchema>;

export async function saveDepartureAction(threadId: string, input: DepartureFormValues, departureId?: string): Promise<ActionResult> {
  await requireOrgEditor();
  const parsed = departureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const startsAt = parisInputToDate(d.startsAt);
  if (!startsAt) return { ok: false, error: "The start time could not be read." };
  try {
    const tour = await getTourById(threadId);
    if (!tour) return { ok: false, error: "Not found" };
    const data = { startsAt, capacity: d.capacity, guideUserId: d.guideUserId || null, note: d.note || null };
    if (departureId) await updateDeparture(ORG, departureId, data);
    else await createDeparture(ORG, threadId, data);
    revalidateTour(tour.slug);
    return { ok: true };
  } catch (err) {
    console.error("[elktours] saveDepartureAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the departure." };
  }
}

/** Several dates at once — the same time on each picked day. */
export async function addDeparturesAction(
  threadId: string,
  input: { dates: string[]; time: string; capacity: number; guideUserId?: string | null }
): Promise<ActionResult<{ added: number }>> {
  await requireOrgEditor();
  const tour = await getTourById(threadId);
  if (!tour) return { ok: false, error: "Not found" };
  const dates = (input.dates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 60);
  if (dates.length === 0 || !/^\d{2}:\d{2}$/.test(input.time)) return { ok: false, error: "Pick at least one day and a time." };
  let added = 0;
  try {
    for (const day of dates) {
      const startsAt = parisInputToDate(`${day}T${input.time}`);
      if (!startsAt) continue;
      await createDeparture(ORG, threadId, { startsAt, capacity: input.capacity, guideUserId: input.guideUserId ?? null });
      added += 1;
    }
    revalidateTour(tour.slug);
    return { ok: true, added };
  } catch (err) {
    console.error("[elktours] addDeparturesAction:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not add the departures." };
  }
}

export async function cancelDepartureAction(departureId: string, message?: string): Promise<ActionResult<{ notified: number }>> {
  await requireOrgEditor();
  try {
    const r = await cancelDeparture(ORG, departureId, message ?? null);
    revalidateTour();
    return { ok: true, notified: r.notified };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel." };
  }
}

/** Owners only: delete a cancelled departure that no booking points at (see removeCancelledDeparture). */
export async function removeDepartureAction(departureId: string): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  if (viewer.role !== "owner") return { ok: false, error: "Only an owner can remove a departure." };
  try {
    await removeCancelledDeparture(ORG, departureId);
    revalidateTour();
    revalidatePath("/manage/schedule");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not remove." };
  }
}

export async function cancelBookingAction(bookingId: string, message?: string): Promise<ActionResult> {
  await requireOrgEditor();
  try {
    await cancelTourBooking(ORG, bookingId, message ?? null);
    revalidateTour();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel." };
  }
}

// ── booking (public) ──────────────────────────────────────────────────────

const bookSchema = z.object({
  tourSlug: z.string().min(1),
  departureId: z.string().uuid("Pick a departure"),
  partySize: z.coerce.number().int().min(1).max(20),
  name: z.string().trim().min(1, "Your name").max(120),
  email: z.string().trim().email("A valid email address"),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Create the card order and send the buyer to Stripe. Anyone may book; a
 * signed-in visitor's account is attached so the booking also shows on
 * their /account page. On success this redirects (never returns).
 */
export async function bookTourAction(input: z.input<typeof bookSchema>): Promise<ActionResult> {
  if (fixturesOn()) return { ok: false, error: PREVIEW_REFUSAL };
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const tour = await getTourBySlug(d.tourSlug);
  if (!tour) return { ok: false, error: "That tour is not available." };
  if (tour.details.maxParty && d.partySize > tour.details.maxParty) {
    return { ok: false, error: `This tour takes at most ${tour.details.maxParty} per booking.` };
  }
  const available = await bookingAvailability(tour.authorId);
  if (available.ok === false) {
    return { ok: false, error: available.reason === "no_card" ? "Card payments are not switched on yet." : "Booking opens once the guide has set up how they are paid." };
  }
  // Booking closes `closeBeforeMinutes` before the start (the tour's default; same words as quoteBooking).
  // (On the booking tables createBooking enforces it, with the slot's own cutoff.)
  const departure = bookingTablesOn() ? null : await getDeparture(d.departureId);
  if (departure && departure.threadId === tour.id) {
    const defaults = await getTourBookingDefaults(tour.id);
    if (defaults && closedAlready(departure.startsAt, defaults.closeBeforeMinutes)) {
      return { ok: false, error: "Booking for that date has closed." };
    }
  }
  const viewer = await getViewer().catch(() => null);
  const baseUrl = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
  if (bookingTablesOn()) {
    // Booking tables: a booking is taken under the slot lock, then the order, then the card session.
    let bookedUrl: string;
    try {
      const offer = await getOfferByThread(ORG, tour.id);
      if (!offer || offer.mode !== "set_dates") return { ok: false, error: "That tour is not open for booking yet." };
      const booked = await startBookingCheckout({
        orgId: ORG,
        threadId: tour.id,
        offerId: offer.id,
        slotId: d.departureId,
        partySize: d.partySize,
        kinds: ["tour"],
        itemNoun: "place",
        customerEmail: d.email,
        customerName: d.name,
        customerId: viewer?.userId ?? null,
        notes: d.note || null,
        timeZone: siteConfig.timeZone,
        baseUrl,
        siteUrl: baseUrl,
        returnPathFor: (token) => `/bookings/${token}`,
        cancelPath: `/tours/${tour.slug}`,
        returnRoute: "/api/checkout/return",
      });
      bookedUrl = booked.url;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not start the booking." };
    }
    redirect(bookedUrl);
  }
  let url: string;
  try {
    const started = await startTourCheckout({
      orgId: ORG,
      threadId: tour.id,
      departureId: d.departureId,
      partySize: d.partySize,
      customerEmail: d.email,
      customerName: d.name,
      customerId: viewer?.userId ?? null,
      notes: d.note || null,
      baseUrl,
      returnPath: `/tours/${tour.slug}`,
      cancelPath: `/tours/${tour.slug}`,
      returnRoute: "/api/checkout/return",
    });
    url = started.url;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the booking." };
  }
  redirect(url);
}

// ── geocoding (editor) ────────────────────────────────────────────────────

export interface PlaceHit {
  label: string;
  lat: number;
  lng: number;
}

/** Photon (OpenStreetMap) lookup for the stop editor; Paris-biased. */
export async function geocodeAction(query: string): Promise<PlaceHit[]> {
  await requireOrgEditor();
  const q = query.trim();
  if (q.length < 2) return [];
  const base = (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
  const url = `${base}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=48.8566&lon=2.3522`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string> }[];
    };
    return (json.features ?? [])
      .map((f) => {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN];
        const label = [p.name, p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street, p.postcode, p.city ?? p.county, p.country]
          .filter(Boolean)
          .join(", ");
        return { label, lat, lng };
      })
      .filter((h) => h.label && Number.isFinite(h.lat) && Number.isFinite(h.lng));
  } catch {
    return [];
  }
}

function revalidateTour(slug?: string) {
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath("/manage/tours");
  if (slug) revalidatePath(`/tours/${slug}`);
}
