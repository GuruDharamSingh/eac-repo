"use server";
// Artist wizard writes (design screen 35) and the office's decision on an experience (screen 30).
// Reads and types: lib/artist-wizard.ts. A "use server" file exposes every export, so only actions are here.
//
// Flow: artist saves a draft (kind 'experience', status 'draft', metadata.offer) -> submits it
// (status 'pending') -> the office publishes it (public), publishes it for members only
// (visibility ORGANIZATION), or sends it back with notes (status back to 'draft', metadata.review.notes).

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug, reviewThread, setOrgRole } from "@elkdonis/services";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { slugifyTitle } from "@/lib/cms/schema";
import { getViewer } from "@/lib/auth";
import { EXPERIENCES_FEED } from "@/lib/experiences";
import { canUseArtistWizard, type ExperienceOffer } from "@/lib/artist-wizard";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

function revalidateExperiences(slug?: string) {
  revalidatePath("/experiences");
  revalidatePath("/manage");
  if (slug) revalidatePath(`/experiences/${slug}`);
}

const offerSchema = z.object({
  onTour: z.object({ fee: z.number().min(0).max(100_000), unit: z.enum(["per_run", "per_guest"]) }).nullable(),
  standalone: z.object({ pricePerGuest: z.number().min(0).max(100_000) }).nullable(),
  noticeDays: z.union([z.literal(1), z.literal(2), z.literal(7)]),
  visibilityWanted: z.enum(["members", "public"]),
});

const draftSchema = z.object({
  title: z.string().trim().min(2, "Give the experience a title").max(200),
  /** Step II "what will happen" (the strange pitch): one or two lines on the card. */
  pitch: z.string().trim().max(400).nullable().optional(),
  body: z.string().max(100_000).nullable().optional(),
  /** Kind chip shown on cards (free label from the design's chips). */
  kindLabel: z.string().trim().max(40).nullable().optional(),
  format: z.enum(["in_person", "online", "hybrid"]),
  placeId: z.string().regex(UUID).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(24 * 60).nullable().optional(),
  groupSize: z.number().int().min(1).max(200).nullable().optional(),
  offer: offerSchema,
});
export type ExperienceDraftInput = z.input<typeof draftSchema>;

/** Step I: the artist's profile in this org. Craft and about are set when given and never blanked by an empty field; name and area only fill gaps in the shared profile. */
export async function saveArtistProfileAction(input: { name?: string; craft?: string; area?: string; about?: string }): Promise<Result> {
  const gate = await canUseArtistWizard();
  if (gate.ok === false) return { ok: false, error: gate.error };
  const clean = (s: string | undefined, n: number) => (s ?? "").replace(/<[^>]*>/g, "").trim().slice(0, n) || null;
  const craft = clean(input.craft, 120);
  const about = clean(input.about, 4000);
  const name = clean(input.name, 120);
  const area = clean(input.area, 120);
  await db`
    INSERT INTO org_profiles (org_id, user_id, role_title, bio_override)
    VALUES (${ORG}, ${gate.userId}, ${craft}, ${about})
    ON CONFLICT (org_id, user_id) DO UPDATE SET
      role_title = COALESCE(EXCLUDED.role_title, org_profiles.role_title),
      bio_override = COALESCE(EXCLUDED.bio_override, org_profiles.bio_override),
      updated_at = NOW()
  `;
  // Shared profile: only fill what is empty, never overwrite what the person set elsewhere.
  await db`
    UPDATE users SET display_name = COALESCE(NULLIF(display_name, ''), ${name}), city = COALESCE(NULLIF(city, ''), ${area})
    WHERE id = ${gate.userId}
  `;
  revalidatePath("/manage");
  return { ok: true };
}

/** Steps II to IV: create or update a draft. Only while it is a draft (or was sent back). */
export async function saveExperienceDraftAction(input: ExperienceDraftInput, id?: string): Promise<Result<{ id: string; slug: string }>> {
  const gate = await canUseArtistWizard();
  if (gate.ok === false) return { ok: false, error: gate.error };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  if (d.placeId) {
    const [pl] = (await db`SELECT id FROM places WHERE id = ${d.placeId} AND org_id = ${ORG}`) as unknown as Row[];
    if (!pl) return { ok: false, error: "That place is not in the catalogue." };
  }
  const body = sanitizeRichText(d.body ?? "");
  const excerpt = deriveExcerpt(body, { explicit: d.pitch || undefined });
  const offer = d.offer as ExperienceOffer;
  const experience = { format: d.format, highlights: [], ...(d.placeId ? { placeId: d.placeId } : {}), ...(d.kindLabel ? { kindLabel: d.kindLabel } : {}) };

  if (id) {
    const [t] = (await db`
      SELECT t.id, t.slug, t.status, t.author_id FROM threads t
      WHERE t.id = ${id} AND t.org_id = ${ORG} AND t.kind = 'experience'
        AND (t.author_id = ${gate.userId} OR EXISTS (SELECT 1 FROM experience_people ep WHERE ep.thread_id = t.id AND ep.user_id = ${gate.userId} AND ep.role = 'artist'))
    `) as unknown as Row[];
    if (!t) return { ok: false, error: "Not found." };
    if (t.status !== "draft") return { ok: false, error: "It is with the office or already published. Ask the office to send it back to change it." };
    const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(d.title), id);
    await db`
      UPDATE threads SET title = ${d.title}, slug = ${slug}, body = ${body || null}, excerpt = ${excerpt},
        duration_minutes = ${d.durationMinutes ?? null}, attendee_limit = ${d.groupSize ?? null},
        is_online = ${d.format === "online"}, format = ${d.format}, price = ${offer.standalone?.pricePerGuest ?? null},
        metadata = (COALESCE(metadata, '{}'::jsonb) - 'experience' - 'offer') || ${db.json({ experience, offer } as never)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    revalidateExperiences(slug);
    return { ok: true, id, slug };
  }

  const newId = nanoid(21);
  const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(d.title));
  try {
    await db.begin(async (tx) => {
      await tx`
        INSERT INTO threads (id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility, metadata,
                             price, currency, duration_minutes, attendee_limit, is_online, format)
        VALUES (${newId}, ${ORG}, ${gate.userId}, 'experience', ${EXPERIENCES_FEED}, ${d.title}, ${slug}, ${body || null}, ${excerpt},
                'draft', 'PUBLIC', ${db.json({ experience, offer } as never)},
                ${offer.standalone?.pricePerGuest ?? null}, ${siteConfig.currency}, ${d.durationMinutes ?? null}, ${d.groupSize ?? null},
                ${d.format === "online"}, ${d.format})
      `;
      await tx`INSERT INTO experience_people (thread_id, user_id, role, position) VALUES (${newId}, ${gate.userId}, 'artist', 0) ON CONFLICT DO NOTHING`;
    });
  } catch (err) {
    console.error("[elktours] saveExperienceDraftAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
  revalidateExperiences(slug);
  return { ok: true, id: newId, slug };
}

/** Last step: send the draft to the office (status 'pending'). Re-checks the wizard's rules. */
export async function submitExperienceForReviewAction(id: string): Promise<Result<{ status: "pending" }>> {
  const gate = await canUseArtistWizard();
  if (gate.ok === false) return { ok: false, error: gate.error };
  const [t] = (await db`
    SELECT t.id, t.title, t.excerpt, t.status, t.format, t.metadata FROM threads t
    WHERE t.id = ${id} AND t.org_id = ${ORG} AND t.kind = 'experience'
      AND (t.author_id = ${gate.userId} OR EXISTS (SELECT 1 FROM experience_people ep WHERE ep.thread_id = t.id AND ep.user_id = ${gate.userId} AND ep.role = 'artist'))
  `) as unknown as Row[];
  if (!t) return { ok: false, error: "Not found." };
  if (t.status !== "draft") return { ok: false, error: "That is already with the office." };
  const meta = (t.metadata ?? {}) as { offer?: Partial<ExperienceOffer>; experience?: { placeId?: string } };
  if (!t.excerpt) return { ok: false, error: "Add a line on what will happen." };
  if (t.format !== "online" && !meta.experience?.placeId) return { ok: false, error: "Pick a place, or make it online." };
  if (!meta.offer?.onTour && !meta.offer?.standalone) return { ok: false, error: "Choose at least one way to offer it." };
  await db`
    UPDATE threads SET status = 'pending', metadata = COALESCE(metadata, '{}'::jsonb) - 'review', updated_at = NOW() WHERE id = ${id}
  `;
  revalidateExperiences();
  return { ok: true, status: "pending" };
}

/**
 * The office decides. Owners only.
 *   publish    status published, visibility PUBLIC
 *   members    status published, visibility ORGANIZATION (signed-in people with a row here)
 *   send_back  status draft again, with notes the artist sees (metadata.review.notes)
 */
export async function decideExperienceAction(id: string, decision: "publish" | "members" | "send_back", notes?: string): Promise<Result<{ status: string }>> {
  const v = await getViewer();
  if (!v || v.role !== "owner") return { ok: false, error: "Only the office can decide this." };
  const [t] = (await db`SELECT id, slug, status FROM threads WHERE id = ${id} AND org_id = ${ORG} AND kind = 'experience'`) as unknown as Row[];
  if (!t) return { ok: false, error: "Not found." };
  if (t.status !== "pending") return { ok: false, error: "That is not waiting for a decision." };

  if (decision === "send_back") {
    const text = (notes ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 2000);
    if (!text) return { ok: false, error: "Say what to change." };
    await db`
      UPDATE threads SET status = 'draft', reviewed_by = ${v.userId}, reviewed_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ review: { notes: text, at: new Date().toISOString() } } as never)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    revalidateExperiences(t.slug as string);
    return { ok: true, status: "draft" };
  }

  // Set who may read it first (still pending, so nobody sees it), then let reviewThread publish it.
  await db`UPDATE threads SET visibility = ${decision === "members" ? "ORGANIZATION" : "PUBLIC"}, min_role = NULL WHERE id = ${id}`;
  const res = await reviewThread(v.userId, id, "approve", { approverRoles: ["owner"] });
  if (res.ok === false) return { ok: false, error: res.error };
  await db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) - 'review' WHERE id = ${id}`;
  revalidateExperiences(t.slug as string);
  return { ok: true, status: res.status };
}

/**
 * The office invites an artist: an existing account becomes a `member` of this org (the role that
 * unlocks the artist pages). A person with no account has to sign up first; there is no
 * invite-by-email flow in this app yet.
 */
export async function inviteArtistAction(email: string): Promise<Result<{ userId: string }>> {
  const v = await getViewer();
  if (!v || v.role !== "owner") return { ok: false, error: "Only the office can invite artists." };
  const addr = (email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return { ok: false, error: "Check the email address." };
  const [u] = (await db`SELECT id FROM users WHERE lower(email) = ${addr} LIMIT 1`) as unknown as Row[];
  if (!u) return { ok: false, error: "They have no account yet. Ask them to sign up on the site, then invite them." };
  const [held] = (await db`SELECT role FROM user_organizations WHERE user_id = ${u.id as string} AND org_id = ${ORG}`) as unknown as Row[];
  if (held && (held.role === "owner" || held.role === "guide" || held.role === "member")) return { ok: true, userId: u.id as string };
  await setOrgRole(u.id as string, ORG, "member");
  revalidatePath("/manage/people");
  return { ok: true, userId: u.id as string };
}

/**
 * Step III: the 7 x 3 grid and the notice. weekday 0 = Monday. Needs the artist_availability tables
 * (migrations-draft/artist_availability.sql); until they exist this says so and writes nothing.
 */
export async function saveAvailabilityAction(
  cells: Array<{ weekday: number; part: "morning" | "afternoon" | "evening" }>,
  noticeDays: 1 | 2 | 7 = 2
): Promise<Result> {
  const gate = await canUseArtistWizard();
  if (gate.ok === false) return { ok: false, error: gate.error };
  const [t] = (await db`SELECT to_regclass('public.artist_availability') AS a, to_regclass('public.artist_availability_notice') AS n`) as unknown as Row[];
  if (!t?.a || !t?.n) return { ok: false, error: "available after migration" };
  const seen = new Set<string>();
  const clean = (Array.isArray(cells) ? cells : []).filter((c) => {
    if (!c || !Number.isInteger(c.weekday) || c.weekday < 0 || c.weekday > 6 || !["morning", "afternoon", "evening"].includes(c.part)) return false;
    const k = `${c.weekday}:${c.part}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const notice = [1, 2, 7].includes(noticeDays) ? noticeDays : 2;
  await db.begin(async (tx) => {
    await tx`DELETE FROM artist_availability WHERE org_id = ${ORG} AND user_id = ${gate.userId}`;
    for (const c of clean) {
      await tx`INSERT INTO artist_availability (org_id, user_id, weekday, part) VALUES (${ORG}, ${gate.userId}, ${c.weekday}, ${c.part})`;
    }
    await tx`
      INSERT INTO artist_availability_notice (org_id, user_id, notice_days) VALUES (${ORG}, ${gate.userId}, ${notice})
      ON CONFLICT (org_id, user_id) DO UPDATE SET notice_days = EXCLUDED.notice_days, updated_at = NOW()
    `;
  });
  revalidatePath("/manage");
  return { ok: true };
}
