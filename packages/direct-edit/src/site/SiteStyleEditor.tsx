"use client";

// ============================================================================
// The site style editor (2026-11-06): a drawer over the live site, for owners.
//
// Theme: the site's declared variables (colours, corners, fonts), with a
// contrast warning where a colour is read against another. Header / Footer:
// click a part on the page (links do not navigate while this is open) and set
// its look. Everything previews live through the same `siteStyleCss` the
// published page uses; the server's own <style data-site-style> is switched
// off while editing, so the preview is the whole truth. Save hands the draft
// to the host, whose server action cleans it again.
//
// React, not the plain-DOM panel: this is the first piece written for the
// "Puck as the house" direction, and it can later sit in Puck's sidebar as a
// plugin panel unchanged.
// ============================================================================

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { loadFonts } from "@elkdonis/fonts";
import type { PartStyle } from "../block/style";
import { contrastRatio } from "../model/color";
import { cleanSiteStyle, hexToHsl, siteStyleCss, varHex, type SiteStyle, type SiteStyleSchema, type SiteVar } from "./style";

export interface SiteStyleEditorProps {
  schema: SiteStyleSchema;
  initial: SiteStyle | null;
  onSave(style: SiteStyle | null): Promise<{ ok: boolean; error?: string }>;
  onClose(): void;
}

type Draft = SiteStyle;
const EMPTY: Draft = { v: 1 };
const DRAWER = 360;
const UI = "data-site-style-ui";

// ── Small controls ──────────────────────────────────────────────────────────

const s = {
  drawer: { position: "fixed", top: 0, right: 0, bottom: 0, width: DRAWER, zIndex: 2147483600, background: "#fff", color: "#1d2129", borderLeft: "1px solid #d9dde3", font: "13px/1.4 system-ui, sans-serif", display: "flex", flexDirection: "column", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" } as CSSProperties,
  bar: { display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderBottom: "1px solid #e6e9ee" } as CSSProperties,
  btn: { font: "inherit", padding: "5px 10px", border: "1px solid #c9ced6", background: "#fff", borderRadius: 6, cursor: "pointer", color: "inherit" } as CSSProperties,
  primary: { font: "inherit", padding: "5px 12px", border: "1px solid #2f6fed", background: "#2f6fed", color: "#fff", borderRadius: 6, cursor: "pointer" } as CSSProperties,
  row: { display: "grid", gridTemplateColumns: "118px 1fr auto", alignItems: "center", gap: 8, padding: "5px 0" } as CSSProperties,
  group: { font: "600 11px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: "#6b7280", margin: "14px 0 4px" } as CSSProperties,
  input: { font: "inherit", padding: "4px 6px", border: "1px solid #c9ced6", borderRadius: 5, width: "100%", minWidth: 0, background: "#fff", color: "inherit" } as CSSProperties,
  note: { fontSize: 11, color: "#6b7280" } as CSSProperties,
};

function Row({ label, children, reset }: { label: string; children: ReactNode; reset?: (() => void) | null }) {
  return (
    <label style={s.row}>
      <span>{label}</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>{children}</span>
      {reset ? <button type="button" title="Back to the site's own" onClick={(e) => { e.preventDefault(); reset(); }} style={{ ...s.btn, padding: "2px 6px" }}>↺</button> : <span />}
    </label>
  );
}

/** A colour: picker plus the hex as text (typed values apply on Enter or leaving the field). */
function Colour({ value, onChange, name }: { value: string | null; onChange: (hex: string) => void; name: string }) {
  return (
    <>
      <input type="color" data-ctl={name} value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 26, padding: 0, border: "1px solid #c9ced6", borderRadius: 5 }} />
      <input key={value ?? ""} data-ctl-text={name} defaultValue={value ?? ""} placeholder="#rrggbb" style={s.input}
        onBlur={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v) && v !== value) onChange(v.toLowerCase()); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </>
  );
}

function Num({ value, onChange, name, min, max, step = 1, unit }: { value: number | undefined; onChange: (n: number | undefined) => void; name: string; min: number; max: number; step?: number; unit?: string }) {
  return (
    <>
      <input type="number" data-ctl={name} value={value ?? ""} min={min} max={max} step={step} style={s.input}
        onChange={(e) => { const n = e.target.value === "" ? undefined : Number(e.target.value); onChange(n === undefined || Number.isNaN(n) ? undefined : Math.min(max, Math.max(min, n))); }} />
      {unit ? <span style={s.note}>{unit}</span> : null}
    </>
  );
}

function Choice({ value, options, onChange, name }: { value: string | undefined; options: Array<[string, string]>; onChange: (v: string | undefined) => void; name: string }) {
  return (
    <select data-ctl={name} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} style={s.input}>
      <option value="">As designed</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// ── The editor ──────────────────────────────────────────────────────────────

export function SiteStyleEditor({ schema, initial, onSave, onClose }: SiteStyleEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => cleanSiteStyle(initial, schema) ?? EMPTY);
  const past = useRef<Draft[]>([]), future = useRef<Draft[]>([]);
  const saved = useRef<string>(JSON.stringify(cleanSiteStyle(initial, schema)));
  const [tab, setTab] = useState<string>("theme");
  const [picked, setPicked] = useState<{ region: string; part: string } | null>(null);
  const [status, setStatus] = useState("");
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const regions = Object.entries(schema.chrome);

  const change = useCallback((next: Draft) => { past.current.push(draft); future.current = []; setDraft(next); setStatus(""); }, [draft]);
  const undo = () => { const p = past.current.pop(); if (p) { future.current.push(draft); setDraft(p); } };
  const redo = () => { const f = future.current.pop(); if (f) { past.current.push(draft); setDraft(f); } };
  const dirty = JSON.stringify(cleanSiteStyle(draft, schema)) !== saved.current;

  // Live preview: the server's sheet off, the draft's on. The page makes room for the drawer.
  useEffect(() => {
    const server = Array.from(document.querySelectorAll<HTMLStyleElement>("style[data-site-style]"));
    server.forEach((el) => (el.media = "not all"));
    const sheet = document.createElement("style");
    sheet.setAttribute("data-site-style-draft", "");
    document.head.appendChild(sheet);
    const margin = document.body.style.marginRight;
    document.body.style.marginRight = `${DRAWER}px`;
    previewRef.current = sheet;
    return () => {
      sheet.remove();
      // Every site sheet, including one the first save created while the editor was open.
      document.querySelectorAll<HTMLStyleElement>("style[data-site-style]").forEach((el) => (el.media = ""));
      document.body.style.marginRight = margin;
    };
  }, []);
  const previewRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (previewRef.current) previewRef.current.textContent = siteStyleCss(draft, schema, { editor: true });
    const google = (schema.fonts ?? []).filter((f) => f.google && Object.values(draft.theme ?? {}).includes(f.stack)).map((f) => f.google!);
    if (google.length) loadFonts(google);
  }, [draft, schema]);

  // Picking parts on the page: links and buttons in the header and footer do not act while this is open.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest(`[${UI}]`)) return;
      const region = t.closest<HTMLElement>("[data-chrome]");
      if (!region) return;
      e.preventDefault(); e.stopPropagation();
      const name = region.dataset.chrome!;
      if (!schema.chrome[name]) return;
      const partEl = t.closest<HTMLElement>("[data-part]");
      const part = partEl && region.contains(partEl) && schema.chrome[name]!.parts[partEl.dataset.part!] ? partEl.dataset.part! : "root";
      setTab(name); setPicked({ region: name, part });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target as Element)?.closest?.("input,select,textarea")) setPicked(null); };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", tick, true); window.removeEventListener("resize", tick); };
  }, [schema]);

  const save = async () => {
    const clean = cleanSiteStyle(draft, schema);
    setStatus("Saving…");
    const res = await onSave(clean).catch(() => ({ ok: false, error: "Could not reach the site. Try again." }));
    if (res.ok) {
      saved.current = JSON.stringify(clean);
      // The page keeps the saved look after the editor closes, without a reload.
      let server = document.querySelector<HTMLStyleElement>("style[data-site-style]");
      if (!server) { server = document.createElement("style"); server.setAttribute("data-site-style", ""); server.media = "not all"; document.head.appendChild(server); }
      server.textContent = siteStyleCss(clean, schema);
      setStatus("Saved. Visitors see it now.");
    } else setStatus(res.error ?? "Could not save.");
  };
  const close = () => { if (dirty && !window.confirm("Close without saving? Your changes will be lost.")) return; onClose(); };

  // ── Theme ──
  const theme = draft.theme ?? {};
  const setVar = (name: string, value: string | undefined) => {
    // A value the site would not draw is refused here, so the last good one stays.
    if (value !== undefined && cleanSiteStyle({ theme: { [name]: value } }, schema)?.theme?.[name] === undefined) {
      setStatus(`Not kept: "${value.slice(0, 40)}" is not a value ${schema.vars.find((x) => x.name === name)?.label.toLowerCase() ?? "this"} can take.`);
      return;
    }
    const next = { ...theme };
    if (value === undefined) delete next[name]; else next[name] = value;
    change({ ...draft, theme: next });
  };
  const hexOf = (name: string) => { const v = schema.vars.find((x) => x.name === name); return v ? varHex(v, theme[name]) : null; };
  const groups = useMemo(() => Array.from(new Set(schema.vars.map((v) => v.group))), [schema]);

  const varRow = (v: SiteVar) => {
    const set = theme[v.name] !== undefined;
    const reset = set ? () => setVar(v.name, undefined) : null;
    let ctl: ReactNode;
    if (v.kind === "hsl" || v.kind === "color" || v.kind === "background") {
      const hex = varHex(v, theme[v.name]);
      ctl = <Colour name={v.name} value={hex} onChange={(h) => setVar(v.name, v.kind === "hsl" ? hexToHsl(h) ?? undefined : h)} />;
    } else if (v.kind === "choice") {
      ctl = (
        <select data-ctl={v.name} value={theme[v.name] ?? ""} onChange={(e) => setVar(v.name, e.target.value || undefined)} style={s.input}>
          <option value="">As designed</option>
          {(v.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (v.kind === "font") {
      ctl = (
        <select data-ctl={v.name} value={theme[v.name] ?? ""} onChange={(e) => setVar(v.name, e.target.value || undefined)} style={s.input}>
          <option value="">As designed</option>
          {(schema.fonts ?? []).map((f) => <option key={f.stack} value={f.stack}>{f.label}</option>)}
        </select>
      );
    } else {
      ctl = <input key={theme[v.name] ?? ""} data-ctl={v.name} defaultValue={theme[v.name] ?? ""} placeholder={v.default} style={s.input}
        onBlur={(e) => { const x = e.target.value.trim(); if (x !== (theme[v.name] ?? "")) setVar(v.name, x || undefined); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />;
    }
    const ratio = v.on ? contrastRatio(hexOf(v.name) ?? undefined, hexOf(v.on) ?? undefined) : null;
    return (
      <div key={v.name}>
        <Row label={v.label} reset={reset}>{ctl}</Row>
        {ratio !== null ? (
          <div data-contrast={v.name} style={{ ...s.note, margin: "-2px 0 4px 126px", color: ratio < 4.5 ? "#b42318" : "#6b7280" }}>
            {ratio.toFixed(1)}:1 on {schema.vars.find((x) => x.name === v.on)?.label.toLowerCase()}{ratio < 4.5 ? ", hard to read" : ""}
          </div>
        ) : v.hint ? <div style={{ ...s.note, margin: "-2px 0 4px 126px" }}>{v.hint}</div> : null}
      </div>
    );
  };

  // ── A chrome part ──
  const region = tab !== "theme" ? tab : null;
  const part = picked && picked.region === region ? picked.part : region ? "root" : null;
  const look: PartStyle = (region && part && draft.chrome?.[region]?.[part]) || {};
  const setLook = (key: keyof PartStyle, value: unknown) => {
    if (!region || !part) return;
    const nextLook: Record<string, unknown> = { ...look };
    if (value === undefined || value === "" || value === false) delete nextLook[key]; else nextLook[key] = value;
    const parts = { ...(draft.chrome?.[region] ?? {}) };
    if (Object.keys(nextLook).length) parts[part] = nextLook as PartStyle; else delete parts[part];
    const chrome = { ...(draft.chrome ?? {}) };
    if (Object.keys(parts).length) chrome[region] = parts; else delete chrome[region];
    change({ ...draft, chrome });
  };
  const partLabel = region && part ? (part === "root" ? `Whole ${schema.chrome[region]!.label.toLowerCase()}` : schema.chrome[region]!.parts[part]?.label ?? part) : "";
  const kept = region && part ? cleanSiteStyle({ chrome: { [region]: { [part]: look } } }, schema)?.chrome?.[region]?.[part]?.css : undefined;

  // Outline of the picked part on the page.
  const outline = (() => {
    if (!region || !part) return null;
    const root = document.querySelector<HTMLElement>(`[data-chrome="${region}"]`);
    const el = part === "root" ? root : root?.querySelector<HTMLElement>(`[data-part="${part}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return <div {...{ [UI]: "" }} data-site-style-outline={part} style={{ position: "fixed", left: r.left, top: r.top, width: r.width, height: r.height, outline: "2px solid #2f6fed", pointerEvents: "none", zIndex: 2147483599 }} />;
  })();

  return (
    <>
      {outline}
      <aside {...{ [UI]: "" }} data-de-ui="" style={s.drawer} aria-label="Site style">
        <div style={s.bar}>
          <b style={{ flex: 1 }}>Site style</b>
          <button type="button" style={s.btn} onClick={undo} disabled={!past.current.length} title="Undo">↶</button>
          <button type="button" style={s.btn} onClick={redo} disabled={!future.current.length} title="Redo">↷</button>
          <button type="button" data-site-style-save="" style={s.primary} onClick={save} disabled={!dirty}>Save</button>
          <button type="button" data-site-style-close="" style={s.btn} onClick={close}>Close</button>
        </div>
        <div style={{ ...s.bar, gap: 4 }}>
          {[["theme", "Theme"] as const, ...regions.map(([k, r]) => [k, r.label] as const)].map(([k, l]) => (
            <button key={k} type="button" data-site-style-tab={k} onClick={() => setTab(k)} style={{ ...s.btn, borderRadius: 999, ...(tab === k ? { background: "#1d2129", color: "#fff", borderColor: "#1d2129" } : {}) }}>{l}</button>
          ))}
        </div>
        <div style={{ padding: "4px 14px 16px", overflow: "auto", flex: 1 }}>
          {tab === "theme" ? (
            <>
              <p style={s.note}>Changes apply to every page of the site.</p>
              {groups.map((g) => (
                <div key={g}>
                  <div style={s.group}>{g}</div>
                  {schema.vars.filter((v) => v.group === g).map(varRow)}
                </div>
              ))}
            </>
          ) : region ? (
            <>
              <p style={s.note}>Click the {schema.chrome[region]!.label.toLowerCase()} on the page to pick a part, or choose one here.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 10px" }}>
                {[["root", `Whole ${schema.chrome[region]!.label.toLowerCase()}`] as const, ...Object.entries(schema.chrome[region]!.parts).map(([k, p]) => [k, p.label] as const)].map(([k, l]) => (
                  <button key={k} type="button" data-site-style-part={k} onClick={() => setPicked({ region, part: k })}
                    style={{ ...s.btn, padding: "3px 8px", ...(part === k ? { borderColor: "#2f6fed", color: "#2f6fed", fontWeight: 600 } : {}) }}>
                    {l}{draft.chrome?.[region]?.[k] ? " •" : ""}
                  </button>
                ))}
              </div>
              <div style={s.group}>{partLabel}</div>
              <Row label="Fill" reset={look.fill ? () => setLook("fill", undefined) : null}><Colour name="fill" value={look.fill ?? null} onChange={(h) => setLook("fill", h)} /></Row>
              <Row label="Text colour" reset={look.color ? () => setLook("color", undefined) : null}><Colour name="color" value={look.color ?? null} onChange={(h) => setLook("color", h)} /></Row>
              <Row label="Text size"><Num name="size" value={look.size} min={6} max={120} unit="px" onChange={(n) => setLook("size", n)} /></Row>
              <Row label="Weight"><Choice name="weight" value={look.weight ? String(look.weight) : undefined} options={["300", "400", "500", "600", "700"].map((w) => [w, w])} onChange={(v) => setLook("weight", v ? Number(v) : undefined)} /></Row>
              <Row label="Capitals"><Choice name="case" value={look.case} options={[["none", "As written"], ["upper", "All capitals"], ["smallcaps", "Small capitals"]]} onChange={(v) => setLook("case", v)} /></Row>
              <Row label="Letter spacing"><Num name="tracking" value={look.tracking} min={-0.1} max={0.5} step={0.01} unit="em" onChange={(n) => setLook("tracking", n)} /></Row>
              <Row label="Space inside"><Num name="padding" value={typeof look.padding === "number" ? look.padding : undefined} min={0} max={160} unit="px" onChange={(n) => setLook("padding", n)} /></Row>
              <Row label="Corners"><Num name="radius" value={typeof look.radius === "number" ? look.radius : undefined} min={0} max={60} unit="px" onChange={(n) => setLook("radius", n)} /></Row>
              <Row label="Line"><Choice name="bstyle" value={look.bstyle} options={[["none", "None"], ["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]]} onChange={(v) => setLook("bstyle", v)} /></Row>
              {look.bstyle && look.bstyle !== "none" ? (
                <>
                  <Row label="Line colour"><Colour name="bcolor" value={look.bcolor ?? null} onChange={(h) => setLook("bcolor", h)} /></Row>
                  <Row label="Line width"><Num name="bwidth" value={look.bwidth} min={0} max={12} unit="px" onChange={(n) => setLook("bwidth", n)} /></Row>
                </>
              ) : null}
              <Row label="Opacity"><Num name="opacity" value={look.opacity} min={0} max={1} step={0.05} onChange={(n) => setLook("opacity", n)} /></Row>
              <Row label="Hide"><input type="checkbox" data-ctl="hide" checked={!!look.hide} onChange={(e) => setLook("hide", e.target.checked)} /></Row>
              <div style={s.group}>CSS</div>
              <textarea key={`${region}:${part}:${look.css ?? ""}`} data-ctl="css" defaultValue={look.css ?? ""} rows={4} placeholder="letter-spacing: .2em; text-decoration: underline;"
                style={{ ...s.input, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (look.css ?? "")) setLook("css", v || undefined); }} />
              <div data-site-style-kept="" style={s.note}>{look.css ? (kept ? `Kept: ${kept}` : "Nothing kept: position, layering, transforms and links to files are not allowed here.") : "Plain CSS declarations for this part. Position, layering and transforms are refused, so the header stays where the site put it."}</div>
              <div style={{ marginTop: 12 }}><button type="button" data-site-style-reset="" style={s.btn} onClick={() => { const chrome = { ...(draft.chrome ?? {}) }; const parts = { ...(chrome[region] ?? {}) }; delete parts[part!]; if (Object.keys(parts).length) chrome[region] = parts; else delete chrome[region]; change({ ...draft, chrome }); }}>Reset this part</button></div>
            </>
          ) : null}
        </div>
        <div data-site-style-status="" style={{ ...s.bar, borderTop: "1px solid #e6e9ee", borderBottom: 0, minHeight: 38, color: /Could not|Not kept/.test(status) ? "#b42318" : "#4b5563" }}>
          {status || (dirty ? "Not saved yet." : "Everything is saved.")}
        </div>
      </aside>
    </>
  );
}
