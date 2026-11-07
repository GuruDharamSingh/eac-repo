// CONTRACT: experience reads (server only). Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { Experience, ExperienceFormat, ExperiencePerson, ExperienceTourUse, PersonOption, ServiceOption, StopDraft } from "@/lib/catalogue-types";

/**
 * Experiences (migration 236): threads with kind = 'experience' in the
 * `experiences` feed. Facts in the event-shaped thread columns;
 * metadata.experience = {format, serviceThreadId?, highlights?, lat?, lng?};
 * metadata.page = optional Puck Data. Artists and hosts are linked through
 * experience_people (name and avatar from users). Inquiry-only in Phase A.
 */

const ORG = siteConfig.orgId;
export const EXPERIENCES_FEED = "experiences";
export const EXPERIENCE_KIND = "experience";
type Row = Record<string, unknown>;

const ARTDIRECT_URL = (process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
export const artistProfileUrl = (slug: string | null) => (slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}` : null);
export const artistServiceUrl = (userSlug: string | null, serviceSlug: string | null) =>
  userSlug && serviceSlug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${userSlug}/services/${serviceSlug}` : null;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const FORMATS: ExperienceFormat[] = ["in_person", "online", "hybrid"];

const COLUMNS = db`
  t.id, t.title, t.slug, t.status, t.visibility, t.body, t.excerpt, t.metadata, t.location, t.is_online,
  t.duration_minutes, t.price, t.currency, t.published_at, t.created_at, t.updated_at,
  svc.slug AS service_slug, svcu.slug AS service_user_slug
  FROM threads t
  LEFT JOIN threads svc ON svc.id = t.metadata->'experience'->>'serviceThreadId' AND svc.kind = 'service'
    AND svc.status = 'published' AND svc.visibility = 'PUBLIC'
  LEFT JOIN users svcu ON svcu.id = svc.author_id
`;

async function peopleFor(ids: string[]): Promise<Map<string, ExperiencePerson[]>> {
  const out = new Map<string, ExperiencePerson[]>();
  if (ids.length === 0) return out;
  const rows = (await db`
    SELECT ep.thread_id, ep.user_id, ep.role, ep.position, u.display_name, u.email, u.slug,
           COALESCE(op.photo_override, u.avatar_url) AS avatar
    FROM experience_people ep
    JOIN users u ON u.id = ep.user_id
    LEFT JOIN org_profiles op ON op.user_id = ep.user_id AND op.org_id = ${ORG}
    WHERE ep.thread_id = ANY(${ids})
    ORDER BY ep.role, ep.position
  `) as unknown as Row[];
  for (const r of rows) {
    const list = out.get(r.thread_id as string) ?? [];
    const slug = (r.slug as string | null) ?? null;
    list.push({
      userId: r.user_id as string,
      role: r.role as "artist" | "host",
      position: Number(r.position),
      name: (r.display_name as string | null) ?? String(r.email ?? "").split("@")[0] ?? "",
      slug,
      avatarUrl: (r.avatar as string | null) ?? null,
      profileUrl: artistProfileUrl(slug),
    });
    out.set(r.thread_id as string, list);
  }
  return out;
}

function mapExperience(r: Row, people: ExperiencePerson[]): Experience {
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  const x = (meta.experience ?? {}) as Record<string, unknown>;
  const price = r.price == null ? null : Number(r.price);
  const format = FORMATS.includes(x.format as ExperienceFormat) ? (x.format as ExperienceFormat) : r.is_online ? "online" : "in_person";
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    status: r.status as string,
    visibility: r.visibility as string,
    body: (r.body as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    coverImageUrl: typeof meta.coverImageUrl === "string" ? meta.coverImageUrl : null,
    location: (r.location as string | null) ?? null,
    isOnline: Boolean(r.is_online),
    durationMinutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
    price: price != null && Number.isFinite(price) ? price : null,
    currency: (r.currency as string | null) ?? siteConfig.currency,
    format,
    highlights: Array.isArray(x.highlights) ? (x.highlights as unknown[]).filter((s): s is string => typeof s === "string" && s.trim() !== "") : [],
    lat: typeof x.lat === "number" ? x.lat : null,
    lng: typeof x.lng === "number" ? x.lng : null,
    serviceThreadId: typeof x.serviceThreadId === "string" ? x.serviceThreadId : null,
    placeId: typeof x.placeId === "string" ? x.placeId : null,
    serviceUrl: artistServiceUrl((r.service_user_slug as string | null) ?? null, (r.service_slug as string | null) ?? null),
    page: meta.page ?? null,
    people,
    publishedAt: iso(r.published_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

async function withPeople(rows: Row[]): Promise<Experience[]> {
  const people = await peopleFor(rows.map((r) => r.id as string));
  return rows.map((r) => mapExperience(r, people.get(r.id as string) ?? []));
}

const PUBLIC = db`t.status = 'published' AND t.visibility = 'PUBLIC'`;

/**
 * Read options. Defaults are the public view: published + PUBLIC only.
 *   includeDrafts        editors: any status except archived (any visibility).
 *   includeOrganization  members: published PUBLIC or ORGANIZATION (members-only) experiences.
 */
export interface ExperienceReadOptions {
  includeDrafts?: boolean;
  includeOrganization?: boolean;
}
const readFilter = (o: ExperienceReadOptions) =>
  o.includeDrafts
    ? db`AND t.status <> 'archived'`
    : o.includeOrganization
      ? db`AND t.status = 'published' AND t.visibility IN ('PUBLIC','ORGANIZATION')`
      : db`AND ${PUBLIC}`;

export async function listExperiences(opts: ExperienceReadOptions = {}): Promise<Experience[]> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      WHERE t.org_id = ${ORG} AND t.kind = ${EXPERIENCE_KIND}
        ${readFilter(opts)}
      ORDER BY t.pinned DESC, t.published_at DESC NULLS LAST, t.created_at DESC
      LIMIT 200
    `) as unknown as Row[];
    return await withPeople(rows);
  } catch (err) {
    console.error("[elktours] listExperiences:", err);
    return [];
  }
}

export async function getExperienceBySlug(slug: string, opts: ExperienceReadOptions = {}): Promise<Experience | null> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS}
      WHERE t.org_id = ${ORG} AND t.kind = ${EXPERIENCE_KIND} AND (t.slug = ${slug} OR t.id = ${slug})
        ${readFilter(opts)}
      LIMIT 1
    `) as unknown as Row[];
    return (await withPeople(rows))[0] ?? null;
  } catch (err) {
    console.error(`[elktours] getExperienceBySlug(${slug}):`, err);
    return null;
  }
}

/** Editor read: any status. */
export async function getExperienceById(id: string): Promise<Experience | null> {
  try {
    const rows = (await db`
      SELECT ${COLUMNS} WHERE t.org_id = ${ORG} AND t.kind = ${EXPERIENCE_KIND} AND t.id = ${id} LIMIT 1
    `) as unknown as Row[];
    return (await withPeople(rows))[0] ?? null;
  } catch (err) {
    console.error(`[elktours] getExperienceById(${id}):`, err);
    return null;
  }
}

export async function listExperienceTours(id: string, opts: { publishedOnly?: boolean } = {}): Promise<ExperienceTourUse[]> {
  try {
    const rows = (await db`
      SELECT s.id AS stop_id, s.thread_id, s.position, t.title, t.slug, t.status
      FROM tour_stops s JOIN threads t ON t.id = s.thread_id
      WHERE s.experience_id = ${id} AND s.org_id = ${ORG}
        ${opts.publishedOnly ? db`AND t.status = 'published' AND t.visibility = 'PUBLIC'` : db``}
      ORDER BY t.title, s.position
    `) as unknown as Row[];
    return rows.map((r) => ({
      stopId: r.stop_id as string,
      threadId: r.thread_id as string,
      tourTitle: r.title as string,
      tourSlug: r.slug as string,
      tourStatus: r.status as string,
      position: Number(r.position),
    }));
  } catch (err) {
    console.error("[elktours] listExperienceTours:", err);
    return [];
  }
}

/** People who can be linked as artist or host: elktours members plus oad (collective) artists, filtered by name. */
export async function listPersonOptions(q?: string): Promise<PersonOption[]> {
  const like = q?.trim() ? `%${q.trim().toLowerCase()}%` : null;
  try {
    const rows = (await db`
      SELECT DISTINCT ON (u.id) u.id, u.display_name, u.email, u.slug, u.avatar_url, uo.role, uo.org_id
      FROM user_organizations uo JOIN users u ON u.id = uo.user_id
      WHERE ((uo.org_id = ${ORG} AND uo.role IN ('owner','guide','member'))
             OR (uo.org_id = 'oad' AND uo.role <> 'viewer'))
        ${like ? db`AND (lower(COALESCE(u.display_name, '')) LIKE ${like} OR lower(u.email) LIKE ${like} OR lower(COALESCE(u.slug, '')) LIKE ${like})` : db``}
      ORDER BY u.id, (uo.org_id = ${ORG}) DESC
      LIMIT 200
    `) as unknown as Row[];
    return rows
      .map((r) => ({
        userId: r.id as string,
        name: (r.display_name as string | null) ?? String(r.email).split("@")[0]!,
        slug: (r.slug as string | null) ?? null,
        avatarUrl: (r.avatar_url as string | null) ?? null,
        role: r.org_id === ORG ? (r.role as string) : "artist",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[elktours] listPersonOptions:", err);
    return [];
  }
}

/** A user's public kind=service threads (any org), for the service picker. */
export async function listServiceOptions(userId: string): Promise<ServiceOption[]> {
  try {
    const rows = (await db`
      SELECT t.id, t.title, t.slug, t.price, t.currency, u.slug AS user_slug
      FROM threads t JOIN users u ON u.id = t.author_id
      WHERE t.author_id = ${userId} AND t.kind = 'service' AND t.status = 'published' AND t.visibility = 'PUBLIC'
      ORDER BY t.title
      LIMIT 100
    `) as unknown as Row[];
    return rows.map((r) => ({
      threadId: r.id as string,
      title: r.title as string,
      slug: r.slug as string,
      price: r.price == null ? null : Number(r.price),
      currency: (r.currency as string | null) ?? null,
      url: artistServiceUrl((r.user_slug as string | null) ?? null, r.slug as string),
    }));
  } catch (err) {
    console.error("[elktours] listServiceOptions:", err);
    return [];
  }
}

/** Copy on pick. An online experience gives a stop with no coordinates (route and stills skip it). */
export function stopDraftFromExperience(e: Experience): StopDraft {
  const placed = e.format !== "online" && e.lat != null && e.lng != null;
  return {
    id: null,
    title: e.title,
    body: e.excerpt ? `<p>${e.excerpt.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>` : e.body,
    lat: placed ? e.lat : null,
    lng: placed ? e.lng : null,
    heading: null,
    pitch: null,
    fov: null,
    imageUrl: e.coverImageUrl,
    durationMinutes: e.durationMinutes,
    placeId: null,
    experienceId: e.id,
  };
}

/** Is this user linked to the experience (artist or host)? For /studio/experience access. */
export async function isExperiencePerson(experienceId: string, userId: string): Promise<boolean> {
  const rows = (await db`
    SELECT 1 FROM experience_people WHERE thread_id = ${experienceId} AND user_id = ${userId} LIMIT 1
  `) as unknown as Row[];
  return rows.length > 0;
}
