"use server";
// CONTRACT: experience server actions (editor-only except the inquiry). Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug } from "@elkdonis/services";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { slugifyTitle } from "@/lib/cms/schema";
import { getViewer, requireOrgEditor } from "@/lib/auth";
import {
  EXPERIENCES_FEED,
  getExperienceById,
  isExperiencePerson,
  listPersonOptions,
  listServiceOptions,
  stopDraftFromExperience,
} from "@/lib/experiences";
import { siteConfig } from "@/config/site";
import type { Experience, ExperienceInput, ExperienceInquiryInput, ExperiencePersonInput, PersonOption, Result, ServiceOption, StopDraft } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;

function revalidateExperience(slug?: string, id?: string) {
  revalidatePath("/");
  revalidatePath("/experiences");
  revalidatePath("/manage/experiences");
  if (slug) revalidatePath(`/experiences/${slug}`);
  if (id) revalidatePath(`/manage/experiences/${id}`);
}

const optNum = (lo: number, hi: number) => z.number().min(lo).max(hi).nullable().optional();
const experienceSchema = z.object({
  title: z.string().trim().min(2, "Give the experience a title").max(200),
  body: z.string().max(100_000).nullable().optional(),
  excerpt: z.string().trim().max(400).nullable().optional(),
  coverImageUrl: z.string().trim().max(500).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  isOnline: z.boolean().optional(),
  durationMinutes: optNum(0, 24 * 60),
  price: optNum(0, 100_000),
  currency: z.string().trim().length(3).nullable().optional(),
  format: z.enum(["in_person", "online", "hybrid"]).optional(),
  highlights: z.array(z.string().trim().max(300)).max(30).optional(),
  lat: optNum(-90, 90),
  lng: optNum(-180, 180),
  serviceThreadId: z.string().trim().max(21).nullable().optional(),
  placeId: z.string().regex(UUID).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  visibility: z.enum(["PUBLIC", "ORGANIZATION"]).optional(),
});

export async function saveExperienceAction(input: ExperienceInput, id?: string): Promise<Result<{ id: string; slug: string }>> {
  const editor = await requireOrgEditor();
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const existing = id ? await getExperienceById(id) : null;
  if (id && !existing) return { ok: false, error: "Not found" };

  if (d.coverImageUrl && !d.coverImageUrl.startsWith("/api/media/") && !/^https:\/\//.test(d.coverImageUrl)) {
    return { ok: false, error: "Upload the cover image here first." };
  }
  if (d.serviceThreadId) {
    const [svc] = (await db`
      SELECT id FROM threads WHERE id = ${d.serviceThreadId} AND kind = 'service' AND status = 'published' AND visibility = 'PUBLIC'
    `) as unknown as Row[];
    if (!svc) return { ok: false, error: "That service listing is not public." };
  }

  const format = d.format ?? (d.isOnline ? "online" : "in_person");
  if (d.placeId) {
    const [pl] = (await db`SELECT lat, lng FROM places WHERE id = ${d.placeId} AND org_id = ${ORG}`) as unknown as Row[];
    if (!pl) return { ok: false, error: "That place is not in the catalogue." };
    if (d.lat == null && d.lng == null && pl.lat != null && pl.lng != null) {
      d.lat = Number(pl.lat);
      d.lng = Number(pl.lng);
    }
  }
  const both = d.lat != null && d.lng != null;
  const body = sanitizeRichText(d.body ?? "");
  const excerpt = deriveExcerpt(body, { explicit: d.excerpt || undefined });
  const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(d.title), id);
  const status = d.status ?? (existing?.status === "published" ? "published" : "draft");
  const visibility = d.visibility ?? (existing?.visibility === "ORGANIZATION" ? "ORGANIZATION" : "PUBLIC");
  const experience = {
    format,
    ...(d.serviceThreadId ? { serviceThreadId: d.serviceThreadId } : {}),
    ...(d.placeId ? { placeId: d.placeId } : {}),
    highlights: (d.highlights ?? []).filter(Boolean),
    ...(both && format !== "online" ? { lat: d.lat, lng: d.lng } : {}),
  };
  const patch = JSON.parse(JSON.stringify({ experience, ...(d.coverImageUrl ? { coverImageUrl: d.coverImageUrl } : {}) })) as Record<string, string>;
  const publishedAt = status === "published" ? new Date() : null;

  try {
    if (id) {
      await db`
        UPDATE threads SET
          title = ${d.title}, slug = ${slug}, body = ${body || null}, excerpt = ${excerpt}, status = ${status},
          visibility = ${visibility},
          price = ${d.price ?? null}, currency = ${d.currency ?? siteConfig.currency},
          duration_minutes = ${d.durationMinutes ?? null}, location = ${d.location || null},
          is_online = ${format === "online"}, format = ${format},
          metadata = (COALESCE(metadata, '{}'::jsonb) - 'coverImageUrl' - 'experience') || ${db.json(patch)},
          published_at = COALESCE(published_at, ${publishedAt}), updated_at = NOW()
        WHERE id = ${id} AND org_id = ${ORG} AND kind = 'experience'
      `;
      revalidateExperience(slug, id);
      if (existing && existing.slug !== slug) revalidatePath(`/experiences/${existing.slug}`);
      return { ok: true, id, slug };
    }
    const newId = nanoid(21);
    await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, section, title, slug, body, excerpt, status, visibility,
        metadata, price, currency, duration_minutes, location, is_online, format, published_at
      ) VALUES (
        ${newId}, ${ORG}, ${editor.userId}, 'experience', ${EXPERIENCES_FEED}, ${d.title}, ${slug},
        ${body || null}, ${excerpt}, ${status}, ${visibility},
        ${db.json(patch)}, ${d.price ?? null}, ${d.currency ?? siteConfig.currency},
        ${d.durationMinutes ?? null}, ${d.location || null}, ${format === "online"}, ${format}, ${publishedAt}
      )
    `;
    revalidateExperience(slug, newId);
    return { ok: true, id: newId, slug };
  } catch (err) {
    console.error("[elktours] saveExperienceAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
}

export async function setExperienceStatusAction(id: string, status: "draft" | "published" | "archived"): Promise<Result> {
  await requireOrgEditor();
  if (!["draft", "published", "archived"].includes(status)) return { ok: false, error: "Unknown status" };
  const rows = (await db`
    UPDATE threads SET status = ${status},
      published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
      updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG} AND kind = 'experience'
    RETURNING slug
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "Not found" };
  revalidateExperience(rows[0].slug as string, id);
  return { ok: true };
}

/** Replaces the linked people, in this order. Artists come from elktours members or oad artists. */
export async function setExperiencePeopleAction(id: string, people: ExperiencePersonInput[]): Promise<Result<{ experience: Experience }>> {
  await requireOrgEditor();
  const exp = await getExperienceById(id);
  if (!exp) return { ok: false, error: "Not found" };
  const list = (Array.isArray(people) ? people : [])
    .filter((p) => p && UUID.test(p.userId) && (p.role === "artist" || p.role === "host"))
    .slice(0, 20);
  const ids = [...new Set(list.map((p) => p.userId))];
  if (ids.length > 0) {
    const found = (await db`SELECT id FROM users WHERE id = ANY(${ids}::uuid[])`) as unknown as Row[];
    if (found.length !== ids.length) return { ok: false, error: "Someone in the list is not a member." };
  }
  try {
    await db.begin(async (tx) => {
      await tx`DELETE FROM experience_people WHERE thread_id = ${id}`;
      const seen = new Set<string>();
      const pos = { artist: 0, host: 0 };
      for (const p of list) {
        const k = `${p.userId}:${p.role}`;
        if (seen.has(k)) continue;
        seen.add(k);
        await tx`
          INSERT INTO experience_people (thread_id, user_id, role, position) VALUES (${id}, ${p.userId}, ${p.role}, ${pos[p.role]++})
        `;
      }
    });
  } catch (err) {
    console.error("[elktours] setExperiencePeopleAction:", err);
    return { ok: false, error: "Could not save the people." };
  }
  revalidateExperience(exp.slug, id);
  return { ok: true, experience: (await getExperienceById(id))! };
}

/** Saves metadata.page (Puck Data) or clears it with null. Editors, or the linked artists. */
export async function saveExperiencePageAction(id: string, page: unknown | null): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!viewer.canEdit && !(await isExperiencePerson(id, viewer.userId))) return { ok: false, error: "You cannot edit this page." };
  const exp = await getExperienceById(id);
  if (!exp) return { ok: false, error: "Not found" };
  if (page !== null) {
    const p = page as { content?: unknown; root?: unknown };
    if (!p || typeof p !== "object" || !Array.isArray(p.content)) return { ok: false, error: "That is not a page layout." };
    if (JSON.stringify(page).length > 1_000_000) return { ok: false, error: "The page is too large." };
  }
  await db`
    UPDATE threads SET
      metadata = CASE WHEN ${page === null} THEN COALESCE(metadata, '{}'::jsonb) - 'page'
                      ELSE COALESCE(metadata, '{}'::jsonb) || ${db.json({ page: (page ?? {}) as never })} END,
      updated_at = NOW()
    WHERE id = ${id} AND org_id = ${ORG} AND kind = 'experience'
  `;
  revalidateExperience(exp.slug, id);
  return { ok: true };
}

export async function pickExperienceAction(id: string): Promise<Result<{ stop: StopDraft }>> {
  await requireOrgEditor();
  const exp = await getExperienceById(id);
  if (!exp || exp.status === "archived") return { ok: false, error: "That experience is not available." };
  return { ok: true, stop: stopDraftFromExperience(exp) };
}

export async function searchPeopleAction(q: string): Promise<PersonOption[]> {
  await requireOrgEditor();
  return listPersonOptions(q);
}

export async function listServiceOptionsAction(userId: string): Promise<ServiceOption[]> {
  await requireOrgEditor();
  if (!UUID.test(userId)) return [];
  return listServiceOptions(userId);
}

const inquirySchema = z.object({
  experienceId: z.string().min(1).max(21),
  name: z.string().trim().min(1, "Your name, please").max(120),
  email: z.string().trim().email("Check the email address").max(200),
  message: z.string().trim().min(2, "Write a short message").max(4000),
  partySize: z.number().int().min(1).max(100).nullable().optional(),
  preferredDate: z.string().trim().max(60).nullable().optional(),
});

/** Public: inquiry-only booking. Emails the org owners and the hosts; reply goes to the visitor. */
export async function sendExperienceInquiryAction(input: ExperienceInquiryInput): Promise<Result> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const [exp] = (await db`
    SELECT id, title FROM threads WHERE id = ${d.experienceId} AND org_id = ${ORG} AND kind = 'experience'
      AND status = 'published' AND visibility = 'PUBLIC'
  `) as unknown as Row[];
  if (!exp) return { ok: false, error: "That experience is not available." };
  const recipients = (await db`
    SELECT DISTINCT u.email FROM users u
    WHERE u.email IS NOT NULL AND (
      u.id IN (SELECT user_id FROM user_organizations WHERE org_id = ${ORG} AND role = 'owner')
      OR u.id IN (SELECT user_id FROM experience_people WHERE thread_id = ${d.experienceId} AND role = 'host')
    )
  `) as unknown as Row[];
  const to = [...new Set([...recipients.map((r) => r.email as string), siteConfig.fallbackNotifyEmail])].slice(0, 6);
  const extra = [d.partySize ? `Party size: ${d.partySize}` : null, d.preferredDate ? `Preferred date: ${d.preferredDate}` : null].filter(Boolean).join("\n");
  try {
    const { sendContactNotification } = await import("@elkdonis/email");
    await Promise.all(
      to.map((addr) =>
        sendContactNotification(addr, {
          senderName: d.name,
          senderEmail: d.email,
          message: `Experience: ${exp.title as string}\n${extra ? `${extra}\n` : ""}\n${d.message}`,
          orgName: siteConfig.orgName,
          source: `experience:${d.experienceId}`,
          orgId: ORG,
          threadId: d.experienceId,
        }).catch((err) => console.error("[elktours] inquiry email:", err))
      )
    );
  } catch (err) {
    console.error("[elktours] sendExperienceInquiryAction:", err);
    return { ok: false, error: "Could not send. Try again, or write to us directly." };
  }
  return { ok: true };
}
