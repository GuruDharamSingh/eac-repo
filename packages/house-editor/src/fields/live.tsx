"use client";

// ============================================================================
// Live edit, the pieces drawn on the page (2026-11-23, lane LIVE): the tool strip at the pointer, the content info card,
// the pencil tags and the words for what a thing is and where its value is kept. Plain components; the lens
// (./FieldsLens.tsx) decides what they do. Nothing here saves or loads anything.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { recordLabel, type FieldRef, type FieldSpec, type FieldsRegistry } from "./registry";
import type { BlockFieldMap } from "./blockmap";

/** The sort of thing a field is, as a person would say it. */
export type LiveKind = "words" | "rich" | "picture" | "record" | "setting" | "box";

export function liveKindOf(ref: FieldRef, spec: FieldSpec): LiveKind {
  if (ref.field === "*") return "box";
  if (ref.kind === "record") return spec.input === "image" ? "picture" : spec.input === "rich" ? "rich" : "record";
  if (spec.input === "image") return "picture";
  if (spec.input === "rich") return "rich";
  if (spec.input === "text" || spec.input === "textarea" || spec.input === "url") return "words";
  return "setting";
}

export interface InfoRow { k: string; v: string }

/** What the right-click card says. Read only, in plain words. */
export function describeField(a: {
  ref: FieldRef;
  spec: FieldSpec;
  name: string;
  registry: FieldsRegistry;
  blocks?: { map: BlockFieldMap; slug?: string };
  blockType?: string;
  slug: string;
  /** The words of the record kind's own warning, if it has one. */
  kindShared?: string;
}): { title: string; rows: InfoRow[] } {
  const { ref, spec, name, registry, blockType } = a;
  const kind = liveKindOf(ref, spec);
  const what = kind === "picture" ? "A picture" : kind === "rich" || kind === "words" ? "Words" : kind === "box" ? "A block's own settings" : "A setting";
  const rows: InfoRow[] = [];
  if (ref.kind === "block") {
    const entry = blockType ? a.blocks?.map[blockType] : undefined;
    rows.push({ k: "What it is", v: what });
    if (entry) rows.push({ k: "Block", v: entry.label });
    if (kind === "box") rows.push({ k: "Part", v: "The whole block (settings no single part draws)" });
    else rows.push({ k: "Part", v: spec.label ?? name });
    rows.push({ k: "Kept", v: `In this block's settings, saved with the page${a.slug ? ` "${a.slug}"` : ""}. Changing it changes this page only.` });
  } else if (ref.kind === "record") {
    const cut = ref.id.indexOf(":");
    const rk = cut < 1 ? ref.kind : ref.id.slice(0, cut);
    const rid = cut < 1 ? ref.id : ref.id.slice(cut + 1);
    rows.push({ k: "What it is", v: `${what}, a field of a record` });
    rows.push({ k: "Part", v: spec.label ?? ref.field });
    rows.push({ k: "Record", v: recordLabel(registry, rk, rid) });
    rows.push({ k: "Kept", v: `On the record itself. ${a.kindShared || registry[rk]?.shared || "Changing it changes every place that shows this record."}` });
  } else {
    rows.push({ k: "What it is", v: what });
    rows.push({ k: "Part", v: spec.label ?? ref.field });
    rows.push({ k: "Record", v: recordLabel(registry, ref.kind, ref.id) });
    rows.push({ k: "Kept", v: `On the site, in ${registry[ref.kind]?.label ?? ref.kind}. ${registry[ref.kind]?.shared ?? "It shows wherever the site uses it."}` });
  }
  rows.push({ k: "Who can change it", v: spec.readOnly ? `Nobody here: ${spec.readOnly}` : "You can, with your role on this site. The save checks that again." });
  return { title: rows[0]!.v, rows };
}

const place = (x: number, y: number, w: number, h: number) => ({
  left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
  top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
});

/** A card that sits at the pointer and stays on screen. */
function Floating({ x, y, w, label, className, children, forwardRef }: { x: number; y: number; w: number; label: string; className: string; children: ReactNode; forwardRef?: (el: HTMLDivElement | null) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(() => place(x, y, w, 60));
  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    setPos(place(x, y, r?.width ?? w, r?.height ?? 60));
  }, [x, y, w, children]);
  return (
    <div
      ref={(el) => { box.current = el; forwardRef?.(el); }}
      className={className}
      role="dialog"
      aria-label={label}
      data-fields-ui=""
      data-de-ui=""
      style={{ left: pos.left, top: pos.top, maxWidth: Math.min(w, window.innerWidth - 16) }}
    >
      {children}
    </div>
  );
}

export function InfoCard({ x, y, title, rows, onClose }: { x: number; y: number; title: string; rows: InfoRow[]; onClose(): void }) {
  return (
    <Floating x={x} y={y} w={300} label="About this" className="fl-info">
      <div className="fl-info__head"><b>{title}</b><button type="button" className="fl-x" aria-label="Close" onClick={onClose}>×</button></div>
      <dl>
        {rows.map((r) => (<div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>))}
      </dl>
      <p className="fl-info__foot">Read only. Left-click it to change it.</p>
    </Floating>
  );
}

export type StripMode = "menu" | "rich" | "link";

export interface StripAction { id: string; label: string; hint?: string; primary?: boolean; off?: string }

/** The tool strip at the pointer. Buttons keep the page's selection (mouse down is not let through to the page). */
export function Strip(p: {
  x: number; y: number; kind: LiveKind; mode: StripMode; label: string; actions: StripAction[]; note?: string;
  onAct(id: string): void; onLink(url: string): void; onBackFromLink(): void; onClose(): void;
}) {
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const row = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (p.mode === "link") input.current?.focus(); }, [p.mode]);
  // Opened from a pencil by the keyboard: the first tool takes focus, so Tab is not needed to find the strip.
  useEffect(() => { if (document.activeElement?.classList.contains("fl-pencil")) row.current?.querySelector("button")?.focus(); }, []);
  const keep = (e: { preventDefault(): void }) => { if (p.mode !== "link") e.preventDefault(); };
  return (
    <Floating x={p.x} y={p.y + 10} w={p.mode === "link" ? 320 : 360} label={p.label} className={`fl-strip fl-strip--${p.kind}`}>
      <div ref={row} className="fl-strip__row" role="toolbar" aria-label={p.label} onMouseDown={keep}>
        <span className="fl-strip__what">{p.label}</span>
        {p.mode === "link" ? (
          <form className="fl-strip__link" onSubmit={(e) => { e.preventDefault(); p.onLink(url.trim()); }}>
            <input ref={input} className="fl-input" type="url" inputMode="url" placeholder="https://…" aria-label="Where the link goes" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="submit" className="fl-btn fl-btn--primary">Add link</button>
            <button type="button" className="fl-btn" onClick={p.onBackFromLink}>Back</button>
          </form>
        ) : (
          p.actions.map((a) => (
            <button key={a.id} type="button" className={`fl-btn${a.primary ? " fl-btn--primary" : ""}`} data-strip-act={a.id} title={a.hint} disabled={!!a.off} onClick={() => p.onAct(a.id)}>{a.label}</button>
          ))
        )}
        {p.mode === "menu" && <button type="button" className="fl-x" aria-label="Close the strip" onClick={p.onClose}>×</button>}
      </div>
      {p.actions.some((a) => a.off) && <p className="fl-strip__note">{p.actions.find((a) => a.off)!.off}</p>}
      {p.note && <p className="fl-strip__note">{p.note}</p>}
    </Floating>
  );
}

/** A small pencil tag at the corner of every editable thing that is on screen. Off by default. */
export function Pencils({ onPick }: { onPick(el: HTMLElement, x: number, y: number): void }) {
  const [tags, setTags] = useState<Array<{ el: HTMLElement; left: number; top: number; label: string }>>([]);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const out: typeof tags = [];
      document.querySelectorAll<HTMLElement>('[data-fields-ok="1"]').forEach((el) => {
        if (out.length >= 150) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") return;
        const f = el.getAttribute("data-field") ?? "";
        out.push({ el, left: Math.max(2, Math.min(r.right - 12, window.innerWidth - 28)), top: Math.max(2, Math.min(r.top - 10, window.innerHeight - 28)), label: f.endsWith(":*") ? "Change this block's settings" : "Edit this" });
      });
      setTags(out);
    };
    const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", queue, true);
    window.addEventListener("resize", queue);
    const mo = new MutationObserver(queue);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-fields-ok", "class", "style"] });
    const iv = window.setInterval(queue, 700);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", queue, true); window.removeEventListener("resize", queue); mo.disconnect(); window.clearInterval(iv); };
  }, []);
  return (
    <div data-fields-ui="" data-de-ui="" data-fields-pencils="">
      {tags.map((t, i) => (
        <button key={i} type="button" className="fl-pencil" data-for={t.el.getAttribute("data-field") ?? ""} aria-label={t.label} title={t.label} style={{ left: t.left, top: t.top }} onClick={(e) => { e.stopPropagation(); onPick(t.el, e.clientX || t.left, e.clientY || t.top); }}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2 14l1-4 8-8 3 3-8 8z" fill="currentColor" /></svg>
        </button>
      ))}
    </div>
  );
}

/** A pencil as a cursor: a hotspot at its tip. Falls back to a pointer where cursors from data are refused. */
const PENCIL = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3 25l1.5-6L19 4.5 23.5 9 9 23.5z" fill="#fff" stroke="#10201e" stroke-width="1.8" stroke-linejoin="round"/><path d="M16.5 7l4.5 4.5" stroke="#2a9d8f" stroke-width="2.2"/></svg>')}") 3 25, pointer`;

export const LIVE_STYLES = `
body[data-fields-live] [data-fields-ok="1"]{text-decoration:underline dashed #2a9d8f;text-decoration-thickness:1.5px;text-underline-offset:5px;cursor:${PENCIL}}
body[data-fields-live] [data-fields-ok="1"]:hover{background:rgba(42,157,143,.12)}
body[data-fields-live] [data-fields-box][data-fields-ok="1"]{text-decoration:none}
body[data-fields-live] [data-fields-box][data-fields-ok="1"]:hover{background:none;outline:2px dashed #2a9d8f;outline-offset:-2px}
body[data-fields-live] [data-fields-ok="1"][data-field-state="editing"]{text-decoration:none;outline:2px dotted #2a9d8f;outline-offset:3px;background:rgba(42,157,143,.1);cursor:text}
.fl-live{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;flex-wrap:nowrap;white-space:nowrap;justify-content:center;gap:6px 14px;max-width:calc(100vw - 16px);padding:6px 6px 6px 14px;background:#10201e;color:#e6f4f1;border:1px solid #2a9d8f;border-radius:22px;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.fl-live__on{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.fl-live__dot{width:8px;height:8px;border-radius:50%;background:#5ee0cd;box-shadow:0 0 0 3px rgba(94,224,205,.25)}
.fl-live__note{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);width:max-content;max-width:calc(100vw - 16px);white-space:normal;text-align:center;font-weight:600;background:#10201e;color:#e6f4f1;border:1px solid #2a9d8f;border-radius:12px;padding:6px 12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.fl-live__note--error{color:#ffd0c8;border-color:#e08a78}
.fl-live__note button{margin-left:8px;font:inherit;text-decoration:underline;background:none;border:0;color:inherit;cursor:pointer}
.fl-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;min-height:28px}
.fl-switch input{position:absolute;opacity:0;width:1px;height:1px}
.fl-switch__track{width:34px;height:20px;border-radius:999px;background:#35504c;position:relative;transition:background .15s}
.fl-switch__track::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#e6f4f1;transition:transform .15s}
.fl-switch input:checked + .fl-switch__track{background:#2a9d8f}
.fl-switch input:checked + .fl-switch__track::after{transform:translateX(14px)}
.fl-switch input:focus-visible + .fl-switch__track{outline:2px solid #fff;outline-offset:2px}
.fl-strip,.fl-info{position:fixed;z-index:2147483001;background:#fff;color:#1d2129;border:1px solid #cfd8d6;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);font:13px/1.4 system-ui,sans-serif;padding:8px}
.fl-strip__row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.fl-strip__row .fl-x{margin-left:auto}
@media (max-width:480px){.fl-live{gap:6px 10px;padding-left:12px;font-size:12.5px}.fl-switch{gap:6px}}
.fl-strip__what{font-weight:600;color:#14524a;margin-right:2px}
.fl-strip__link{display:flex;gap:6px;align-items:center;flex:1 1 auto}
.fl-strip__link .fl-input{flex:1 1 140px;min-width:0}
.fl-strip__note{margin:6px 2px 0;color:#5a6370;font-size:12px}
.fl-info{padding:10px 12px;width:300px}
.fl-info__head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.fl-info dl{margin:0;display:grid;gap:6px}
.fl-info dt{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5a6370}
.fl-info dd{margin:0}
.fl-info__foot{margin:8px 0 0;color:#5a6370;font-size:12px}
.fl-pencil{position:fixed;z-index:2147482999;width:24px;height:24px;border-radius:50%;border:1px solid #10201e;background:#e6f4f1;color:#10201e;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.fl-pencil:hover,.fl-pencil:focus-visible{background:#2a9d8f;color:#04110f;outline:none}
.fl-pickpop{position:fixed;z-index:2147483001;background:#fff;color:#1d2129;border:1px solid #cfd8d6;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:10px;width:min(360px,calc(100vw - 16px));max-height:min(520px,calc(100vh - 16px));overflow:auto;font:13px/1.4 system-ui,sans-serif}
.fl-pickpop__head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600}
@media (prefers-reduced-motion:reduce){.fl-switch__track,.fl-switch__track::after{transition:none}}
`;
