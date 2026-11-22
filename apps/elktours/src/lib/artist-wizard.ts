// Reads for the artist wizard and the Board's artist/office panels (design screens 30, 35). Server only.
// Writes: lib/artist-wizard-actions.ts. Availability reads tolerate the artist_availability table
// not existing yet (migrations-draft/artist_availability.sql).
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

export type ExperienceReviewState = "draft" | "sent_back" | "review" | "public" | "members";
export const REVIEW_LABEL: Record<ExperienceReviewState, string> = {
  draft: "Draft",
  sent_back: "Sent back with notes",
  review: "In review",
  public: "Public",
  members: "Members only",
};

/** What the artist asked for in step IV. Stored at threads.metadata.offer. */
export interface ExperienceOffer {
  /** "As a stop on a tour": fee asked from the house. */
  onTour: { fee: number; unit: "per_run" | "per_guest" } | null;
  /** "On its own, by request": price per guest. */
  standalone: { pricePerGuest: number } | null;
  /** Days of notice the artist needs (1, 2 or 7). */
  noticeDays: 1 | 2 | 7;
  /** What the artist hopes for; the office decides. */
  visibilityWanted: "members" | "public";
}

export interface WizardExperience {
  id: string;
  slug: string;
  title: string;
  pitch: string | null;
  state: ExperienceReviewState;
  label: string;
  notes: string | null;
  offer: ExperienceOffer | null;
  updatedAt: string;
}

export type AvailabilityPart = "morning" | "afternoon" | "evening";
export interface AvailabilityCell { weekday: number; part: AvailabilityPart }

export function stateOf(status: string, visibility: string, notes: string | null): ExperienceReviewState {
  if (status === "pending") return "review";
  if (status === "published") return visibility === "PUBLIC" ? "public" : "members";
  return notes ? "sent_back" : "draft";
}

export function mapWizardExperience(r: Row): WizardExperience {
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  const review = (meta.review ?? {}) as Record<string, unknown>;
  const notes = typeof review.notes === "string" && review.notes.trim() ? review.notes : null;
  const state = stateOf(r.status as string, r.visibility as string, notes);
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    pitch: (r.excerpt as string | null) ?? null,
    state,
    label: REVIEW_LABEL[state],
    notes,
    offer: (meta.offer as ExperienceOffer | undefined) ?? null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** Who may use the wizard: owner, guide or member of this org. Followers and guests may not. */
export async function canUseArtistWizard(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const v = await getViewer().catch(() => null);
  if (!v) return { ok: false, error: "Sign in first." };
  if (!v.isMember) return { ok: false, error: "The artist pages are for artists the office has invited." };
  return { ok: true, userId: v.userId };
}

/** The signed-in artist's experiences, newest first, with their review state. */
export async function listMyExperiences(): Promise<WizardExperience[]> {
  const v = await getViewer().catch(() => null);
  if (!v) return [];
  const rows = (await db`
    SELECT t.id, t.slug, t.title, t.excerpt, t.status, t.visibility, t.metadata, t.updated_at
    FROM threads t
    WHERE t.org_id = ${ORG} AND t.kind = 'experience' AND t.status <> 'archived'
      AND (t.author_id = ${v.userId} OR EXISTS (SELECT 1 FROM experience_people ep WHERE ep.thread_id = t.id AND ep.user_id = ${v.userId} AND ep.role = 'artist'))
    ORDER BY t.updated_at DESC
  `) as unknown as Row[];
  return rows.map(mapWizardExperience);
}

/** The signed-in artist's own profile, to prefill step I of the wizard. Null when signed out. */
export async function getMyArtistProfile(): Promise<{ name: string; email: string; craft: string | null; area: string | null; about: string | null } | null> {
  const v = await getViewer().catch(() => null);
  if (!v) return null;
  const [r] = (await db`
    SELECT u.display_name, u.email, u.city, op.role_title, op.bio_override
    FROM users u LEFT JOIN org_profiles op ON op.user_id = u.id AND op.org_id = ${siteConfig.orgId}
    WHERE u.id = ${v.userId}
  `) as unknown as Array<Record<string, unknown>>;
  return {
    name: ((r?.display_name as string | null) ?? "").trim(),
    email: (r?.email as string | null) ?? v.email,
    craft: ((r?.role_title as string | null) ?? "").trim() || null,
    area: ((r?.city as string | null) ?? "").trim() || null,
    about: ((r?.bio_override as string | null) ?? "").trim() || null,
  };
}

/** One of my experiences for editing (author or linked artist). */
export async function getMyExperience(id: string): Promise<(WizardExperience & { body: string | null; format: string; placeId: string | null; durationMinutes: number | null; groupSize: number | null; location: string | null }) | null> {
  const v = await getViewer().catch(() => null);
  if (!v) return null;
  const [r] = (await db`
    SELECT t.id, t.slug, t.title, t.excerpt, t.body, t.status, t.visibility, t.metadata, t.updated_at, t.format, t.duration_minutes, t.attendee_limit, t.location
    FROM threads t
    WHERE t.id = ${id} AND t.org_id = ${ORG} AND t.kind = 'experience'
      AND (t.author_id = ${v.userId} OR ${v.canEdit} OR EXISTS (SELECT 1 FROM experience_people ep WHERE ep.thread_id = t.id AND ep.user_id = ${v.userId} AND ep.role = 'artist'))
    LIMIT 1
  `) as unknown as Row[];
  if (!r) return null;
  const x = ((r.metadata as Record<string, unknown> | null)?.experience ?? {}) as Record<string, unknown>;
  return {
    ...mapWizardExperience(r),
    body: (r.body as string | null) ?? null,
    format: (r.format as string | null) ?? "in_person",
    placeId: typeof x.placeId === "string" ? x.placeId : null,
    durationMinutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
    groupSize: r.attendee_limit == null ? null : Number(r.attendee_limit),
    location: (r.location as string | null) ?? null,
  };
}

/** Office queue: experiences waiting for a decision. Owners only (checked by the caller's gate). */
export async function listExperiencesToReview(): Promise<Array<WizardExperience & { artistName: string | null; body: string | null; format: string; durationMinutes: number | null }>> {
  const v = await getViewer().catch(() => null);
  if (!v || v.role !== "owner") return [];
  const rows = (await db`
    SELECT t.id, t.slug, t.title, t.excerpt, t.body, t.status, t.visibility, t.metadata, t.updated_at, t.format, t.duration_minutes,
      (SELECT u.display_name FROM experience_people ep JOIN users u ON u.id = ep.user_id WHERE ep.thread_id = t.id AND ep.role = 'artist' ORDER BY ep.position LIMIT 1) AS artist_name
    FROM threads t
    WHERE t.org_id = ${ORG} AND t.kind = 'experience' AND t.status = 'pending'
    ORDER BY t.updated_at
  `) as unknown as Row[];
  return rows.map((r) => ({
    ...mapWizardExperience(r),
    artistName: (r.artist_name as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    format: (r.format as string | null) ?? "in_person",
    durationMinutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
  }));
}

async function hasTable(name: string): Promise<boolean> {
  try {
    const [r] = (await db`SELECT to_regclass(${`public.${name}`}) AS t`) as unknown as Row[];
    return Boolean(r?.t);
  } catch {
    return false;
  }
}
export const availabilityTableExists = () => hasTable("artist_availability");

/** The artist's free cells and notice. Empty and 2 days until the artist_availability migration lands. */
export async function getAvailability(userId?: string): Promise<{ available: boolean; cells: AvailabilityCell[]; noticeDays: 1 | 2 | 7 }> {
  const v = userId ? null : await getViewer().catch(() => null);
  const uid = userId ?? v?.userId;
  if (!uid || !(await hasTable("artist_availability"))) return { available: false, cells: [], noticeDays: 2 };
  const rows = (await db`SELECT weekday, part FROM artist_availability WHERE org_id = ${ORG} AND user_id = ${uid} ORDER BY weekday, part`) as unknown as Row[];
  let noticeDays: 1 | 2 | 7 = 2;
  if (await hasTable("artist_availability_notice")) {
    const [n] = (await db`SELECT notice_days FROM artist_availability_notice WHERE org_id = ${ORG} AND user_id = ${uid}`) as unknown as Row[];
    if (n && [1, 2, 7].includes(Number(n.notice_days))) noticeDays = Number(n.notice_days) as 1 | 2 | 7;
  }
  return { available: true, cells: rows.map((r) => ({ weekday: Number(r.weekday), part: r.part as AvailabilityPart })), noticeDays };
}
