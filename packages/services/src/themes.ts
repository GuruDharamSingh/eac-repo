import { db } from '@elkdonis/db';

// ============================================================================
// Themes — CSS custom property overrides per site, page and person.
//
// The whole mechanism is: resolve a bag of {"--name":"value"}, render it as a
// <style> block, let the cascade do the rest. Nothing imports a palette; the
// shared embeds already read var(--card), var(--primary) and friends, so they
// restyle without knowing a theme exists.
//
// This module never decides WHICH variables an app exposes — each app declares
// its own CssVarDef[] (arts-collective uses the shadcn set, IFAC its own
// --ink/--paper/--oxide). Storing an untyped map is what lets one table serve
// apps that share no vocabulary.
// ============================================================================

export type ThemeVars = Record<string, string>;

/** Site default when page_key is omitted. */
export const SITE_DEFAULT_PAGE = '';

/**
 * Only these characters may appear in a variable name or value.
 *
 * Values land inside a <style> block, so a value containing `}` or `<` could
 * close the rule and inject arbitrary CSS — or worse, close the tag. Themes are
 * editable by org owners rather than platform admins, so this is a real trust
 * boundary and not decoration. Anything failing the test is dropped rather than
 * escaped: a silently ignored colour is a much better failure than a broken
 * stylesheet on every page of a site.
 */
const NAME_RE = /^--[a-z0-9-]{1,60}$/i;
const VALUE_RE = /^[a-z0-9\s.,%#()/_-]{1,120}$/i;

export function sanitizeThemeVars(vars: unknown): ThemeVars {
  if (!vars || typeof vars !== 'object') return {};
  const out: ThemeVars = {};
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const name = k.trim();
    const value = v.trim();
    if (!NAME_RE.test(name) || !VALUE_RE.test(value)) continue;
    out[name] = value;
  }
  return out;
}

async function readSiteTheme(orgId: string, pageKey: string): Promise<ThemeVars> {
  try {
    const [row] = await db<Array<{ vars: unknown }>>`
      SELECT vars FROM site_themes
      WHERE org_id = ${orgId} AND page_key = ${pageKey}
      LIMIT 1
    `;
    return sanitizeThemeVars(row?.vars);
  } catch (err) {
    console.error(`[themes] readSiteTheme(${orgId}, ${pageKey}):`, err);
    return {};
  }
}

/**
 * The theme actually in force.
 *
 * Precedence is explicit because it genuinely differs by whose page it is:
 *
 *   'org'   an organisation's site. The ORG WINS. IFAC standardises its own
 *           look across every page it serves, including the profile pages of
 *           artists who have chosen their own palette elsewhere. A member's
 *           personal colours must not repaint someone else's site.
 *
 *   'user'  the person's own home (ArtDirect). Their palette wins, because
 *           there is no org whose brand is at stake.
 *
 * Defaulting to 'org' is deliberate: an org site is the common case, and the
 * failure mode of getting it wrong there (a member quietly restyling the
 * org's pages) is much worse than the reverse.
 */
export async function resolveTheme(opts: {
  orgId?: string | null;
  pageKey?: string;
  userId?: string | null;
  precedence?: 'org' | 'user';
}): Promise<ThemeVars> {
  const precedence = opts.precedence ?? 'org';

  const orgLayers: ThemeVars[] = [];
  if (opts.orgId) {
    orgLayers.push(await readSiteTheme(opts.orgId, SITE_DEFAULT_PAGE));
    if (opts.pageKey) orgLayers.push(await readSiteTheme(opts.orgId, opts.pageKey));
  }

  let userLayer: ThemeVars = {};
  if (opts.userId) {
    try {
      const [row] = await db<Array<{ theme: unknown }>>`
        SELECT theme FROM users WHERE id = ${opts.userId} LIMIT 1
      `;
      userLayer = sanitizeThemeVars(row?.theme);
    } catch (err) {
      console.error(`[themes] resolveTheme user(${opts.userId}):`, err);
    }
  }

  // Later layers win per-variable.
  const ordered =
    precedence === 'org' ? [userLayer, ...orgLayers] : [...orgLayers, userLayer];

  return Object.assign({}, ...ordered) as ThemeVars;
}

/** Just this scope's own overrides — what an editor should load, unmerged. */
export async function getThemeOverrides(opts: {
  orgId?: string | null;
  pageKey?: string;
  userId?: string | null;
}): Promise<ThemeVars> {
  if (opts.userId) {
    try {
      const [row] = await db<Array<{ theme: unknown }>>`
        SELECT theme FROM users WHERE id = ${opts.userId} LIMIT 1
      `;
      return sanitizeThemeVars(row?.theme);
    } catch {
      return {};
    }
  }
  if (opts.orgId) return readSiteTheme(opts.orgId, opts.pageKey ?? SITE_DEFAULT_PAGE);
  return {};
}

export async function saveSiteTheme(
  orgId: string,
  pageKey: string,
  vars: ThemeVars,
  updatedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const clean = sanitizeThemeVars(vars);
  try {
    await db`
      INSERT INTO site_themes (org_id, page_key, vars, updated_by, updated_at)
      VALUES (${orgId}, ${pageKey}, ${db.json(clean as any)}, ${updatedBy}, NOW())
      ON CONFLICT (org_id, page_key)
      DO UPDATE SET vars = EXCLUDED.vars,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[themes] saveSiteTheme(${orgId}, ${pageKey}):`, err);
    return { ok: false, error: 'Could not save theme' };
  }
}

export async function saveUserTheme(
  userId: string,
  vars: ThemeVars
): Promise<{ ok: boolean; error?: string }> {
  const clean = sanitizeThemeVars(vars);
  try {
    await db`UPDATE users SET theme = ${db.json(clean as any)} WHERE id = ${userId}`;
    return { ok: true };
  } catch (err) {
    console.error(`[themes] saveUserTheme(${userId}):`, err);
    return { ok: false, error: 'Could not save theme' };
  }
}

/**
 * The :root rule for a resolved theme, or null when there is nothing to say.
 *
 * Returning null rather than an empty rule matters: callers render nothing at
 * all for an unthemed site, so the default stylesheet is untouched and there is
 * no empty <style> on every page.
 */
export function renderThemeCss(vars: ThemeVars): string | null {
  const entries = Object.entries(sanitizeThemeVars(vars));
  if (entries.length === 0) return null;
  return `:root{${entries.map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
