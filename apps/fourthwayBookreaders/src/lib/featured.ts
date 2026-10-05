import { db } from "@elkdonis/db";
import { getCircleResume, listCircleUnits, occurrencesOf, type CircleUnit } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { withBaseMaybe } from "@/lib/base-path";
import { READING_GROUP_KIND } from "@/lib/types";
import { readExcerpt } from "@/lib/circle-page";

/**
 * The featured reading group on the home page (org_site_sections key
 * `featured_group` = { threadId }), chosen in /manage/groups.
 *
 * What the hero shows for it is posted by a person, not generated: after a
 * sitting a host or editor pastes a passage from where the circle stopped
 * (metadata.circle.excerpt — the stop form or the manage section). The
 * "book" slide uses the circle's cover image. (Owner's call, 2026-09-26:
 * rendering PDF pages automatically was dropped for this.)
 */

const ORG = siteConfig.orgId;
export const FEATURED_KEY = "featured_group";

export interface FeaturedCircle {
  title: string;
  href: string;
  coverImageUrl: string | null;
  /** The unit the next sitting starts in, e.g. "TOTM 3 — Phenomenal Pen-Pal". */
  unitName: string | null;
  nextSitting: Date | null;
  excerpt: { paragraphs: string[]; where: string | null; page: number | null } | null;
}

export async function getFeaturedGroupId(): Promise<string | null> {
  const [row] = await db<{ id: string | null }[]>`
    SELECT content->>'threadId' AS id FROM org_site_sections
    WHERE org_id = ${ORG} AND section_key = ${FEATURED_KEY}
  `.catch(() => []);
  return row?.id ?? null;
}

export async function getFeaturedCircle(): Promise<FeaturedCircle | null> {
  const id = await getFeaturedGroupId();
  if (!id) return null;
  const [t] = await db<Array<{
    id: string; slug: string | null; title: string; metadata: Record<string, unknown> | null;
    scheduled_at: Date | null; recurrence_pattern: string | null; recurrence_until: Date | null;
  }>>`
    SELECT id, slug, title, metadata, scheduled_at, recurrence_pattern, recurrence_until
    FROM threads
    WHERE id = ${id} AND org_id = ${ORG} AND kind = ${READING_GROUP_KIND}
      AND status = 'published' AND visibility = 'PUBLIC'
  `.catch(() => []);
  if (!t) return null;

  const units = await listCircleUnits(ORG, t.id).catch(() => [] as CircleUnit[]);
  const resume = units.length ? await getCircleResume(ORG, t.id, units).catch(() => null) : null;
  const excerpt = readExcerpt(t.metadata);
  const [next] = t.scheduled_at
    ? occurrencesOf(
        { scheduledAt: t.scheduled_at, recurrencePattern: t.recurrence_pattern, recurrenceUntil: t.recurrence_until },
        { from: new Date(Date.now() - 3 * 3_600_000), count: 1 }
      )
    : [];
  const cover = t.metadata?.coverImageUrl;

  return {
    title: t.title,
    href: `/groups/${t.slug ?? t.id}`,
    coverImageUrl: typeof cover === "string" ? withBaseMaybe(cover) : null,
    unitName: resume ? (resume.unit.label ? `${resume.unit.label} — ${resume.unit.title}` : resume.unit.title) : null,
    nextSitting: next ?? null,
    excerpt: excerpt
      ? {
          paragraphs: excerpt.text.split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean),
          where: excerpt.where,
          page: excerpt.page,
        }
      : null,
  };
}
