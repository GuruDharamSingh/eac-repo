"use server";

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
  cancelDeparture,
  cancelTourBooking,
  createDeparture,
  saveTourStops,
  updateDeparture,
  type TourStopInput,
} from "@elkdonis/commerce/server";
import { bookingAvailability, publicOriginFrom, startTourCheckout } from "@elkdonis/checkout/booking";
import { getViewer, requireOrgEditor } from "@/lib/auth";
import { parisInputToDate } from "@/lib/format";
import { getTourById, getTourBySlug, type TourDetails } from "@/lib/tours";
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

export const tourFormSchema = z.object({
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
    revalidateTour(slug);
    return { ok: true, id, slug };
  } catch (err) {
    console.error("[elktours] saveTourAction:", err);
    return { ok: false, error: "Could not save. Try again." };
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
  const viewer = await getViewer().catch(() => null);
  const baseUrl = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
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
