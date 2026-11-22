"use client";

import { useMemo, useState } from "react";
import type { SiteStyleSchema, SiteVar } from "@elkdonis/direct-edit/site";
import type { ThemeRoleDef, ThemeSite } from "@/themes/types";
import { VarControl, inferKind, swatchOf, type FontOption, type VarKind } from "./controls";

// ============================================================================
// The left side of /themes: a sandbox draft of one site's theme. Nothing here
// saves to the site; "Export" copies the changed values out.
//
// Grouping, best source first:
//   1. the site's SITE_STYLE schema (its real labels, groups, defaults, fonts);
//   2. the site's own palette roles (danamccool: a role sets several variables);
//   3. otherwise the colours, fonts and corners found in its stylesheet.
// Under all of those, "All variables" lists every site-wide variable by family.
// ============================================================================

const FAMILY_LABELS: Record<string, string> = {
  shadcn: "Core colours (shadcn names)",
  eac: "Network roles (--eac-*)",
  "eac-surface": "Surfaces (cms-ui)",
  "eac-block": "Block colours (--eac-block-*)",
  "tw-color": "Tailwind colour scale",
  color: "Tailwind colour names",
  "tw-font": "Font stacks",
  "tw-radius": "Corner radii",
  font: "Font variables",
  site: "Site style variables",
};

export interface EditorApi {
  draft: Record<string, string>;
  set(name: string, value: string): void;
  reset(name: string): void;
  setRole(key: string, value: string): void;
  roleValue(key: string): string;
  roleChanged(key: string): boolean;
}

function Row({ label, hint, swatch, changed, onReset, children }: { label: string; hint?: string; swatch?: string | null; changed: boolean; onReset(): void; children: React.ReactNode }) {
  return (
    <div className={`tp-row${changed ? " is-changed" : ""}`} title={hint}>
      <span className="tp-row-label">
        {swatch ? <i className="tp-chip" style={{ background: swatch }} /> : null}
        {label}
      </span>
      <span className="tp-row-ctl">{children}</span>
      <button type="button" className="tp-reset" title="Back to the site's own" disabled={!changed} onClick={onReset}>
        &#8634;
      </button>
    </div>
  );
}

function Group({ title, count, open, children, lazy }: { title: string; count?: number; open?: boolean; children: React.ReactNode; lazy?: boolean }) {
  const [shown, setShown] = useState(Boolean(open));
  return (
    <details className="tp-group" open={open} onToggle={(e) => setShown((e.target as HTMLDetailsElement).open)}>
      <summary>
        {title}
        {count !== undefined ? <span className="tp-count">{count}</span> : null}
      </summary>
      {lazy && !shown ? null : children}
    </details>
  );
}

function SchemaVars({ schema, site, api }: { schema: SiteStyleSchema; site: ThemeSite; api: EditorApi }) {
  const fonts: FontOption[] = useMemo(() => (schema.fonts ?? []).map((f) => ({ label: f.label, stack: f.stack })), [schema]);
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; fold: boolean; vars: SiteVar[] }>();
    for (const v of schema.vars) {
      const key = v.fold ?? v.group;
      if (!m.has(key)) m.set(key, { title: key, fold: Boolean(v.fold), vars: [] });
      m.get(key)!.vars.push(v);
    }
    return [...m.values()];
  }, [schema]);
  return (
    <>
      {groups.map((g) => (
        <Group key={g.title} title={g.title} count={g.vars.length} open={!g.fold}>
          {g.vars.map((v) => {
            const value = api.draft[v.name] ?? v.default;
            const kind = inferKind(value, v.kind);
            return (
              <Row key={v.name} label={v.label} hint={v.hint ?? v.name} swatch={swatchOf(value, kind)} changed={v.name in api.draft} onReset={() => api.reset(v.name)}>
                <VarControl kind={kind} value={value} onChange={(x) => api.set(v.name, x)} fonts={fonts} options={v.options} />
              </Row>
            );
          })}
        </Group>
      ))}
      <p className="tp-note">These are the controls {site.label}&apos;s owner has in Site style. Changing one here only changes this preview.</p>
    </>
  );
}

function RoleVars({ site, api }: { site: ThemeSite; api: EditorApi }) {
  const groups = useMemo(() => {
    const m = new Map<string, typeof site.roles>();
    for (const r of site.roles) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
  }, [site]);
  const GROUP_LABEL: Record<string, string> = { site: "The site", menu: "The menu", captions: "Captions" };
  return (
    <>
      {groups.map(([g, roles]) => (
        <Group key={g} title={GROUP_LABEL[g] ?? g} count={roles.length} open>
          {roles.map((r) => {
            const value = api.roleValue(r.key);
            const kind = inferKind(value);
            return (
              <Row key={r.key} label={r.label} hint={`${r.vars.join(", ")}${r.follows ? ` (follows ${r.follows} until set)` : ""}`} swatch={swatchOf(value, kind)} changed={api.roleChanged(r.key)} onReset={() => api.reset(`role:${r.key}`)}>
                <VarControl kind={kind} value={value} onChange={(x) => api.setRole(r.key, x)} />
              </Row>
            );
          })}
        </Group>
      ))}
      <p className="tp-note">These are the palette roles in {site.label}&apos;s Theme tab: one role sets every variable listed in its tooltip.</p>
    </>
  );
}

function GenericVars({ site, api, fonts, onlyTypeAndShape }: { site: ThemeSite; api: EditorApi; fonts: FontOption[]; onlyTypeAndShape?: boolean }) {
  const pick = (f: (v: ThemeSite["vars"][number]) => boolean, n: number) => site.vars.filter(f).slice(0, n);
  const colours = onlyTypeAndShape ? [] : pick((v) => (v.kind === "color" || v.kind === "hsl-triplet") && /^(shadcn|eac|site|color)$/.test(v.family), 16);
  const type = pick((v) => v.kind === "font" && /(body|heading|title|text|display)/.test(v.name), 6);
  const shape = pick((v) => /radius/.test(v.name) && v.kind === "length", 5);
  const block = (title: string, rows: typeof colours) =>
    rows.length ? (
      <Group title={title} count={rows.length} open>
        {rows.map((v) => <VarRow key={v.name} name={v.name} base={v.value} themeKind={v.kind} api={api} fonts={fonts} />)}
      </Group>
    ) : null;
  return (
    <>
      {block("Colours", colours)}
      {block("Fonts", type)}
      {block("Corners", shape)}
    </>
  );
}

function VarRow({ name, base, themeKind, api, fonts }: { name: string; base: string; themeKind?: string; api: EditorApi; fonts?: FontOption[] }) {
  const value = api.draft[name] ?? base;
  const kind: VarKind = inferKind(value, undefined, themeKind);
  return (
    <Row label={name} swatch={swatchOf(value, kind)} changed={name in api.draft} onReset={() => api.reset(name)}>
      <VarControl kind={kind} value={value} onChange={(x) => api.set(name, x)} fonts={fonts} />
    </Row>
  );
}

function AllVars({ site, api, fonts }: { site: ThemeSite; api: EditorApi; fonts: FontOption[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const byFamily = useMemo(() => {
    const m = new Map<string, ThemeSite["vars"]>();
    for (const v of site.vars) {
      if (needle && !v.name.toLowerCase().includes(needle) && !v.value.toLowerCase().includes(needle)) continue;
      const k = v.family || "other";
      m.set(k, [...(m.get(k) ?? []), v]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [site, needle]);
  const desc = (id: string) => FAMILY_LABELS[id] ?? (site.families.find((f) => f.id === id)?.description || `--${id}-*`);
  return (
    <Group title="All variables" count={site.vars.length} lazy>
      <input className="tp-search" placeholder="Find a variable or value" value={q} onChange={(e) => setQ(e.target.value)} />
      {byFamily.map(([id, rows]) => (
        <Group key={id} title={desc(id)} count={rows.length} open={Boolean(needle)} lazy>
          {rows.map((v) => <VarRow key={v.name} name={v.name} base={v.value} themeKind={v.kind} api={api} fonts={fonts} />)}
        </Group>
      ))}
    </Group>
  );
}

const ROLE_GROUPS: Record<string, string> = { colour: "Colours", type: "Type", shape: "Corners and shadows", space: "Spacing", motion: "Motion" };

/** The shared theme language (theme-roles.json): the same plain names for every site, each bound to that site's own variable. */
function SharedRoles({ site, defs, api, fonts }: { site: ThemeSite; defs: ThemeRoleDef[]; api: EditorApi; fonts: FontOption[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, ThemeRoleDef[]>();
    for (const d of defs) if (site.roleMap[d.id]) m.set(d.group, [...(m.get(d.group) ?? []), d]);
    return [...m.entries()];
  }, [defs, site]);
  if (!groups.length) return null;
  const row = (d: ThemeRoleDef) => {
    const b = site.roleMap[d.id];
    const plain = inferKind(b.value, undefined, d.group === "type" ? "font" : undefined);
    const base = plain === "text" && b.hex ? b.hex : b.value;
    const value = api.draft[b.var] ?? base;
    const kind: VarKind = inferKind(value, undefined, d.group === "type" ? "font" : undefined);
    return (
      <Row key={d.id} label={d.label} hint={`${d.description} (${b.var})`} swatch={swatchOf(value, kind)} changed={b.var in api.draft} onReset={() => api.reset(b.var)}>
        <VarControl kind={kind} value={value} onChange={(x) => api.set(b.var, x)} fonts={fonts} />
      </Row>
    );
  };
  return (
    <>
      {groups.map(([g, list]) => {
        const core = list.filter((d) => d.core);
        const more = list.filter((d) => !d.core);
        return (
          <Group key={g} title={ROLE_GROUPS[g] ?? g} count={list.length} open={core.length > 0}>
            {core.map(row)}
            {more.length ? (
              <Group title={`More ${(ROLE_GROUPS[g] ?? g).toLowerCase()}`} count={more.length}>
                {more.map(row)}
              </Group>
            ) : null}
          </Group>
        );
      })}
      <p className="tp-note">Plain names shared by every site. Each one changes the variable {site.label} uses for it (hover a row to see which).</p>
    </>
  );
}

export function ThemeEditor({ site, schema, api, roleDefs }: { site: ThemeSite; schema: SiteStyleSchema | null; api: EditorApi; roleDefs: ThemeRoleDef[] }) {
  const fonts: FontOption[] = useMemo(() => (schema?.fonts ? schema.fonts.map((f) => ({ label: f.label, stack: f.stack })) : site.fontChoices), [schema, site]);
  const hasRoles = Object.keys(site.roleMap).length > 0;
  const own = schema ? <SchemaVars schema={schema} site={site} api={api} /> : site.roles.length ? <><RoleVars site={site} api={api} /><GenericVars site={site} api={api} fonts={fonts} onlyTypeAndShape /></> : <GenericVars site={site} api={api} fonts={fonts} />;
  const ownFirst = !schema && site.roles.length > 0;
  return (
    <div className="tp-editor">
      {hasRoles ? (
        <>
          <p className="tp-section">{ownFirst ? "The site's own palette" : "By role"}</p>
          {ownFirst ? own : <SharedRoles site={site} defs={roleDefs} api={api} fonts={fonts} />}
          <p className="tp-section">{ownFirst ? "By role" : schema ? "Site style controls (as its owner sees them)" : "The site's own controls"}</p>
          {ownFirst ? <SharedRoles site={site} defs={roleDefs} api={api} fonts={fonts} /> : own}
        </>
      ) : (
        own
      )}
      <AllVars site={site} api={api} fonts={fonts} />
    </div>
  );
}
