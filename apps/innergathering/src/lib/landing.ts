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
 * The admin-set values (fundraising, image spaces, the about document) live in `site_config` under the `elkdonis` org —
 * that is where the old admin screens wrote them and they are still the
 * collective's copy. Threads are inner_group's.
 */

const CONFIG_ORG = siteConfig.landingConfigOrgId;
const ORG = siteConfig.orgId;

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
  const [fundraising, imageSpaces, about] = await Promise.all([
    readConfig<FundraisingConfig>("fundraising"),
    readConfig<ImageSpacesConfig>("image_spaces"),
    readConfig<AboutDocument>("about_document"),
  ]);
  return {
    fundraising: fundraising ?? {},
    imageSpaces: imageSpaces ?? {},
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

// ── the forum thread for the work question ──────────────────────────────────

/**
 * The public forum thread that carries the current work question: the newest
 * published, public thread in this org whose title is the question itself.
 * Matching on the title rather than storing an id means a new question only
 * needs a thread of the same name to move the landing page's forum with it.
 */
export async function getWorkQuestionThread(question: string): Promise<{ id: string; slug: string } | null> {
  try {
    const [row] = await db<{ id: string; slug: string | null }[]>`
      SELECT id, slug FROM threads
      WHERE org_id = ${ORG} AND status = 'published' AND visibility = 'PUBLIC'
        AND lower(trim(title)) = lower(trim(${question}))
      ORDER BY created_at DESC LIMIT 1
    `;
    return row ? { id: row.id, slug: row.slug ?? "topic" } : null;
  } catch (err) {
    console.error("[innergathering] work question thread:", err);
    return null;
  }
}
