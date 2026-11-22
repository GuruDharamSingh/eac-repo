"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Block } from "@elkdonis/blocks";
import type { Config } from "@puckeditor/core";
import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";
import type { CatalogEntry, ThemeApp } from "@/lib/types";
import type { ThemeRoleDef, ThemeSite } from "@/themes/types";
import { SCHEMAS } from "@/themes/schemas";
import { SOURCES } from "@/registry/sources";
import { renderConfigFor } from "@/components/blocks/configs";
import { ThemeEditor, type EditorApi } from "./editor";
import { SitePreview, type BlocksCtx } from "./preview";
import "./themes.css";

// ============================================================================
// /themes: pick a site, edit a sandbox draft of its theme on the left, see a
// mock of the site (its header, its blocks in page order, its footer) re-skinned
// live on the right. Nothing saves anywhere; Export copies the values out.
// ============================================================================

const WIDTHS = { desktop: 1180, phone: 390 } as const;
type Side = string; // "site" | "draft" | "theme:<id>"
const SYSTEM_FONTS = /^(Helvetica Neue|Helvetica|Arial|Segoe UI|Georgia|Trajan Pro|Times New Roman|system-ui|ui-sans-serif|serif|sans-serif|Basteleur|Venture|Brothers)$/i;

function copy(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}

export function ThemeStudio({ sites, catalog, themes, roleDefs }: { sites: ThemeSite[]; catalog: CatalogEntry[]; themes: ThemeApp[]; roleDefs: ThemeRoleDef[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  const [pageSlug, setPageSlug] = useState(site?.pages[0]?.slug ?? "");
  const page = site?.pages.find((p) => p.slug === pageSlug) ?? site?.pages[0];
  const [schema, setSchema] = useState<SiteStyleSchema | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const draft = useMemo(() => drafts[siteId] ?? {}, [drafts, siteId]);
  const [mode, setMode] = useState<"desktop" | "phone">("desktop");
  const [compare, setCompare] = useState(false);
  const [sideA, setSideA] = useState<Side>("site");
  const [sideB, setSideB] = useState<Side>("draft");
  const [exportKind, setExportKind] = useState<"changed" | "css" | "site-style">("changed");
  const [showExport, setShowExport] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = useState(900);

  // The site's real schema controls, when it has a SITE_STYLE.
  useEffect(() => {
    setSchema(null);
    const load = site && SCHEMAS[site.id];
    if (!load) return;
    let alive = true;
    load().then((s) => alive && setSchema(s), () => undefined);
    return () => {
      alive = false;
    };
  }, [site]);

  useEffect(() => {
    if (site && !site.pages.some((p) => p.slug === pageSlug)) setPageSlug(site.pages[0]?.slug ?? "");
  }, [site, pageSlug]);

  // Blocks: the same registry the canvas uses, loaded on demand.
  const [loaded, setLoaded] = useState<BlocksCtx["loaded"]>(() => new Map());
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const s of SOURCES) {
        try {
          const blocks = await s.load();
          if (!alive) return;
          setLoaded((prev) => {
            const next = new Map(prev);
            for (const b of blocks) next.set(b.def.id, { block: b as Block<never>, app: s.app });
            return next;
          });
        } catch {
          /* a source that fails to load leaves its blocks as placeholders */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const config = useMemo<Config | null>(() => (loaded.size ? renderConfigFor([...loaded.values()].map((v) => v.block)) : null), [loaded]);
  const catalogMap = useMemo(() => new Map(catalog.map((c) => [c.key, { label: c.label, app: c.app, description: c.description }])), [catalog]);
  const ctx: BlocksCtx = useMemo(() => ({ loaded, config, catalog: catalogMap }), [loaded, config, catalogMap]);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPaneW(el.clientWidth));
    ro.observe(el);
    setPaneW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // ── the draft ────────────────────────────────────────────────────────────
  const roleOf = useCallback((key: string) => site?.roles.find((r) => r.key === key), [site]);
  const roleValue = useCallback(
    (key: string): string => {
      const r = roleOf(key);
      if (!r) return "";
      if (r.vars[0] && r.vars[0] in draft) return draft[r.vars[0]];
      if (r.follows) return roleValue(r.follows);
      return r.fallback;
    },
    [roleOf, draft],
  );
  const api: EditorApi = useMemo(
    () => ({
      draft,
      set: (name, value) => setDrafts((d) => ({ ...d, [siteId]: { ...(d[siteId] ?? {}), [name]: value } })),
      reset: (name) =>
        setDrafts((d) => {
          const next = { ...(d[siteId] ?? {}) };
          if (name.startsWith("role:")) roleOf(name.slice(5))?.vars.forEach((v) => delete next[v]);
          else delete next[name];
          return { ...d, [siteId]: next };
        }),
      setRole: (key, value) =>
        setDrafts((d) => {
          const next = { ...(d[siteId] ?? {}) };
          roleOf(key)?.vars.forEach((v) => (next[v] = value));
          return { ...d, [siteId]: next };
        }),
      roleValue,
      roleChanged: (key) => {
        const r = roleOf(key);
        return Boolean(r && r.vars[0] && r.vars[0] in draft);
      },
    }),
    [draft, siteId, roleOf, roleValue],
  );

  /** What the preview applies: the draft, plus roles that follow a changed role until set themselves. */
  const effective = useMemo(() => {
    const out = { ...draft };
    if (!site) return out;
    const resolve = (key: string, depth = 0): string | undefined => {
      const r = roleOf(key);
      if (!r || depth > 6) return undefined;
      if (r.vars[0] && r.vars[0] in draft) return draft[r.vars[0]];
      return r.follows ? resolve(r.follows, depth + 1) : undefined;
    };
    for (const r of site.roles) {
      if (r.vars[0] && r.vars[0] in draft) continue;
      const v = r.follows ? resolve(r.follows) : undefined;
      if (v !== undefined) r.vars.forEach((n) => (out[n] = v));
    }
    return out;
  }, [draft, site, roleOf]);
  const changedCount = Object.keys(effective).length;

  // Fonts the draft names: load from Google when they are not system or local faces.
  useEffect(() => {
    const names = new Set<string>();
    for (const v of Object.values(effective)) {
      const m = /^"([^"]{2,40})"/.exec(v.trim());
      if (m && /^[A-Za-z0-9 ]+$/.test(m[1]) && !SYSTEM_FONTS.test(m[1])) names.add(m[1]);
    }
    if (!names.size) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${[...names].map((n) => `family=${n.replace(/ /g, "+")}`).join("&")}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [effective]);

  const styleFor = useCallback(
    (side: Side): Record<string, string> => {
      if (side === "site") return {};
      if (side === "draft") return effective;
      const t = themes.find((x) => `theme:${x.id}` === side);
      return t ? t.vars : {};
    },
    [effective, themes],
  );
  const labelFor = (side: Side) => (side === "site" ? "The site as it is" : side === "draft" ? "My draft" : (themes.find((x) => `theme:${x.id}` === side)?.label ?? side));
  const otherThemes = useMemo(() => themes.filter((t) => t.id !== siteId).sort((a, b) => (a.id === "test" ? -1 : b.id === "test" ? 1 : a.label.localeCompare(b.label))), [themes, siteId]);

  // ── export ───────────────────────────────────────────────────────────────
  const exportText = useMemo(() => {
    const keys = Object.keys(effective).sort();
    if (exportKind === "css") return keys.length ? `:root {\n${keys.map((k) => `  ${k}: ${effective[k]};`).join("\n")}\n}\n` : "/* no changes */\n";
    if (exportKind === "site-style") {
      const names = new Set((schema?.vars ?? []).map((v) => v.name));
      const theme: Record<string, string> = {};
      for (const k of keys) if (names.has(k)) theme[k] = effective[k];
      return JSON.stringify({ v: 1, theme }, null, 2);
    }
    return JSON.stringify({ site: siteId, changed: Object.fromEntries(keys.map((k) => [k, effective[k]])) }, null, 2);
  }, [effective, exportKind, schema, siteId]);

  if (!site || !page) return <div className="dev-loading">No sites are set up for the theme editor yet (src/data/site-pages.json).</div>;

  const widthPx = WIDTHS[mode];
  const cols = compare ? 2 : 1;
  const zoom = Math.min(1, Math.max(0.2, (paneW - 32 - (cols - 1) * 16) / cols / widthPx));
  const sides: Side[] = compare ? [sideA, sideB] : ["draft"];

  const sideSelect = (value: Side, set: (v: Side) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)}>
      <option value="site">The site as it is</option>
      <option value="draft">My draft</option>
      {otherThemes.map((t) => (
        <option key={t.id} value={`theme:${t.id}`}>
          {t.id === "test" ? "Test theme" : t.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="tp-studio">
      <aside className="tp-left">
        <div className="tp-left-head">
          <label className="tp-pick">
            <span>Site</span>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p className="tp-sandbox">
            Sandbox draft: nothing here is saved to {site.label}. Today it is changed with: {site.editor}. {site.vars.length} variables
            {schema ? `, ${schema.vars.length} of them in its Site style` : ""}.
          </p>
        </div>
        <div className="tp-left-scroll">
          <ThemeEditor key={siteId} site={site} schema={schema} api={api} roleDefs={roleDefs} />
        </div>
        <div className="tp-left-foot">
          <span>{changedCount ? `${changedCount} changed` : "No changes yet"}</span>
          <button type="button" onClick={() => setShowExport((v) => !v)} disabled={!changedCount && !showExport}>
            Export
          </button>
          <button type="button" onClick={() => setDrafts((d) => ({ ...d, [siteId]: {} }))} disabled={!changedCount}>
            Reset
          </button>
          {showExport ? (
            <div className="tp-export">
              <div className="tp-export-tabs">
                {(["changed", "css", ...(schema ? (["site-style"] as const) : [])] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={exportKind === k} onClick={() => setExportKind(k)}>
                    {k === "changed" ? "Changed values (JSON)" : k === "css" ? "CSS" : "Site style (JSON)"}
                  </button>
                ))}
                <button type="button" onClick={() => copy(exportText)}>
                  Copy
                </button>
              </div>
              <textarea readOnly value={exportText} rows={8} />
            </div>
          ) : null}
        </div>
      </aside>

      <section className="tp-right">
        <div className="tp-bar">
          <div className="tp-seg" role="group" aria-label="Page">
            {site.pages.map((p) => (
              <button key={p.slug} type="button" aria-pressed={p.slug === page.slug} onClick={() => setPageSlug(p.slug)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="tp-seg" role="group" aria-label="Width">
            <button type="button" aria-pressed={mode === "desktop"} onClick={() => setMode("desktop")}>
              Desktop
            </button>
            <button type="button" aria-pressed={mode === "phone"} onClick={() => setMode("phone")}>
              Phone
            </button>
          </div>
          <label className="tp-check">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare
          </label>
          {compare ? (
            <>
              {sideSelect(sideA, setSideA)}
              <span className="tp-vs">against</span>
              {sideSelect(sideB, setSideB)}
            </>
          ) : null}
          <span className="tp-order" title={page.source}>
            {page.blocks.length} blocks, in page order: {page.blocks.map((b) => b.label ?? b.id).join(" / ")}
          </span>
        </div>
        <div className="tp-pane" ref={paneRef}>
          <div className="tp-devices">
            {sides.map((s, i) => (
              <SitePreview key={`${siteId}-${page.slug}-${i}`} site={site} page={page} overrides={styleFor(s)} width={widthPx} zoom={zoom} ctx={ctx} caption={compare ? labelFor(s) : undefined} />
            ))}
          </div>
          <p className="tp-foot">
            Header and footer: a static copy of {site.label}&apos;s own markup. Blocks: shared ones are the live block with sample rows; the site&apos;s own are mock tiles; code-drawn sections are markup copies. Page order: {page.source ?? "recorded"}.
          </p>
        </div>
      </section>
    </div>
  );
}
