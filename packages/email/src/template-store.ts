import { db } from '@elkdonis/db';

// ============================================================================
// Where an organisation's own version of an email lives.
//
// Three layers, resolved newest-wins at send time:
//
//   1. the network default     packages/email/src/copy.ts — always present
//   2. `bodyText` / `links` / `media`
//                              the org's own words, typed into a form
//   3. `html` (+ `project`)    the org's own LAYOUT, composed in the
//                              newsletter editor — replaces the body entirely
//
// Storage is `email_template_settings (org_id, template_key, config jsonb)`,
// which already existed and already had the unique key this needs. `project`
// is the editor's own save format, kept verbatim so a letter can be reopened
// and edited; `html` is what actually sends, inlined at save time because
// juice runs in the browser and the send path has no editor.
//
// NOTHING here is an authorisation boundary. Every function takes the orgId it
// is given — the caller must already have established that the viewer may edit
// that organisation.
// ============================================================================

/** The keys the suite knows about. An org may only override these. */
/**
 * A template key is also a URL SEGMENT: innergathering serves
 * `/hub/email/<key>` and `/api/hub/email/<key>` beside static siblings named
 * `addresses`, `identity`, `messages` and `preview`. Next matches a static
 * segment before a dynamic one, so a key equal to any of those would be
 * silently shadowed — the editor would open the wrong route with no error.
 *
 * None collide today. Check before adding one.
 */
export const TEMPLATE_KEYS = [
  'welcome',
  'provisioning',
  'rsvp-guest',
  'rsvp-owner',
  'reminder',
  'meeting-trigger',
  'contact-owner',
  'newsletter',
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

/**
 * A per-thread override: `reminder:th_abc123` beats plain `reminder` for that
 * one thread. The convention predates this file — amrit-canada and
 * inner-gathering both write keys in this shape — so it is honoured rather
 * than replaced.
 */
export function threadTemplateKey(key: TemplateKey, threadId: string): string {
  return `${key}:${threadId}`;
}

export interface EmailLinkItem {
  label: string;
  url: string;
}

export interface EmailMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface OrgTemplate {
  orgId: string;
  templateKey: string;
  /** Layer 2 — the org's words. */
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
  materialIds?: string[];
  recipients?: string[];
  /** Layer 3 — the org's layout, inlined and ready to send. */
  html?: string;
  /** The editor's own project data, so the letter can be reopened. */
  project?: unknown;
  updatedAt?: string;
}

/** Refuse anything that would not survive being read back. */
const MAX_BYTES = 512 * 1024;

function cleanLinks(value: unknown): EmailLinkItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}))
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label.trim().slice(0, 120) : '',
      url: typeof item.url === 'string' ? item.url.trim() : '',
    }))
    // A link with no URL renders as a dead word; a javascript: URL in an email
    // does nothing in a mail client but everything in a preview pane.
    .filter((item) => item.url && /^https?:\/\//i.test(item.url))
    .slice(0, 20);
  return out.length ? out : undefined;
}

function cleanMedia(value: unknown): EmailMediaItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}))
    .map((item) => ({
      url: typeof item.url === 'string' ? item.url.trim() : '',
      alt: typeof item.alt === 'string' ? item.alt.slice(0, 200) : undefined,
      caption: typeof item.caption === 'string' ? item.caption.slice(0, 300) : undefined,
    }))
    .filter((item) => /^https?:\/\//i.test(item.url))
    .slice(0, 20);
  return out.length ? out : undefined;
}

function cleanStrings(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
  return out.length ? out : undefined;
}

/**
 * Read a config column that may be double-encoded.
 *
 * Every row written before this file existed went in as
 * `${JSON.stringify(config)}::jsonb` — the postgres.js driver serialises the
 * string, then `::jsonb` parses it back into a jsonb STRING rather than an
 * object. `jsonb_typeof` on all four rows in production says "string". Reading
 * those as objects silently returns undefined for every field, which would
 * have thrown away every customisation an org has made so far without an
 * error anywhere.
 *
 * New writes use `db.json()` and land as objects. This copes with both, so the
 * repair migration and the code can ship independently.
 */
function parseConfig(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function loadOrgTemplate(
  orgId: string,
  templateKey: string
): Promise<OrgTemplate | null> {
  try {
    const [row] = await db<Array<{ config: unknown; updated_at: string }>>`
      SELECT config, updated_at
      FROM email_template_settings
      WHERE org_id = ${orgId} AND template_key = ${templateKey}
      LIMIT 1
    `;
    if (!row) return null;
    const c = parseConfig(row.config);
    return {
      orgId,
      templateKey,
      bodyText: typeof c.bodyText === 'string' ? c.bodyText : undefined,
      links: cleanLinks(c.links),
      media: cleanMedia(c.media),
      materialIds: cleanStrings(c.materialIds, 50),
      recipients: cleanStrings(c.recipients, 200),
      html: typeof c.html === 'string' && c.html.trim() ? c.html : undefined,
      project: c.project ?? null,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error(`[email] loadOrgTemplate(${orgId}/${templateKey}):`, err);
    return null;
  }
}

/**
 * The template that applies to a specific thread, if any, else the org's.
 *
 * One round trip rather than two sequential lookups, and `ORDER BY length`
 * puts the thread-scoped key first because it is the longer of the two.
 */
export async function resolveOrgTemplate(
  orgId: string,
  templateKey: TemplateKey,
  threadId?: string
): Promise<OrgTemplate | null> {
  if (!threadId) return loadOrgTemplate(orgId, templateKey);

  try {
    const [row] = await db<Array<{ template_key: string }>>`
      SELECT template_key FROM email_template_settings
      WHERE org_id = ${orgId}
        AND template_key IN (${threadTemplateKey(templateKey, threadId)}, ${templateKey})
      ORDER BY length(template_key) DESC
      LIMIT 1
    `;
    return row ? loadOrgTemplate(orgId, row.template_key) : null;
  } catch (err) {
    console.error(`[email] resolveOrgTemplate(${orgId}/${templateKey}):`, err);
    return null;
  }
}

export async function listOrgTemplates(orgId: string): Promise<OrgTemplate[]> {
  try {
    const rows = await db<Array<{ template_key: string; config: unknown; updated_at: string }>>`
      SELECT template_key, config, updated_at
      FROM email_template_settings
      WHERE org_id = ${orgId}
      ORDER BY template_key
    `;
    return rows.map((row) => {
      const c = parseConfig(row.config);
      return {
        orgId,
        templateKey: row.template_key,
        bodyText: typeof c.bodyText === 'string' ? c.bodyText : undefined,
        html: typeof c.html === 'string' && c.html.trim() ? c.html : undefined,
        updatedAt: row.updated_at,
      };
    });
  } catch (err) {
    console.error(`[email] listOrgTemplates(${orgId}):`, err);
    return [];
  }
}

export async function saveOrgTemplate(
  orgId: string,
  templateKey: string,
  /**
   * A field left `undefined` is untouched; a field set to `null` is CLEARED.
   * Clearing has to be expressible or an org can never take its own words back
   * out of a letter.
   */
  input: {
    [K in keyof Omit<OrgTemplate, 'orgId' | 'templateKey' | 'updatedAt'>]?:
      | Omit<OrgTemplate, 'orgId' | 'templateKey' | 'updatedAt'>[K]
      | null;
  },
  updatedBy?: string
): Promise<{ ok: boolean; error?: string }> {
  // Merge, do not replace: the simple form writes bodyText, the editor writes
  // html/project, and each must survive the other being saved afterwards.
  const existing = await loadOrgTemplate(orgId, templateKey);

  // `undefined` LEAVES a field alone; `null` CLEARS it.
  //
  // The distinction is load-bearing and was missing. Callers expressed "go back
  // to the network's words" by passing `bodyText: undefined`, which reads as
  // "leave it alone" — so the old words were merged straight back in and
  // **clearing an override had never once worked**. Same convention as
  // saveOrgEmailIdentity, for the same reason.
  const keep = <K extends keyof typeof input>(key: K, current: unknown) => {
    const next = input[key];
    if (next === null) return {};                        // clear
    if (next !== undefined) return { [key]: next };      // set
    return current === undefined || current === null ? {} : { [key]: current };
  };

  const config: Record<string, unknown> = {
    ...keep('bodyText', existing?.bodyText),
    ...keep('links', existing?.links),
    ...keep('media', existing?.media),
    ...keep('materialIds', existing?.materialIds),
    ...keep('recipients', existing?.recipients),
    ...keep('html', existing?.html),
    ...keep('project', existing?.project),
  };

  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > MAX_BYTES) {
    return { ok: false, error: `Too large to store (${Math.round(bytes / 1024)}KB)` };
  }

  try {
    await db`
      INSERT INTO email_template_settings (id, org_id, template_key, config, created_by, updated_by)
      VALUES (${crypto.randomUUID()}, ${orgId}, ${templateKey}, ${db.json(config as never)}, ${updatedBy ?? null}, ${updatedBy ?? null})
      ON CONFLICT (org_id, template_key) DO UPDATE
        SET config = ${db.json(config as never)},
            updated_by = ${updatedBy ?? null},
            updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[email] saveOrgTemplate(${orgId}/${templateKey}):`, err);
    return { ok: false, error: 'Could not save' };
  }
}

/** Drop an org's override so the network default applies again. */
export async function clearOrgTemplate(orgId: string, templateKey: string): Promise<boolean> {
  try {
    await db`
      DELETE FROM email_template_settings
      WHERE org_id = ${orgId} AND template_key = ${templateKey}
    `;
    return true;
  } catch (err) {
    console.error(`[email] clearOrgTemplate(${orgId}/${templateKey}):`, err);
    return false;
  }
}
