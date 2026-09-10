import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Everything the landing page reads, in one file.
 *
 * The previous site's landing was a stack of client components each fetching
 * its own admin-set copy from /api/admin/site-config on mount, so the page
 * arrived blank and filled in. Here every read happens server-side, in
 * parallel, and the page arrives with its words on it.
 *
 * The admin-set values (featured artist, the initiative, fundraising, image
 * spaces, featured threads) live in `site_config` under the `elkdonis` org —
 * that is where the old admin screens wrote them and they are still the
 * collective's copy. Threads are inner_group's.
 */

const CONFIG_ORG = siteConfig.landingConfigOrgId;
const ORG = siteConfig.orgId;

export interface InitiativeConfig {
  eyebrow?: string;
  heading?: string;
  body?: string;
  cta?: string;
}

export interface FeaturedArtistConfig {
  eyebrow?: string;
  name?: string;
  description?: string;
  image_url?: string;
  cta?: string;
  goals?: string;
  link1_label?: string;
  link1_url?: string;
  link2_label?: string;
  link2_url?: string;
}

export interface FundraisingConfig {
  goal?: number;
  raised?: number;
  status?: string;
  url?: string;
  cta?: string;
  currency?: string;
}

export interface ImageSpacesConfig {
  /** The portrait beside the wordmark. Falls back to intro_banner. */
  hero?: { path?: string; alt?: string };
  intro_banner?: { path?: string; alt?: string };
  featured_artist?: { path?: string };
  gallery?: { images?: unknown[] };
}

export interface AboutDocument {
  fileId: string;
  url: string;
  editUrl: string;
  shareToken: string;
  createdAt: string;
}

async function readConfig<T>(key: string): Promise<T | null> {
  try {
    const [row] = await db<{ value: T }[]>`
      SELECT value FROM site_config WHERE org_id = ${CONFIG_ORG} AND key = ${key} LIMIT 1
    `;
    return row?.value ?? null;
  } catch (err) {
    console.error(`[innergathering] site_config ${key}:`, err);
    return null;
  }
}

export async function getLandingConfig() {
  const [initiative, featuredArtist, fundraising, imageSpaces, featured, about] = await Promise.all([
    readConfig<InitiativeConfig>("initiative"),
    readConfig<FeaturedArtistConfig>("featured_artist"),
    readConfig<FundraisingConfig>("fundraising"),
    readConfig<ImageSpacesConfig>("image_spaces"),
    readConfig<{ threadIds?: string[] }>("featured_events"),
    readConfig<AboutDocument>("about_document"),
  ]);
  return {
    initiative: initiative ?? {},
    featuredArtist: featuredArtist ?? {},
    fundraising: fundraising ?? {},
    imageSpaces: imageSpaces ?? {},
    featuredThreadIds: Array.isArray(featured?.threadIds)
      ? featured!.threadIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
    aboutDocument: about,
  };
}

/** Turn an admin-entered media path into something this app can serve. */
export function mediaSrc(path: string | undefined | null, fallback: string | null = null): string | null {
  if (!path) return fallback;
  const input = path.trim();
  if (!input) return fallback;
  if (/^https?:\/\//.test(input) || input.startsWith("/")) return input;
  const trimmed = input.replace(/^\/+/, "");
  const idx = trimmed.indexOf("EAC_Network/");
  const normalized = idx >= 0 ? trimmed.slice(idx) : trimmed;
  return normalized ? `/api/media/${normalized}` : fallback;
}

// ── the work question ───────────────────────────────────────────────────────

export interface WorkQuestion {
  id: string;
  question: string;
}
export interface WorkQuestionResponse {
  displayName: string | null;
  response: string;
  at: string;
}

export async function getWorkQuestion(): Promise<{ question: WorkQuestion; responses: WorkQuestionResponse[] } | null> {
  try {
    const [q] = await db<{ id: string; question: string }[]>`
      SELECT id, question FROM work_questions
      WHERE org_id = ${ORG} AND is_active = TRUE
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!q) return null;
    const rows = await db<{ display_name: string | null; response: string; created_at: Date }[]>`
      SELECT display_name, response, created_at FROM work_question_responses
      WHERE question_id = ${q.id} ORDER BY created_at DESC LIMIT 40
    `;
    return {
      question: { id: q.id, question: q.question },
      responses: rows.map((r) => ({ displayName: r.display_name, response: r.response, at: r.created_at.toISOString() })),
    };
  } catch (err) {
    console.error("[innergathering] work question:", err);
    return null;
  }
}

// ── threads on the landing ──────────────────────────────────────────────────

export interface LandingThread {
  id: string;
  kind: string;
  title: string;
  excerpt: string | null;
  scheduledAt: string | null;
  recurrencePattern: string | null;
  location: string | null;
  isOnline: boolean;
  authorName: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  href: string;
}

interface Row {
  id: string;
  kind: string;
  title: string;
  slug: string;
  section: string | null;
  excerpt: string | null;
  scheduled_at: Date | null;
  recurrence_pattern: string | null;
  location: string | null;
  is_online: boolean | null;
  author_name: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
}

function map(row: Row): LandingThread {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    excerpt: row.excerpt,
    scheduledAt: row.scheduled_at ? row.scheduled_at.toISOString() : null,
    recurrencePattern: row.recurrence_pattern,
    location: row.location,
    isOnline: Boolean(row.is_online),
    authorName: row.author_name,
    avatarUrl: row.avatar_url,
    coverImageUrl: row.cover_image_url,
    href: `/${row.section ?? "offerings"}/${row.slug}`,
  };
}

const COLS = db`
  t.id, t.kind, t.title, t.slug, t.section, t.excerpt, t.scheduled_at,
  t.recurrence_pattern, t.location, t.is_online,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  u.display_name AS author_name, u.avatar_url
`;

/** The admin's chosen threads, in their order. */
export async function listFeaturedThreads(ids: string[]): Promise<LandingThread[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await db<Row[]>`
      WITH selected AS (
        SELECT id, ord FROM unnest(${ids}::text[]) WITH ORDINALITY AS ids(id, ord)
      )
      SELECT ${COLS}
      FROM selected
      JOIN threads t ON t.id = selected.id
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.status = 'published' AND t.visibility = 'PUBLIC'
      ORDER BY selected.ord ASC
    `;
    return rows.map(map);
  } catch (err) {
    console.error("[innergathering] featured threads:", err);
    return [];
  }
}

/**
 * The mini feed beside the initiative: standing (recurring) meetings, and
 * when there are few, a pinned post or meeting to round it out.
 */
export async function listMiniFeed(): Promise<LandingThread[]> {
  try {
    const recurring = await db<Row[]>`
      SELECT ${COLS}
      FROM threads t LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.kind IN ('meeting', 'event') AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
        AND t.recurrence_pattern IS NOT NULL AND t.recurrence_pattern <> 'NONE'
      ORDER BY t.scheduled_at ASC NULLS LAST LIMIT 3
    `;
    const items = recurring.map(map);
    if (recurring.length <= 2) {
      const exclude = new Set(recurring.map((r) => r.id));
      const pinned = await db<Row[]>`
        SELECT ${COLS}
        FROM threads t LEFT JOIN users u ON u.id = t.author_id
        WHERE t.org_id = ${ORG} AND t.kind IN ('meeting', 'post', 'workshop') AND t.status = 'published'
          AND t.visibility = 'PUBLIC' AND COALESCE(t.pinned, false) = true
        ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC LIMIT 4
      `;
      const extra = pinned.find((p) => !exclude.has(p.id));
      if (extra) items.push(map(extra));
    }
    return items;
  } catch (err) {
    console.error("[innergathering] mini feed:", err);
    return [];
  }
}
