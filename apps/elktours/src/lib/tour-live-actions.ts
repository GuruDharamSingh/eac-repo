"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { ensureUniqueThreadSlug } from "@elkdonis/services";
import { deriveExcerpt, sanitizeRichText } from "@elkdonis/utils";
import { slugifyTitle } from "@/lib/cms/schema";
import { requireOrgEditor } from "@/lib/auth";
import { getTourById, type TourDetails } from "@/lib/tours";
import { siteConfig } from "@/config/site";

/**
 * In-place editing on the tour page (components/tours/live). Unlike
 * saveTourAction, which writes the whole form, a patch carries only the
 * fields the editor touched and is merged into what is stored: the cached
 * route, the film and any key another feature wrote stay as they are.
 */

const ORG = siteConfig.orgId;

/** Our own media route only: a film or poster must be something this site uploaded. */
const mediaUrl = z.string().max(500).refine((u) => u.startsWith(`/api/media/EAC_Network/${ORG}/`), "Upload the file here first");

const lines = z.array(z.string().max(300)).max(30).transform((v) => v.map((s) => s.trim()).filter(Boolean));
const optNum = (lo: number, hi: number) => z.number().min(lo).max(hi).nullable();

const patchSchema = z
  .object({
    title: z.string().trim().min(3, "The title needs at least 3 characters").max(200),
    excerpt: z.string().trim().max(400),
    body: z.string().max(100_000),
    status: z.enum(["draft", "published"]),
    price: optNum(0, 10_000),
    durationMinutes: optNum(0, 24 * 60),
    location: z.string().trim().max(300),
    highlights: lines,
    includes: lines,
    languages: lines,
    effort: z.string().trim().max(200),
    maxParty: optNum(1, 500),
    film: z.object({ url: mediaUrl, url720: mediaUrl.nullable(), poster: mediaUrl.nullable() }).nullable(),
  })
  .partial();

export type TourPatch = z.input<typeof patchSchema>;
export type PatchResult = { ok: true; slug: string } | { ok: false; error: string };

export async function patchTourAction(threadId: string, input: TourPatch): Promise<PatchResult> {
  const viewer = await requireOrgEditor();
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields" };
  const p = parsed.data;
  const tour = await getTourById(threadId);
  if (!tour) return { ok: false, error: "Not found" };

  const title = p.title ?? tour.title;
  const slug = p.title !== undefined && p.title !== tour.title ? await ensureUniqueThreadSlug(ORG, slugifyTitle(title), threadId) : tour.slug;
  const body = p.body !== undefined ? sanitizeRichText(p.body) || null : tour.body;
  const excerpt = p.excerpt !== undefined ? deriveExcerpt(body ?? "", { explicit: p.excerpt || undefined }) : tour.excerpt;
  const status = p.status ?? tour.status;

  const d = tour.details;
  const details: TourDetails = {
    ...d,
    highlights: p.highlights ?? d.highlights,
    includes: p.includes ?? d.includes,
    languages: p.languages ?? d.languages,
    effort: p.effort !== undefined ? p.effort || null : d.effort,
    maxParty: p.maxParty !== undefined ? (p.maxParty == null ? null : Math.floor(p.maxParty)) : d.maxParty,
  };
  const meta: Record<string, unknown> = { tour: details };
  if (p.film !== undefined) meta.film = p.film;
  const patch = JSON.parse(JSON.stringify(meta)) as Record<string, string>;

  try {
    await db`
      UPDATE threads SET
        title = ${title}, slug = ${slug}, body = ${body}, excerpt = ${excerpt}, status = ${status},
        price = ${p.price !== undefined ? p.price : tour.price},
        duration_minutes = ${p.durationMinutes !== undefined ? (p.durationMinutes == null ? null : Math.round(p.durationMinutes)) : tour.durationMinutes},
        location = ${p.location !== undefined ? p.location || null : tour.location},
        metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json(patch)},
        published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
    `;
    // The film bar registers the film as the visible hero asset set and rewrites the metadata.film cache.
    if (p.film !== undefined) {
      const { syncHeroFilmFromUrls } = await import("@/lib/assets");
      const f = p.film;
      await syncHeroFilmFromUrls(threadId, f && f.url ? { url: f.url, url720: f.url720 ?? null, poster: f.poster ?? null } : null, viewer.userId);
    }
  } catch (err) {
    console.error("[elktours] patchTourAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
  revalidatePath("/");
  revalidatePath("/tours");
  revalidatePath(`/tours/${tour.slug}`);
  if (slug !== tour.slug) revalidatePath(`/tours/${slug}`);
  return { ok: true, slug };
}
