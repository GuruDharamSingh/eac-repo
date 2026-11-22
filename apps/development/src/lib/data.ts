import blocksJson from "@/data/blocks.json";
import themesJson from "@/data/themes.json";
import designJson from "@/data/design-system.json";
import type { CatalogEntry, DesignSystem, ThemeApp } from "./types";
import { testTheme } from "@/theme/test-theme";

// Server side only: these files are read in gated server components and passed
// down as props, so they are never part of a client bundle that a signed-out
// visitor could fetch.

type Loose = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});

export function loadCatalog(): CatalogEntry[] {
  const raw: unknown[] = Array.isArray(blocksJson) ? blocksJson : list(rec(blocksJson).blocks);
  const out: CatalogEntry[] = [];
  for (const item of raw) {
    const r = rec(item);
    const id = str(r.id) ?? str(r.type) ?? str(r.name);
    if (!id) continue;
    const app = str(r.app) ?? str(r.owner) ?? "shared";
    out.push({
      key: `${app}:${id}`,
      id,
      label: str(r.label) ?? id,
      app,
      pkg: str(r.package) ?? str(r.pkg),
      source: str(r.source) ?? str(r.file) ?? str(r.path),
      category: str(r.category),
      description: str(r.description),
      dataDriven: r.dataDriven === true,
      interactive: r.interactive === true,
      propCount: num(r.propCount) ?? (Array.isArray(r.props) ? r.props.length : undefined),
      parts: list(r.parts)
        .map((p) => (typeof p === "string" ? p : (str(rec(p).name) ?? "")))
        .filter(Boolean),
      importable: str(r.importable) ?? (r.importable === true ? "yes" : undefined),
      blocker: str(r.blocker),
      props: list(r.props).map((p) => {
        const o = rec(p);
        return { name: str(o.name) ?? "", kind: str(o.kind), label: str(o.label), default: o.default };
      }).filter((p) => p.name),
    });
  }
  return out;
}

const isColour = (v: string) => /^(#|rgb|hsl|oklch|oklab|color\()/i.test(v.trim());

/**
 * themes.json: `apps` is an array of {id,...} or an object keyed by app. Per app, the preview
 * variables are `varMap` ({--x: value}) or `vars` as an object, or an array of {name,value,scope?}
 * (rows scoped "dark" are skipped: the preview wrapper takes the light set).
 */
export function loadThemes(): ThemeApp[] {
  const top = rec(themesJson);
  const appsRaw = Array.isArray(themesJson) ? themesJson : (top.apps ?? top.themes);
  const entries: [string, Loose][] = Array.isArray(appsRaw)
    ? appsRaw.map((r) => [str(rec(r).id) ?? str(rec(r).app) ?? "", rec(r)] as [string, Loose])
    : Object.entries(rec(appsRaw)).map(([k, v]) => [k, rec(v)] as [string, Loose]);
  const out: ThemeApp[] = [];
  for (const [key, r] of entries) {
    const id = str(r.id) ?? key;
    if (!id) continue;
    const vars: Record<string, string> = {};
    const put = (k: string, v: unknown) => {
      if (typeof v === "string" && v) vars[k.startsWith("--") ? k : `--${k}`] = v;
    };
    const fromMap = rec(r.varMap ?? (Array.isArray(r.vars) ? undefined : r.vars) ?? r.variables);
    for (const [k, v] of Object.entries(fromMap)) put(k, v);
    if (Array.isArray(r.vars)) {
      for (const row of r.vars) {
        const o = rec(row);
        const scope = str(o.scope);
        if (scope && /dark/i.test(scope)) continue;
        const name = str(o.name);
        if (name && !(name in vars)) put(name, o.value);
      }
    }
    const fonts: Record<string, string> = {};
    if (r.fontMap && typeof r.fontMap === "object") for (const [k, v] of Object.entries(rec(r.fontMap))) fonts[k] = String(v);
    else if (Array.isArray(r.fonts)) {
      r.fonts.forEach((f, i) => {
        const o = rec(f);
        const family = str(o.family);
        fonts[str(o.role) ?? `font ${i + 1}`] = family ?? String(f);
      });
    } else for (const [k, v] of Object.entries(rec(r.fonts))) fonts[k] = String(v);
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec(r.counts))) if (typeof v === "number") counts[k] = v;
    out.push({
      id,
      label: str(r.label) ?? id,
      source: str(r.source),
      vars,
      fonts,
      families: list(r.families).map((f) => (typeof f === "string" ? f : (str(rec(f).prefix) ?? str(rec(f).id) ?? ""))).filter(Boolean),
      counts,
      editedBy: str(r.editedBy) ?? str(r.editor),
      swatches: Object.entries(vars)
        .filter(([, v]) => isColour(v))
        .map(([name, value]) => ({ name, value })),
    });
  }
  // The neutral Test theme comes first and is the default preview theme (see theme-store.ts).
  return [testTheme(), ...out.filter((t) => t.id !== "test")];
}

export function loadDesignSystem(): DesignSystem {
  const r = rec(designJson);
  return {
    title: str(r.title) ?? str(r.name) ?? "Proposed design system",
    summary: str(r.summary) ?? "",
    principle: str(r.principle),
    layers: list(r.layers).map((v) => {
      const o = rec(v);
      return { id: str(o.id) ?? "", label: str(o.label) ?? "", summary: str(o.summary) ?? "" };
    }),
    vocabulary: list(r.vocabulary).map((v) => {
      const o = rec(v);
      return {
        token: str(o.token) ?? str(o.name) ?? "",
        meaning: str(o.meaning) ?? str(o.description) ?? "",
        kind: str(o.kind),
        layer: str(o.layer),
        light: str(o.light),
        dark: str(o.dark),
      };
    }),
    aliases: list(r.aliases).map((v) => {
      const o = rec(v);
      return { from: str(o.from) ?? "", to: str(o.to) ?? "", apps: list(o.apps).map(String) };
    }),
    notes: list(r.notes).map(String),
  };
}
