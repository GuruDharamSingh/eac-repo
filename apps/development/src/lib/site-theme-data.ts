import themesJson from "@/data/themes.json";
import pagesJson from "@/data/site-pages.json";
import cssJson from "@/data/site-css.json";
import rolesJson from "@/data/theme-roles.json";
import type { PaletteRole, RoleBinding, SiteFamily, SitePage, SiteVarRow, ThemeRoleDef, ThemeSite } from "@/themes/types";
import { SCHEMAS } from "@/themes/schemas";

// Server side only (read in the gated /themes page and passed down as props).
// A site is a data entry: scripts/site-pages.seed.json (pages, css files, header/footer markup) baked into
// src/data/site-pages.json and site-css.json by the refresh scripts, joined here to its themes.json entry.

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Variables that belong to the whole site, not to one component's local override. */
const SITE_WIDE = (scope: string) => scope === "" || /^(:root|:root:root|@theme|@theme inline|@plugin|\(editor default)/.test(scope);

export function loadThemeSites(): ThemeSite[] {
  const apps = rec(rec(themesJson).apps);
  const sites = rec(rec(pagesJson).sites);
  const css = rec(cssJson);
  const out: ThemeSite[] = [];
  for (const [id, raw] of Object.entries(sites)) {
    const s = rec(raw);
    const t = rec(apps[id]);
    const seen = new Set<string>();
    const vars: SiteVarRow[] = [];
    for (const row of arr(t.vars)) {
      const r = rec(row);
      const name = str(r.name);
      if (!name || seen.has(name) || r.dark === true || !SITE_WIDE(str(r.scope))) continue;
      seen.add(name);
      vars.push({ name, value: str(r.value), kind: str(r.kind) || "other", family: str(r.family) });
    }
    const families: SiteFamily[] = arr(t.families).map((f) => {
      const o = rec(f);
      return { id: str(o.id), count: typeof o.count === "number" ? o.count : 0, description: str(o.description) };
    });
    const roles: PaletteRole[] = arr(t.paletteRoles).map((r) => {
      const o = rec(r);
      return { key: str(o.key), label: str(o.label), group: str(o.group) || "site", vars: arr(o.vars).map(str), fallback: str(o.fallback), follows: str(o.follows) || undefined };
    });
    const fontChoices = arr(t.schemaFonts)
      .map((f) => str(rec(f).label))
      .filter(Boolean)
      .map((label) => ({ label, stack: `"${label}", system-ui, sans-serif` }));
    out.push({
      id,
      label: str(s.label) || str(t.label) || id,
      editor: str(t.editor) || "none",
      vars,
      families,
      roles,
      fontChoices,
      css: str(css[id]),
      frame: str(s.frame),
      pages: arr(s.pages).map((p) => p as SitePage),
      hasSchema: id in SCHEMAS,
      roleMap: roleMapFor(id),
    });
  }
  return out;
}

/** The shared role list (theme-roles.json, written by the theme-language worker), in its own order. */
export function loadRoleDefs(): ThemeRoleDef[] {
  return arr(rec(rolesJson).roles).map((r) => {
    const o = rec(r);
    return { id: str(o.id), label: str(o.label), group: str(o.group) || "colour", core: o.core === true, description: str(o.description) };
  });
}

function roleMapFor(id: string): Record<string, RoleBinding> {
  const m = rec(rec(rec(rolesJson).maps)[id]);
  const out: Record<string, RoleBinding> = {};
  for (const [role, b] of Object.entries(m)) {
    const o = rec(b);
    const v = str(o.var);
    if (!v || !str(o.value)) continue;
    out[role] = { var: v, value: str(o.value), hex: str(o.hex) || undefined };
  }
  return out;
}
