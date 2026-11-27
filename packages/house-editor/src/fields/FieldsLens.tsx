"use client";

// ============================================================================
// The Fields lens (client). Justin's choice, 2026-11-20: "B and C together".
//
//   B  type in place   a declared short text field (inline: true) is edited right on the page, plain text only.
//                      Enter or blur saves, Esc cancels.
//   C  side panel      any other field, or "More..." on an inline one, opens a right-hand panel with ALL the
//                      declared fields of that record, focused on the one clicked: Save, Cancel, Clear.
//
// An "Edit page / Done" bar switches the lens on and off. Off, the page is exactly the visitor's page.
// Fields are found by  [data-field="kind:id:field"]  and checked against the registry. The cue (a dashed teal
// underline, a "field" tag on hover) is deliberately not the canvas's selection box.
//
// Saves go through the host's two server actions (see ./save.ts createFieldsActions): the lens never knows
// which store or capability is behind a field. Words that live inside a Puck document are not marked with
// data-field by the page; anything inside `declineSelector` is declined here as well.
// ============================================================================

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  checkValue, isInline, linkOk, parseFieldRef, recordLabel, resolveFields,
  type FieldRef, type FieldSpec, type FieldsRegistry,
} from "./registry";
import type { FieldsLoadResult, FieldsSaveInput, FieldsSaveResult, PreviousVersion } from "./save";
import { blockSpecs, type BlockFieldMap } from "./blockmap";
import { pageSlugOf, scanBlocks } from "./scan";
import { Pencils, InfoCard, Strip, LIVE_STYLES, describeField, liveKindOf, type StripAction, type StripMode } from "./live";

// cms-ui's rich editor is heavy: it loads only when a rich field is opened.
const RichTextEditor = lazy(() => import("@elkdonis/cms-ui/editor").then((m) => ({ default: m.RichTextEditor })));

/** Structurally direct-edit's PictureChooser and cms-ui makeChoosePicture's result. */
export type FieldsPictureChooser = (host: HTMLElement, o: { value?: string; onPick(url: string): void }) => () => void;

/** Structurally direct-edit's RecordSources (canvas/records.ts) and page-builder's recordSourcesFrom: where a record is chosen from. */
export interface FieldsRecordSources {
  handles(binds: string): boolean;
  sources(binds: string): Promise<{ ref: string; label: string; hint?: string }[]>;
  choices(binds: string, source: string): Promise<{ value: string; label: string; hint?: string; disabled?: boolean }[]>;
  resolve(binds: string, value: string): Promise<Record<string, unknown> | null>;
  describe(binds: string, value: string, drawn: Record<string, unknown> | null | undefined): string;
  title?(binds: string): string;
  clearLabel?(binds: string): string;
}

export interface FieldsLensProps {
  registry: FieldsRegistry;
  load(args: { kind: string; id: string }): Promise<FieldsLoadResult>;
  save(input: FieldsSaveInput): Promise<FieldsSaveResult>;
  /** Put one field back to the earlier version its record kept ("Put back the previous version"). Omit: the button never shows. */
  restore?(input: { kind: string; id: string; field: string }): Promise<FieldsSaveResult>;
  choosePicture?: FieldsPictureChooser;
  /**
   * Where a record is chosen from, for a block setting that is filled from one (declared `binds`). Absent, or it does not
   * handle that kind: the setting is shown read only with the reason, and the stored reference is left as it is.
   */
  records?: FieldsRecordSources;
  /** Where "Edit the look..." goes: a path/url, or a function of the current pathname. Omit to hide it. */
  lookHref?: string | ((pathname: string) => string | null);
  /** Hand-off that is an action, not an address (e.g. open the on-page canvas). Used instead of lookHref when given. */
  onLook?(): void;
  /** Bar wording. Defaults "Edit page" / "Done". */
  labels?: { edit?: string; done?: string };
  /** After a save: refresh the page's server data (the host passes router.refresh). */
  onSaved?(info: { kind: string; id: string; values: Record<string, string> }): void;
  /** Elements inside these are declined (the canvas / Puck owns them). */
  declineSelector?: string;
  /**
   * Block content (contract C4). `map` is fieldMapOf(contracts), built on the server. The lens finds each marked block
   * on the page (buildPuckConfig `marks`), marks the elements that draw a typed setting with `block:<page>:<id>:<prop>`
   * (or `record:<kind>:<id>:<field>` where a record fills the value), and loads and saves them through `load` and `save`
   * as kind "block" / the record's own kind. `slug`: the page's name; absent, the page's `<template data-blk-page>`.
   */
  blocks?: { map: BlockFieldMap; slug?: string };
  /**
   * Live edit (the Edit button's child, 2026-11-23). Given, the lens has no bar button of its own: the host's Edit button
   * turns it on and off. On, a click on anything editable opens a tool strip at the pointer for that kind of thing, a right
   * click gives its content info, and a slim bar says Live edit is on (Show pencils, Done). Esc or Done calls `onExit`.
   * Absent: the lens is as it was (the "Edit wording" bar).
   */
  live?: { on: boolean; onExit(): void };
}

/** "record:thread:abc:title" is the field "title" of the record "abc" of kind "thread"; every other ref is its own kind and id. */
function targetOf(ref: FieldRef): { kind: string; id: string } {
  if (ref.kind !== "record") return { kind: ref.kind, id: ref.id };
  const cut = ref.id.indexOf(":");
  return cut < 1 ? { kind: ref.kind, id: ref.id } : { kind: ref.id.slice(0, cut), id: ref.id.slice(cut + 1) };
}

const DEFAULT_DECLINE = "[data-field-off],[data-puck-component],[data-fields-ui]";
const STALE = "This was changed elsewhere. Reload to see the newest version.";

interface Notice { text: string; tone: "ok" | "error"; reload?: boolean }

export function FieldsLens(p: FieldsLensProps) {
  const decline = p.declineSelector ?? DEFAULT_DECLINE;
  const live = p.live;
  const isLive = !!live;
  const [onOwn, setOn] = useState(false);
  const on = live ? live.on : onOwn;
  const [found, setFound] = useState(0);
  const [pencils, setPencils] = useState(false);
  type Target = { x: number; y: number; el: HTMLElement; ref: FieldRef; name: string; spec: FieldSpec };
  const [strip, setStrip] = useState<(Target & { mode: StripMode }) | null>(null);
  const [info, setInfo] = useState<Target | null>(null);
  const [pick, setPick] = useState<(Target & { tab: "upload" | "library" }) | null>(null);
  const richRef = useRef<{ el: HTMLElement; original: string; ref: FieldRef; spec: FieldSpec; loadP: Promise<FieldsLoadResult>; key(e: KeyboardEvent): void; range: Range | null } | null>(null);
  const [panel, setPanel] = useState<{ ref: FieldRef; focus: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const propsRef = useRef(p);
  propsRef.current = p;

  const say = useCallback((n: Notice | null) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(n);
    if (n && n.tone === "ok") noticeTimer.current = window.setTimeout(() => setNotice(null), 3000);
  }, []);

  // Block content found by the last scan: the block's id ("<page>:<block id>") -> its type.
  const blockTypes = useRef(new Map<string, string>());
  const autoMarked = useRef(new Set<Element>());

  /** The declared fields of a record, or of a block on the page (from its own declaration). */
  const fieldsFor = useCallback((kind: string, id: string): Record<string, FieldSpec> | null => {
    if (kind === "block") {
      const type = blockTypes.current.get(id);
      const entry = type ? propsRef.current.blocks?.map[type] : undefined;
      if (!entry) return null;
      const out: Record<string, FieldSpec> = {};
      for (const [name, spec] of Object.entries(blockSpecs(entry))) {
        // A picture needs the host's picture chooser: without one it is not offered at all.
        if (spec.input === "image" && !propsRef.current.choosePicture) continue;
        // A record needs the host's record sources: without them it is shown, read only, with the reason.
        if (spec.input === "record" && !(spec.binds && propsRef.current.records?.handles(spec.binds))) {
          out[name] = { ...spec, readOnly: "This site has not connected a way to choose this record here. Change it in the page editor." };
          continue;
        }
        out[name] = spec;
      }
      return out;
    }
    return resolveFields(propsRef.current.registry, kind, id);
  }, []);

  const editable = useCallback((el: Element): { ref: FieldRef; spec: FieldSpec; name: string } | null => {
    if (el.closest(decline)) return null;
    const ref = parseFieldRef(el.getAttribute("data-field"));
    if (!ref) return null;
    const t = targetOf(ref);
    const all = fieldsFor(t.kind, t.id);
    // "*" is the block's own box: it opens the first setting no element of the block draws.
    let name = ref.field;
    if (ref.kind === "block" && ref.field === "*") {
      const entry = propsRef.current.blocks?.map[blockTypes.current.get(ref.id) ?? ""];
      name = Object.keys(entry?.others ?? {}).find((n) => all && all[n]) ?? "";
    }
    const spec = all?.[name];
    if (!spec) return null;
    // A value with markup inside it (a title with a link in it) is typed in the panel, never in place.
    return { ref, name, spec: ref.kind === "block" && spec.inline && el.childElementCount > 0 ? { ...spec, inline: false } : spec };
  }, [decline, fieldsFor]);

  // Find the declared fields on the page (the bar only appears where there are some).
  useEffect(() => {
    let raf = 0;
    const scan = () => {
      // Block content: mark the elements the blocks' own parts name, before the fields are counted.
      const cfg = propsRef.current.blocks;
      if (cfg) {
        const slug = cfg.slug ?? pageSlugOf(document) ?? "";
        const found = scanBlocks(document.body, cfg.map, slug).filter((f) => f.fromRecord || slug);
        const keep = new Set<Element>();
        blockTypes.current.clear();
        for (const f of found) {
          blockTypes.current.set(f.block, f.type);
          keep.add(f.el);
          if (f.el.getAttribute("data-field") !== f.ref) f.el.setAttribute("data-field", f.ref);
          autoMarked.current.add(f.el);
        }
        for (const el of Array.from(autoMarked.current)) {
          if (keep.has(el)) continue;
          el.removeAttribute("data-field");
          autoMarked.current.delete(el);
        }
      }
      let n = 0;
      document.querySelectorAll("[data-field]").forEach((el) => {
        if (editable(el)) { n++; if (el.getAttribute("data-fields-ok") !== "1") el.setAttribute("data-fields-ok", "1"); if (el.getAttribute("data-field")?.endsWith(":*")) el.setAttribute("data-fields-box", ""); }
        else if (el.hasAttribute("data-fields-ok")) { el.removeAttribute("data-fields-ok"); el.removeAttribute("data-fields-box"); }
      });
      setFound(n);
    };
    const queue = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(scan); };
    scan();
    const mo = new MutationObserver(queue);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
      document.querySelectorAll("[data-fields-ok]").forEach((el) => { el.removeAttribute("data-fields-ok"); el.removeAttribute("data-fields-box"); });
      autoMarked.current.forEach((el) => el.removeAttribute("data-field"));
      autoMarked.current.clear();
    };
  }, [editable]);

  // The tag that follows the pointer onto a field.
  const tagRef = useRef<HTMLDivElement | null>(null);

  // Inline editing state (one element at a time).
  const inline = useRef<{ el: HTMLElement; cancel(): void } | null>(null);

  const startInline = useCallback((el: HTMLElement, ref: FieldRef, spec: FieldSpec) => {
    const original = el.textContent ?? "";
    const origNode = el.childNodes.length === 1 && el.firstChild?.nodeType === 3 ? el.firstChild : null;
    const put = (value: string) => {
      if (origNode) { origNode.nodeValue = value; el.replaceChildren(origNode); } else el.textContent = value;
    };
    const t = targetOf(ref);
    const loadP = propsRef.current.load(t);
    let done = false;

    const stop = () => {
      el.removeEventListener("keydown", onKey, true);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("paste", onPaste);
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-field-state");
      el.removeAttribute("spellcheck");
      if (inline.current?.el === el) inline.current = null;
    };
    const cancel = () => { if (done) return; done = true; put(original); stop(); };
    const commit = async () => {
      if (done) return;
      const typed = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (typed === original.trim()) { cancel(); return; }
      const c = checkValue(spec, typed);
      if (!c.ok) { say({ text: c.error, tone: "error" }); window.setTimeout(() => el.focus(), 0); return; }
      done = true;
      stop();
      el.setAttribute("data-field-state", "saving");
      put(typed);
      const fail = (n: Notice) => { put(original); el.removeAttribute("data-field-state"); say(n); };
      const loaded = await loadP.catch(() => null);
      if (!loaded?.ok) return fail({ text: loaded?.error || "Could not save. Try again.", tone: "error" });
      const res = await propsRef.current.save({ ...t, values: { [ref.field]: c.value }, version: loaded.version }).catch(() => null);
      if (!res?.ok) return fail(res?.stale ? { text: STALE, tone: "error", reload: true } : { text: res?.error || "Could not save. Try again.", tone: "error" });
      el.removeAttribute("data-field-state");
      if (c.value === "") { put(original); say({ text: "Cleared. The page's own wording shows after a reload.", tone: "ok" }); }
      else say({ text: "Saved", tone: "ok" });
      propsRef.current.onSaved?.({ ...t, values: { [ref.field]: c.value } });
    };
    function onKey(e: KeyboardEvent) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); void commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    }
    function onBlur() { void commit(); }
    function onPaste(e: ClipboardEvent) {
      // Plain text only, on browsers without contenteditable="plaintext-only".
      e.preventDefault();
      const t = (e.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " ");
      document.execCommand("insertText", false, t);
    }

    // A value that is a record's, not this block's: say so before the first key is typed.
    const shared = ref.kind === "record" ? propsRef.current.registry[t.kind]?.shared : undefined;
    if (shared) say({ text: shared, tone: "ok" });
    el.setAttribute("contenteditable", "plaintext-only");
    if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    el.setAttribute("data-field-state", "editing");
    el.addEventListener("keydown", onKey, true);
    el.addEventListener("blur", onBlur);
    el.addEventListener("paste", onPaste);
    el.focus();
    const sel = window.getSelection();
    if (sel) { const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
    inline.current = { el, cancel };
  }, [say]);

  /** One field saved straight away (a picture chosen on the page, rich words typed in place). True when it was saved. */
  const saveOne = useCallback(async (ref: FieldRef, spec: FieldSpec, value: string, loaded?: Promise<FieldsLoadResult>): Promise<boolean> => {
    const t = targetOf(ref);
    const c = checkValue(spec, value);
    if (!c.ok) { say({ text: c.error, tone: "error" }); return false; }
    const l = await (loaded ?? propsRef.current.load(t)).catch(() => null);
    if (!l?.ok) { say({ text: l?.error || "Could not save. Try again.", tone: "error" }); return false; }
    const res = await propsRef.current.save({ ...t, values: { [ref.field]: c.value }, version: l.version }).catch(() => null);
    if (!res?.ok) { say(res?.stale ? { text: STALE, tone: "error", reload: true } : { text: res?.error || "Could not save. Try again.", tone: "error" }); return false; }
    say({ text: "Saved", tone: "ok" });
    propsRef.current.onSaved?.({ ...t, values: { [ref.field]: c.value } });
    return true;
  }, [say]);

  /** Formatted words typed on the page itself (Live edit only). Saved by the strip's Save, never by leaving the text. */
  const stopRich = useCallback(() => {
    const r = richRef.current;
    if (!r) return;
    r.el.removeEventListener("keydown", r.key, true);
    r.el.removeAttribute("contenteditable");
    r.el.removeAttribute("data-field-state");
    r.el.removeAttribute("spellcheck");
    richRef.current = null;
  }, []);
  const cancelRich = useCallback(() => {
    const r = richRef.current;
    if (!r) return;
    r.el.innerHTML = r.original;
    stopRich();
    setStrip(null);
  }, [stopRich]);
  const startRich = useCallback((el: HTMLElement, ref: FieldRef, spec: FieldSpec) => {
    const loadP = propsRef.current.load(targetOf(ref));
    const key = (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); cancelRich(); } };
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    el.setAttribute("data-field-state", "editing");
    el.addEventListener("keydown", key, true);
    richRef.current = { el, original: el.innerHTML, ref, spec, loadP, key, range: null };
    el.focus();
  }, [cancelRich]);
  const saveRich = useCallback(async () => {
    const r = richRef.current;
    if (!r) return;
    const html = r.el.innerHTML;
    stopRich();
    setStrip(null);
    r.el.setAttribute("data-field-state", "saving");
    const ok = await saveOne(r.ref, r.spec, html, r.loadP);
    r.el.removeAttribute("data-field-state");
    if (!ok) r.el.innerHTML = r.original;
  }, [saveOne, stopRich]);

  const openStrip = useCallback((el: HTMLElement, f: { ref: FieldRef; spec: FieldSpec; name: string }, x: number, y: number) => {
    setInfo(null);
    setPick(null);
    setStrip({ x, y, el, ref: f.ref, name: f.name, spec: f.spec, mode: "menu" });
  }, []);

  // What is open, for the keys below (read there without re-binding them).
  const ui = useRef<{ strip: unknown; info: unknown; pick: unknown; panel: unknown }>({ strip, info, pick, panel });
  ui.current = { strip, info, pick, panel };

  // The lens itself: while on, clicks on declared fields are ours.
  useEffect(() => {
    if (!on) return;
    document.body.setAttribute(isLive ? "data-fields-live" : "data-fields-lens", "on");
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-fields-ui]")) return;
      const el = t.closest("[data-field]");
      if (!(el instanceof HTMLElement)) return;
      if (inline.current && (inline.current.el === el || inline.current.el.contains(el))) return; // moving the caret
      if (richRef.current && richRef.current.el.contains(el)) return;
      const f = editable(el);
      if (isLive) {
        // Never a silent click: a thing that looks like a field but is not one says why.
        if (!f) { say({ text: "This is kept by the page's own code, so it can't be changed here.", tone: "error" }); return; }
        e.preventDefault();
        e.stopPropagation();
        openStrip(el, f, e.clientX, e.clientY);
        return;
      }
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      if (isInline(f.spec) && f.ref.field !== "*") startInline(el, f.ref, f.spec);
      else setPanel({ ref: f.ref, focus: f.name });
    };
    const onOver = (e: MouseEvent) => {
      const tag = tagRef.current;
      if (!tag) return;
      const t = e.target;
      const el = t instanceof Element ? t.closest("[data-field]") : null;
      const f = el && editable(el);
      if (!el || !f || inline.current || isLive) { tag.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      tag.textContent = f.ref.field === "*" ? "block · its settings · panel" : `field · ${f.spec.label ?? f.ref.field}${isInline(f.spec) ? "" : " · panel"}${f.ref.kind === "record" ? " · the record itself" : ""}`;
      tag.style.display = "block";
      tag.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 220))}px`;
      tag.style.top = `${Math.max(4, r.top - 20)}px`;
    };
    const onLeave = () => { if (tagRef.current) tagRef.current.style.display = "none"; };
    // Live edit: right-click on anything editable is its content info. Anywhere else the browser's own menu.
    const onContext = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-fields-ui]")) return;
      const el = t.closest("[data-field]");
      if (!(el instanceof HTMLElement)) return;
      if ((inline.current && inline.current.el.contains(el)) || (richRef.current && richRef.current.el.contains(el))) return;
      const f = editable(el);
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      setStrip(null);
      setPick(null);
      setInfo({ x: e.clientX, y: e.clientY, el, ref: f.ref, name: f.name, spec: f.spec });
    };
    // Esc: the strip, the card or the picture box first; then Live edit itself. The panel and text being typed take their own.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const u = ui.current;
      if (u.strip || u.info || u.pick) { e.preventDefault(); e.stopPropagation(); if (richRef.current) cancelRich(); setStrip(null); setInfo(null); setPick(null); return; }
      if (u.panel || inline.current || richRef.current) return;
      e.preventDefault();
      propsRef.current.live?.onExit();
    };
    // A press anywhere else puts the card and the strip away (words being typed in place keep theirs until Save or Esc).
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest(".fl-strip,.fl-info,.fl-pickpop,.fl-pencil")) return;
      setInfo(null);
      if (!richRef.current) setStrip(null);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", onLeave);
    if (isLive) {
      document.addEventListener("contextmenu", onContext, true);
      document.addEventListener("keydown", onEsc);
      document.addEventListener("pointerdown", onDown, true);
    }
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("contextmenu", onContext, true);
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("pointerdown", onDown, true);
      inline.current?.cancel();
      if (richRef.current) cancelRich();
      document.body.removeAttribute("data-fields-lens");
      document.body.removeAttribute("data-fields-live");
      if (tagRef.current) tagRef.current.style.display = "none";
      if (isLive) { setStrip(null); setInfo(null); setPick(null); setPanel(null); setPencils(false); }
    };
  }, [on, isLive, editable, startInline, say, openStrip, cancelRich]);

  /** The block's own description setting for a picture (alt, caption...), if it declares one. */
  const describeProp = (t: Target): string | null => {
    if (t.ref.kind !== "block") return null;
    const entry = propsRef.current.blocks?.map[blockTypes.current.get(t.ref.id) ?? ""];
    if (!entry) return null;
    const names = [...Object.values(entry.parts).map((q) => q.prop), ...Object.keys(entry.others)];
    return names.find((n) => n !== t.ref.field && /(^|[a-z])(alt|caption|describ)/i.test(n) && fieldsFor("block", t.ref.id)?.[n]) ?? null;
  };

  const actionsFor = (t: Target, mode: StripMode): StripAction[] => {
    if (mode === "rich") return [{ id: "bold", label: "Bold" }, { id: "italic", label: "Italic" }, { id: "link", label: "Link" }, { id: "save", label: "Save", primary: true }, { id: "cancel", label: "Cancel" }];
    const kind = liveKindOf(t.ref, t.spec);
    const what: StripAction = { id: "where", label: kind === "record" || t.ref.kind === "record" ? "Where this comes from" : "What is this?" };
    if (kind === "picture") {
      const d = describeProp(t);
      return [
        { id: "upload", label: "Upload a new photo", primary: true },
        { id: "library", label: "Choose from the library" },
        d ? { id: "describe", label: "Describe it" } : { id: "describe", label: "Describe it", off: "This picture has no description setting on its block yet." },
        what,
      ];
    }
    if (kind === "rich") return [{ id: "rich", label: "Edit words", primary: true }, { id: "panel", label: "Open in the panel" }, what];
    if (t.ref.kind === "record") return [{ id: "panel", label: "Edit this field", primary: true, hint: "Opens the record's field, with the warning that it changes the record everywhere" }, what];
    if (kind === "words") return isInline(t.spec) ? [{ id: "type", label: "Edit words", primary: true }, { id: "panel", label: "Open in the panel" }, what] : [{ id: "panel", label: "Edit words", primary: true }, what];
    if (kind === "box") return [{ id: "panel", label: "Change this block's settings", primary: true }, what];
    return [{ id: "panel", label: "Change this setting", primary: true }, what];
  };

  const act = (id: string) => {
    const s = strip;
    if (!s) return;
    const t: Target = s;
    if (id === "type") { setStrip(null); startInline(s.el, s.ref, s.spec); }
    else if (id === "panel") { setStrip(null); setPanel({ ref: s.ref, focus: s.name }); }
    else if (id === "where") { setStrip(null); setInfo(t); }
    else if (id === "rich") { startRich(s.el, s.ref, s.spec); setStrip({ ...s, mode: "rich" }); }
    else if (id === "bold" || id === "italic") { document.execCommand(id); }
    else if (id === "link") {
      const sel = window.getSelection();
      const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!r || r.collapsed || !s.el.contains(r.commonAncestorContainer)) { say({ text: "Select the words to link first.", tone: "error" }); return; }
      if (richRef.current) richRef.current.range = r.cloneRange();
      setStrip({ ...s, mode: "link" });
    }
    else if (id === "save") void saveRich();
    else if (id === "cancel") cancelRich();
    else if (id === "upload" || id === "library") { setStrip(null); setPick({ ...t, tab: id }); }
    else if (id === "describe") { const d = describeProp(t); if (d) { setStrip(null); setPanel({ ref: s.ref, focus: d }); } }
  };
  const addLink = (url: string) => {
    const s = strip;
    const r = richRef.current;
    if (!s || !r) return;
    if (!linkOk(url)) { say({ text: "That link is not allowed. Use an address that starts with https:// or /.", tone: "error" }); return; }
    r.el.focus();
    const sel = window.getSelection();
    if (sel && r.range) { sel.removeAllRanges(); sel.addRange(r.range); }
    document.execCommand("createLink", false, url);
    setStrip({ ...s, mode: "rich" });
  };

  const look = useMemo(() => {
    if (!p.lookHref) return null;
    if (typeof p.lookHref === "string") return p.lookHref;
    return typeof window === "undefined" ? null : p.lookHref(window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lookHref, panel]);

  if (found === 0 && !on) return null;
  if (live && !on) return null;
  const labels = { edit: p.labels?.edit ?? "Edit page", done: p.labels?.done ?? "Done" };

  return (
    <div data-fields-ui="" data-de-ui="">
      <style>{STYLES}{LIVE_STYLES}</style>
      {live ? (
        <div className="fl-live" role="toolbar" aria-label="Live edit">
          <span className="fl-live__on"><span className="fl-live__dot" aria-hidden="true" />Live edit is on</span>
          {found === 0 && !notice && <span className="fl-live__note">Nothing on this page can be changed here.</span>}
          {notice && (
            <span className={`fl-live__note fl-live__note--${notice.tone}`} role="status">
              {notice.text}
              {notice.reload && <button type="button" onClick={() => window.location.reload()}>Reload</button>}
            </span>
          )}
          <label className="fl-switch">
            <input type="checkbox" role="switch" data-fl-pencils="" checked={pencils} onChange={(e) => setPencils(e.target.checked)} />
            <span className="fl-switch__track" aria-hidden="true" />
            <span>Show pencils</span>
          </label>
          <button type="button" className="fl-bar__toggle" data-fl-done="" onClick={() => live.onExit()}>Done</button>
        </div>
      ) : (
      <div className="fl-bar" role="toolbar" aria-label="Fields lens">
        {on && <span className="fl-bar__hint">Click a field to change it</span>}
        {notice && (
          <span className={`fl-bar__note fl-bar__note--${notice.tone}`} role="status">
            {notice.text}
            {notice.reload && <button type="button" onClick={() => window.location.reload()}>Reload</button>}
          </span>
        )}
        <button type="button" className="fl-bar__toggle" aria-pressed={on} onClick={() => { if (on) { setPanel(null); say(null); } setOn(!on); }}>
          {on ? labels.done : labels.edit}
        </button>
      </div>
      )}
      {live && pencils && <Pencils onPick={(el, x, y) => { const f = editable(el); if (f) openStrip(el, f, x, y); }} />}
      {live && strip && (
        <Strip
          x={strip.x} y={strip.y} kind={liveKindOf(strip.ref, strip.spec)} mode={strip.mode}
          label={strip.mode === "menu" ? stripLabel(strip) : strip.mode === "link" ? "Add a link" : "Edit words in place"}
          actions={actionsFor(strip, strip.mode)} note={strip.mode === "rich" ? "Select some words, then Bold, Italic or Link. Save keeps them, Esc drops them." : undefined}
          onAct={act} onLink={addLink} onBackFromLink={() => setStrip({ ...strip, mode: "rich" })} onClose={() => setStrip(null)}
        />
      )}
      {live && info && (() => {
        const d = describeField({ ref: info.ref, spec: info.spec, name: info.name, registry: p.registry, blocks: p.blocks, blockType: info.ref.kind === "block" ? blockTypes.current.get(info.ref.id) : undefined, slug: p.blocks?.slug ?? pageSlugOf(document) ?? "" });
        return <InfoCard x={info.x} y={info.y} title={d.title} rows={d.rows} onClose={() => setInfo(null)} />;
      })()}
      {live && pick && p.choosePicture && (
        <PicturePop
          x={pick.x} y={pick.y} tab={pick.tab} choose={p.choosePicture}
          onClose={() => setPick(null)}
          onPick={(url) => {
            const t = pick;
            setPick(null);
            void saveOne(t.ref, t.spec, url).then((ok) => { if (ok && t.el instanceof HTMLImageElement) { t.el.removeAttribute("srcset"); t.el.src = url; } });
          }}
        />
      )}
      <div ref={tagRef} className="fl-tag" style={{ display: "none" }} />
      {on && panel && (
        <FieldsPanel
          key={`${panel.ref.kind}:${panel.ref.id}`}
          p={p}
          kind={targetOf(panel.ref).kind}
          id={targetOf(panel.ref).id}
          domPrefix={panel.ref.kind === "record" ? `record:${targetOf(panel.ref).kind}:${targetOf(panel.ref).id}:` : `${panel.ref.kind}:${panel.ref.id}:`}
          fieldsOf={fieldsFor}
          oneAtATime={panel.ref.kind === "block"}
          title={panel.ref.kind === "block" ? blockTitle(p.blocks?.map, blockTypes.current.get(panel.ref.id)) : undefined}
          shared={panel.ref.kind === "record" ? p.registry[targetOf(panel.ref).kind]?.shared : undefined}
          focus={panel.focus}
          lookHref={look}
          onLook={p.onLook ? () => { setPanel(null); setOn(false); live?.onExit(); p.onLook?.(); } : undefined}
          onClose={() => setPanel(null)}
          say={say}
        />
      )}
    </div>
  );
}

/** The strip's first words: what is under the pointer. */
function stripLabel(t: { ref: FieldRef; spec: FieldSpec; name: string }): string {
  const kind = liveKindOf(t.ref, t.spec);
  if (kind === "picture") return "Picture";
  if (kind === "box") return "Block";
  if (t.ref.kind === "record") return `Record: ${t.spec.label ?? t.ref.field}`;
  return kind === "words" || kind === "rich" ? "Words" : t.spec.label ?? "Setting";
}

/** The site's own picture chooser (upload, the library), in a box at the pointer. Upload is its first tab; "library" opens the second. */
function PicturePop(props: { x: number; y: number; tab: "upload" | "library"; choose: FieldsPictureChooser; onPick(url: string): void; onClose(): void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    const r = box.current?.getBoundingClientRect();
    const w = r?.width ?? 360, h = r?.height ?? 300;
    setPos({ left: Math.max(8, Math.min(props.x, window.innerWidth - w - 8)), top: Math.max(8, Math.min(props.y + 10, window.innerHeight - h - 8)) });
  }, [props.x, props.y]);
  useEffect(() => {
    if (!host.current) return;
    const dispose = props.choose(host.current, { onPick: props.onPick });
    let tries = 0;
    const t = window.setInterval(() => {
      const tabs = host.current?.querySelectorAll<HTMLElement>('[role="tab"]');
      if (props.tab === "library" && tabs && tabs.length > 1) { tabs[1]!.click(); window.clearInterval(t); }
      else if (props.tab === "upload" || ++tries > 20) window.clearInterval(t);
    }, 50);
    return () => { window.clearInterval(t); dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={box} className="fl-pickpop" role="dialog" aria-label={props.tab === "upload" ? "Upload a new photo" : "Choose a picture"} data-fields-ui="" data-de-ui="" style={pos}>
      <div className="fl-pickpop__head"><span>{props.tab === "upload" ? "Upload a new photo" : "Choose from the library"}</span><button type="button" className="fl-x" aria-label="Close" onClick={props.onClose}>×</button></div>
      <div ref={host} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The side panel (C)
// ---------------------------------------------------------------------------

/** "Card on this page", from the block's own declaration. */
function blockTitle(map: BlockFieldMap | undefined, type: string | undefined): string | undefined {
  const label = type ? map?.[type]?.label : undefined;
  return label ? `${label} on this page` : undefined;
}

function FieldsPanel(props: {
  p: FieldsLensProps; kind: string; id: string; focus: string; lookHref: string | null; onLook?(): void; onClose(): void; say(n: Notice | null): void;
  /** The `data-field` prefix of this record's elements on the page, up to the field name. */
  domPrefix: string;
  fieldsOf(kind: string, id: string): Record<string, FieldSpec> | null;
  /** A block's settings are shown one value at a time: the one clicked, and a short list to move to another. */
  oneAtATime?: boolean;
  title?: string;
  /** Said beside the fields of a record that many places draw. */
  shared?: string;
}) {
  const { p, kind, id, focus, onClose, say } = props;
  const fields = props.fieldsOf(kind, id) ?? {};
  const allNames = Object.keys(fields);
  const [current, setCurrent] = useState(focus);
  // Clicking another value of the same block while the panel is open moves the panel to it.
  useEffect(() => { setCurrent(focus); }, [focus]);
  const names = props.oneAtATime ? allNames.filter((n) => n === current) : allNames;
  const elsewhere = props.oneAtATime ? allNames.filter((n) => n !== current) : [];
  const [stored, setStored] = useState<Record<string, string> | null>(null);
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [readOnly, setReadOnly] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [previous, setPrevious] = useState<Record<string, PreviousVersion>>({});
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    p.load({ kind, id }).then((r) => {
      if (!live) return;
      if (!r.ok) { setLoadError(r.error || "Could not load this."); return; }
      setPrevious(r.previous ?? {});
      setStored(r.values ?? {});
      setDraft(r.values ?? {});
      setVersion(r.version);
      if (r.readOnly) setReadOnly(r.readOnly);
    }).catch(() => live && setLoadError("Could not load this."));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  // Focus the clicked field once the values are in.
  useEffect(() => {
    if (!stored) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-fl-input="${CSS.escape(current)}"]`);
    el?.focus();
    el?.closest(".fl-field")?.scrollIntoView({ block: "nearest" });
  }, [stored, current]);

  const changed = names.filter((n) => stored && (draft[n] ?? "") !== (stored[n] ?? ""));
  const dirty = changed.length > 0;

  const close = () => {
    if (dirty && !window.confirm("Throw away your changes to these fields?")) return;
    onClose();
  };

  /** Move to another setting of the same block. One value at a time: an unsaved change here is asked about first. */
  const moveTo = (name: string) => {
    if (dirty && !window.confirm("Throw away your change to this setting?")) return;
    if (stored) setDraft((d) => ({ ...d, [current]: stored[current] ?? "" }));
    setErrors({});
    setCurrent(name);
  };

  const submit = async () => {
    if (!stored || saving || !dirty) return;
    const errs: Record<string, string> = {};
    const values: Record<string, string> = {};
    for (const n of changed) {
      const c = checkValue(fields[n]!, draft[n] ?? "");
      if (!c.ok) errs[n] = c.error; else values[n] = c.value;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const res = await p.save({ kind, id, values, version }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      if (res?.stale) { setStale(true); say({ text: STALE, tone: "error", reload: true }); }
      else say({ text: res?.error || "Could not save. Try again.", tone: "error" });
      return;
    }
    const next = { ...stored, ...values };
    setStored(res.values ? { ...next, ...res.values } : next);
    setDraft((d) => ({ ...d, ...values }));
    if (res.version !== undefined) setVersion(res.version);
    if (res.previous) setPrevious(res.previous);
    // Text fields shown as plain text on the page follow at once; everything else follows the refresh.
    for (const [n, v] of Object.entries(values)) {
      const spec = fields[n]!;
      if (spec.input !== "text" || v === "") continue;
      document.querySelectorAll(`[data-field="${CSS.escape(`${props.domPrefix}${n}`)}"]`).forEach((el) => {
        if (el.childNodes.length === 1 && el.firstChild?.nodeType === 3) (el.firstChild as Text).nodeValue = v;
      });
    }
    say({ text: "Saved", tone: "ok" });
    p.onSaved?.({ kind, id, values });
  };

  const putBack = async (n: string) => {
    if (!p.restore || saving || !stored) return;
    if ((draft[n] ?? "") !== (stored[n] ?? "") && !window.confirm("Throw away your unsaved change to this and put back the previous version?")) return;
    setSaving(true);
    const res = await p.restore({ kind, id, field: n }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { say({ text: res?.error || "Could not put it back. Try again.", tone: "error" }); return; }
    const vals = res.values ?? {};
    setStored((s) => ({ ...(s ?? {}), ...vals }));
    setDraft((d) => ({ ...d, [n]: vals[n] ?? "" }));
    if (res.version !== undefined) setVersion(res.version);
    setPrevious(res.previous ?? {});
    say({ text: "Put back", tone: "ok" });
    p.onSaved?.({ kind, id, values: { [n]: vals[n] ?? "" } });
  };

  return (
    <aside
      ref={root}
      className="fl-panel"
      role="dialog"
      aria-label={props.title ?? recordLabel(p.registry, kind, id)}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
    >
      <header className="fl-panel__head">
        <div>
          <p className="fl-panel__kicker">Fields</p>
          <h2>{props.title ?? recordLabel(p.registry, kind, id)}</h2>
        </div>
        <button type="button" className="fl-x" aria-label="Close" onClick={close}>×</button>
      </header>

      <div className="fl-panel__body">
        {loadError && <p className="fl-msg fl-msg--error">{loadError}</p>}
        {!stored && !loadError && <p className="fl-msg">Loading…</p>}
        {props.shared && <p className="fl-msg fl-msg--shared">{props.shared}</p>}
        {readOnly && <p className="fl-msg fl-msg--lock">Read only: {readOnly}</p>}
        {stale && <p className="fl-msg fl-msg--error">{STALE} <button type="button" onClick={() => window.location.reload()}>Reload</button></p>}
        {stored && names.map((n) => {
          const spec = fields[n]!;
          const locked = Boolean(readOnly || spec.readOnly);
          const v = draft[n] ?? "";
          const set = (value: string) => { setDraft((d) => ({ ...d, [n]: value })); if (errors[n]) setErrors((e) => ({ ...e, [n]: "" })); };
          return (
            <div key={n} className={`fl-field${n === current ? " is-focus" : ""}`}>
              <label className="fl-field__label" htmlFor={`fl-${n}`}>
                {spec.label ?? n}
                {(draft[n] ?? "") !== (stored[n] ?? "") && <span className="fl-dot" title="Changed" />}
              </label>
              {spec.hint && <p className="fl-field__hint">{spec.hint}</p>}
              <FieldInput id={`fl-${n}`} name={n} spec={spec} value={v} onChange={set} locked={locked} choosePicture={p.choosePicture} records={p.records} />
              {spec.readOnly && <p className="fl-field__hint">Read only: {spec.readOnly}</p>}
              {errors[n] && <p className="fl-field__err">{errors[n]}</p>}
              {!locked && spec.optional !== false && v !== "" && spec.input !== "record" && (
                <button type="button" className="fl-clear" onClick={() => set("")}>
                  {spec.input === "image" ? "Remove picture" : spec.input === "select" || spec.input === "boolean" || spec.input === "number" ? "Back to the default" : "Clear"}
                </button>
              )}
              {!locked && v === "" && (stored[n] ?? "") === "" && spec.optional !== false && spec.input !== "record" && (
                <p className="fl-field__hint">{spec.input === "select" || spec.input === "boolean" || spec.input === "number" ? "Using the block's own default." : "Empty: the page shows its own wording."}</p>
              )}
              {!locked && p.restore && previous[n] && (
                <div className="fl-prev">
                  <button type="button" className="fl-clear fl-prev__btn" disabled={saving} onClick={() => void putBack(n)}>
                    Put back the previous version
                  </button>
                  <p className="fl-field__hint">
                    {previous[n]!.value === "" ? "It was empty. " : ""}
                    Replaced {fmtWhen(previous[n]!.at)}{previous[n]!.by ? ` by ${previous[n]!.by}` : ""}.
                  </p>
                  {previous[n]!.value !== "" && (
                    <p className="fl-prev__text">{previous[n]!.value.length > 160 ? `${previous[n]!.value.slice(0, 160)}…` : previous[n]!.value}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {elsewhere.length > 0 && (
          <div className="fl-more">
            <label htmlFor="fl-more-select" className="fl-field__hint">Another setting of this block</label>
            <select id="fl-more-select" className="fl-input" value="" onChange={(e) => e.target.value && moveTo(e.target.value)}>
              <option value="">Choose…</option>
              {elsewhere.map((n) => <option key={n} value={n}>{fields[n]!.label ?? n}</option>)}
            </select>
          </div>
        )}
      </div>

      <footer className="fl-panel__foot">
        <div className="fl-panel__actions">
          <button type="button" className="fl-btn fl-btn--primary" disabled={!dirty || saving || Boolean(readOnly) || stale} onClick={submit}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="fl-btn" onClick={close}>Cancel</button>
        </div>
        {props.onLook ? (
          <button type="button" className="fl-look" onClick={() => { if (!dirty || window.confirm("Throw away your changes to these fields?")) props.onLook?.(); }}>Edit the look…</button>
        ) : props.lookHref ? (
          <a className="fl-look" href={props.lookHref}>Edit the look…</a>
        ) : null}
      </footer>
    </aside>
  );
}

function FieldInput(props: {
  id: string; name: string; spec: FieldSpec; value: string; onChange(v: string): void; locked: boolean; choosePicture?: FieldsPictureChooser; records?: FieldsRecordSources;
}) {
  const { id, name, spec, value, onChange, locked } = props;
  const common = { id, "data-fl-input": name, disabled: locked, className: "fl-input", maxLength: spec.max ? spec.max + 200 : undefined } as const;
  switch (spec.input) {
    case "textarea":
      return <textarea {...common} rows={6} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "list":
      return <ListInput id={id} name={name} spec={spec} value={value} onChange={onChange} locked={locked} />;
    case "rich":
      return (
        <div data-fl-input={name} tabIndex={-1} className={locked ? "fl-rich is-locked" : "fl-rich"}>
          <Suspense fallback={<p className="fl-msg">Loading the editor…</p>}>
            <RichTextEditor value={value} onChange={locked ? () => {} : onChange} toolbar="minimal" ariaLabel={spec.label ?? name} minHeight={160} />
          </Suspense>
        </div>
      );
    case "select": {
      // A block's choice that is left empty uses the block's own default, and says which.
      const dflt = spec.default !== undefined ? (spec.options ?? []).find((o) => o.value === spec.default)?.label ?? spec.default : null;
      return (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{dflt !== null ? `Default (${dflt})` : "(none)"}</option>
          {(spec.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    case "boolean": {
      // With a declared default, "" means "use it" and the box shows that; both states are then saved as true or false.
      const explicit = spec.default !== undefined;
      const on = explicit ? (value === "" ? spec.default === "true" : value === "true") : value === "true";
      return (
        <label className="fl-check">
          <input type="checkbox" id={id} data-fl-input={name} disabled={locked} checked={on} onChange={(e) => onChange(explicit ? (e.target.checked ? "true" : "false") : e.target.checked ? "true" : "")} />
          <span>{on ? "On" : "Off"}{explicit && value === "" ? " (the default)" : ""}</span>
        </label>
      );
    }
    case "record":
      return <RecordInput id={id} name={name} spec={spec} value={value} onChange={onChange} locked={locked} records={props.records} />;
    case "color":
      return <input {...common} type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />;
    case "image":
      return <ImageInput {...props} />;
    case "url":
      return <input {...common} type="url" inputMode="url" placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <div className="fl-num">
          <input
            {...common}
            type="number"
            min={spec.range?.min}
            max={spec.range?.max}
            step={spec.range?.step}
            placeholder={spec.default}
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {spec.range?.unit && <span className="fl-num__unit">{spec.range.unit}</span>}
          {(spec.range?.min !== undefined || spec.range?.max !== undefined) && (
            <p className="fl-field__hint">
              {spec.range.min !== undefined && spec.range.max !== undefined ? `From ${spec.range.min} to ${spec.range.max}.` : spec.range.min !== undefined ? `${spec.range.min} or more.` : `${spec.range.max} or less.`}
            </p>
          )}
        </div>
      );
    case "date":
      return <input {...common} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <input {...common} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "readonly":
      return <input {...common} readOnly disabled value={value} />;
    case "compound":
      return <p className="fl-msg">Grouped fields are not in this pilot.</p>;
    default:
      return <input {...common} type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** "12 Nov" for a stored ISO time; the raw text when it cannot be read. */
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A setting filled from a record: "Comes from <the record>", a way to choose another, and a way to let it go. The value
 * is the reference the host's record sources give (what the block stores). Without sources it is only shown.
 */
function RecordInput(props: { id: string; name: string; spec: FieldSpec; value: string; onChange(v: string): void; locked: boolean; records?: FieldsRecordSources }) {
  const { name, spec, value, onChange, locked, records } = props;
  const binds = spec.binds ?? "";
  const usable = !!records && records.handles(binds);
  const [shown, setShown] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<{ ref: string; label: string }[] | null>(null);
  const [source, setSource] = useState("");
  const [list, setList] = useState<{ value: string; label: string; hint?: string; disabled?: boolean }[] | null>(null);
  const [find, setFind] = useState("");

  // What the stored reference draws, in the host's own words.
  useEffect(() => {
    let live = true;
    setShown(null);
    if (!value || !records || !usable) return;
    records.resolve(binds, value).then((drawn) => live && setShown(records.describe(binds, value, drawn)), () => live && setShown(null));
    return () => { live = false; };
  }, [value, binds, records, usable]);

  useEffect(() => {
    if (!open || !records || !usable) return;
    let live = true;
    records.sources(binds).then((s) => { if (!live) return; setSources(s); setSource((cur) => cur || s[0]?.ref || ""); }, () => live && setSources([]));
    return () => { live = false; };
  }, [open, binds, records, usable]);

  useEffect(() => {
    if (!open || !records || !usable || !source) return;
    let live = true;
    setList(null);
    records.choices(binds, source).then((c) => live && setList(c), () => live && setList([]));
    return () => { live = false; };
  }, [open, source, binds, records, usable]);

  const matches = (list ?? []).filter((c) => !find.trim() || `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(find.trim().toLowerCase()));
  return (
    <div data-fl-input={name} tabIndex={-1} className="fl-record">
      <p className="fl-record__now">
        {value ? <>Comes from: <strong>{usable ? shown ?? "…" : value}</strong></> : "Nothing chosen: this setting is not filled from a record."}
      </p>
      {!usable && value && <p className="fl-field__hint">Reference: {value}</p>}
      {usable && !locked && (
        <div className="fl-record__acts">
          <button type="button" className="fl-btn" onClick={() => { setOpen((o) => !o); setFind(""); }}>{open ? "Close the list" : value ? "Choose another…" : "Choose…"}</button>
          {value && <button type="button" className="fl-clear" onClick={() => { onChange(""); setOpen(false); }}>{records?.clearLabel?.(binds) ?? "Clear the choice"}</button>}
        </div>
      )}
      {usable && !locked && open && (
        <div className="fl-record__pick">
          <p className="fl-field__hint">{records?.title?.(binds) ?? "Choose one"}</p>
          {sources && sources.length > 1 && (
            <select className="fl-input" aria-label="Where from" value={source} onChange={(e) => setSource(e.target.value)}>
              {sources.map((s) => <option key={s.ref} value={s.ref}>{s.label}</option>)}
            </select>
          )}
          {list && list.length > 8 && <input className="fl-input" type="search" placeholder="Find…" aria-label="Find" value={find} onChange={(e) => setFind(e.target.value)} />}
          {!list && <p className="fl-field__hint">Loading…</p>}
          {list && matches.length === 0 && <p className="fl-field__hint">Nothing to choose from here.</p>}
          <ul className="fl-record__list">
            {matches.map((c) => (
              <li key={c.value}>
                <button type="button" className={`fl-record__item${c.value === value ? " is-now" : ""}`} disabled={c.disabled} onClick={() => { onChange(c.value); setOpen(false); }}>
                  <span>{c.label}</span>
                  {c.hint && <span className="fl-record__hint">{c.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A list of short lines: one box per line, "Add a line", and a remove button on each. The value is the lines joined by "\n". */
function ListInput(props: { id: string; name: string; spec: FieldSpec; value: string; onChange(v: string): void; locked: boolean }) {
  const { id, name, spec, value, onChange, locked } = props;
  const rows = value === "" ? [] : value.split("\n");
  const put = (next: string[]) => onChange(next.join("\n"));
  return (
    <div data-fl-input={name} tabIndex={-1} className="fl-list">
      {rows.length === 0 && <p className="fl-field__hint">No lines yet.</p>}
      {rows.map((row, i) => (
        <div key={i} className="fl-list__row">
          <input
            id={i === 0 ? id : undefined}
            className="fl-input"
            type="text"
            disabled={locked}
            value={row}
            maxLength={spec.max ? spec.max + 100 : undefined}
            aria-label={`${spec.label ?? name}, line ${i + 1}`}
            onChange={(e) => put(rows.map((r, j) => (j === i ? e.target.value.replace(/[\r\n]+/g, " ") : r)))}
          />
          {!locked && (
            <button type="button" className="fl-list__x" aria-label={`Remove line ${i + 1}`} onClick={() => put(rows.filter((_, j) => j !== i))}>×</button>
          )}
        </div>
      ))}
      {!locked && (
        <button
          type="button"
          className="fl-btn"
          disabled={rows.length >= (spec.maxItems ?? 30)}
          // An empty line is kept while typing; the check drops it on save.
          onClick={() => put([...rows, ""])}
        >
          Add a line
        </button>
      )}
    </div>
  );
}

function ImageInput(props: { id: string; name: string; value: string; onChange(v: string): void; locked: boolean; choosePicture?: FieldsPictureChooser }) {
  const { value, onChange, locked, choosePicture, name } = props;
  const host = useRef<HTMLDivElement | null>(null);
  const dispose = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => { dispose.current?.(); }, []);
  const choose = () => {
    if (!choosePicture || !host.current) return;
    dispose.current?.();
    setOpen(true);
    dispose.current = choosePicture(host.current, {
      value,
      onPick: (url) => { onChange(url); dispose.current?.(); dispose.current = null; setOpen(false); },
    });
  };
  return (
    <div data-fl-input={name} tabIndex={-1}>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="fl-img" src={value} alt="" />
      )}
      {!locked && (
        <button type="button" className="fl-btn" disabled={!choosePicture} onClick={choose}>{value ? "Change picture…" : "Choose picture…"}</button>
      )}
      {!choosePicture && <p className="fl-field__hint">This site has not connected a picture chooser.</p>}
      <div ref={host} hidden={!open} />
    </div>
  );
}

// The cue is dashed teal and a floating "field" tag: not the canvas's solid selection box.
const STYLES = `
body[data-fields-lens] [data-fields-ok="1"]{text-decoration:underline dashed #2a9d8f;text-decoration-thickness:1.5px;text-underline-offset:5px;cursor:text}
body[data-fields-lens] [data-fields-ok="1"]:hover{background:rgba(42,157,143,.12)}
body[data-fields-lens] [data-fields-box][data-fields-ok="1"]{text-decoration:none;cursor:pointer}
body[data-fields-lens] [data-fields-box][data-fields-ok="1"]:hover{background:none;outline:2px dashed #2a9d8f;outline-offset:-2px}
body[data-fields-lens] [data-fields-ok="1"][data-field-state="editing"]{text-decoration:none;outline:2px dotted #2a9d8f;outline-offset:3px;background:rgba(42,157,143,.1);cursor:text}
body[data-fields-lens] [data-fields-ok="1"][data-field-state="saving"]{opacity:.6}
.fl-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:6px 6px 6px 14px;background:#10201e;color:#e6f4f1;border:1px solid #2a9d8f;border-radius:999px;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.fl-bar:not(:has(.fl-bar__hint,.fl-bar__note)){padding-left:6px}
.fl-bar__hint{opacity:.8}
.fl-bar__note{font-weight:600}
.fl-bar__note--error{color:#ffb4a8}
.fl-bar__note button{margin-left:8px;font:inherit;text-decoration:underline;background:none;border:0;color:inherit;cursor:pointer}
.fl-bar__toggle{font:600 13px system-ui,sans-serif;padding:8px 16px;border-radius:999px;border:0;background:#2a9d8f;color:#04110f;cursor:pointer}
.fl-bar__toggle[aria-pressed="true"]{background:#e6f4f1}
.fl-tag{position:fixed;z-index:2147483000;pointer-events:none;padding:2px 8px;background:#2a9d8f;color:#04110f;font:600 11px/1.5 system-ui,sans-serif;border-radius:3px;white-space:nowrap}
.fl-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147482900;width:min(400px,100vw);display:flex;flex-direction:column;background:#fbfaf7;color:#1b1e20;border-left:3px solid #2a9d8f;box-shadow:-8px 0 32px rgba(0,0,0,.28);font:400 14px/1.45 system-ui,sans-serif}
.fl-panel__head{display:flex;justify-content:space-between;gap:12px;padding:16px 18px 10px;border-bottom:1px solid #dcd8cf}
.fl-panel__head h2{margin:0;font:650 17px/1.25 system-ui,sans-serif}
.fl-panel__kicker{margin:0 0 2px;font:600 11px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#1f7a6f}
.fl-x{align-self:flex-start;font-size:22px;line-height:1;background:none;border:0;cursor:pointer;color:inherit}
.fl-panel__body{flex:1;overflow:auto;padding:14px 18px 24px;display:flex;flex-direction:column;gap:16px}
.fl-field{padding:10px 12px;border:1px solid #dcd8cf;border-radius:6px;background:#fff}
.fl-field.is-focus{border-color:#2a9d8f;box-shadow:0 0 0 2px rgba(42,157,143,.25)}
.fl-field__label{display:flex;align-items:center;gap:6px;font-weight:650;margin-bottom:2px}
.fl-dot{width:7px;height:7px;border-radius:50%;background:#2a9d8f}
.fl-field__hint{margin:0 0 6px;font-size:12.5px;color:#5c6165}
.fl-field__err{margin:6px 0 0;font-size:12.5px;color:#b3261e}
.fl-input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #b9b5ab;border-radius:4px;font:inherit;background:#fff;color:inherit}
.fl-input:disabled{background:#f0eee8;color:#6c7074}
textarea.fl-input{resize:vertical}
.fl-rich.is-locked{opacity:.6;pointer-events:none}
.fl-check{display:flex;gap:8px;align-items:center}
.fl-num{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.fl-num .fl-input{width:8em}
.fl-num__unit{font-size:13px;color:#5c6165}
.fl-num .fl-field__hint{flex-basis:100%;margin:0}
.fl-more{padding-top:4px}
.fl-record__now{margin:0 0 8px}
.fl-record__acts{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.fl-record__pick{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.fl-record__list{list-style:none;margin:0;padding:0;max-height:240px;overflow:auto;border:1px solid #dcd8cf;border-radius:4px}
.fl-record__item{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:8px 10px;border:0;border-bottom:1px solid #eee9de;background:#fff;font:inherit;cursor:pointer;color:inherit}
.fl-record__item:hover{background:#eef6f4}
.fl-record__item.is-now{background:#e1f1ee;font-weight:600}
.fl-record__item:disabled{opacity:.5;cursor:default}
.fl-record__hint{font-size:12px;color:#5c6165;white-space:nowrap}
.fl-list{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.fl-list__row{display:flex;gap:6px;width:100%}
.fl-list__x{flex:none;min-width:36px;font-size:20px;line-height:1;background:#fff;border:1px solid #b9b5ab;border-radius:4px;cursor:pointer;color:#7a3b34}
.fl-prev{margin-top:8px;padding-top:8px;border-top:1px dashed #dcd8cf}
.fl-prev__btn{margin-top:0}
.fl-prev__text{margin:0;padding:6px 8px;background:#f4f1ea;border-radius:4px;font-size:12.5px;color:#4a4e52;white-space:pre-wrap}
.fl-img{display:block;max-width:100%;max-height:160px;margin-bottom:8px;border-radius:4px}
.fl-clear{margin-top:6px;font:inherit;font-size:12.5px;background:none;border:0;padding:0;color:#7a3b34;text-decoration:underline;cursor:pointer}
.fl-msg{margin:0;padding:8px 10px;border-radius:4px;background:#eef3f2;font-size:13px}
.fl-msg--error{background:#fbe9e7;color:#8a1c14}
.fl-msg--lock{background:#f3efe2}
.fl-msg--shared{background:#fff4d6;color:#5a4300;font-weight:600}
.fl-msg button{font:inherit;text-decoration:underline;background:none;border:0;cursor:pointer;color:inherit}
.fl-panel__foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #dcd8cf;background:#f4f1ea}
.fl-panel__actions{display:flex;gap:8px}
.fl-btn{font:600 13px system-ui,sans-serif;padding:8px 14px;border-radius:4px;border:1px solid #8c887e;background:#fff;color:#1b1e20;cursor:pointer}
.fl-btn--primary{background:#1f7a6f;border-color:#1f7a6f;color:#fff}
.fl-btn:disabled{opacity:.45;cursor:default}
.fl-look{font:inherit;font-size:13px;color:#1f5f58;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer}
@media (max-width:520px){.fl-bar__hint{display:none}}
`;

// ---------------------------------------------------------------------------
// One record's field, opened where a person stands (2026-11-23). The canvas calls this when words that come from a record
// (a tour's name on its card) are double-clicked: the lens's own side panel, its own load and save, its own warning line.
// ---------------------------------------------------------------------------

/** What a host gives so a record's field can open from the canvas: the lens's registry and its two doors. */
export type RecordFieldHost = Pick<FieldsLensProps, "registry" | "load" | "save" | "restore" | "onSaved">;

const RECORD_HOST_CSS = `.fl-record-host .fl-panel{z-index:2147483004}.fl-record-host .fl-bar{z-index:2147483004}`;

export function RecordFieldPanel(props: { host: RecordFieldHost; field: string; onClose(): void }) {
  const { host, field, onClose } = props;
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const say = useCallback((n: Notice | null) => {
    window.clearTimeout(timer.current);
    setNotice(n);
    if (n && n.tone === "ok") timer.current = window.setTimeout(() => setNotice(null), 3000);
  }, []);
  const ref = parseFieldRef(field);
  const p = useMemo<FieldsLensProps>(() => ({
    ...host,
    onSaved(info) {
      // Words drawn from this record show what was saved at once; the page's own data follows when it is loaded again.
      for (const [name, v] of Object.entries(info.values)) {
        if (!v) continue;
        document.querySelectorAll(`[data-words-from="${CSS.escape(`record:${info.kind}:${info.id}:${name}`)}"]`).forEach((el) => {
          if (el.childNodes.length === 1 && el.firstChild?.nodeType === 3) (el.firstChild as Text).nodeValue = v;
        });
      }
      host.onSaved?.(info);
    },
  }), [host]);
  if (!ref || ref.kind !== "record") return null;
  const t = targetOf(ref);
  return (
    <div className="fl-record-host" data-fields-ui="" data-de-ui="">
      <style>{STYLES}</style>
      <style>{RECORD_HOST_CSS}</style>
      {notice && (
        <div className="fl-bar" role="status">
          <span className={`fl-bar__note fl-bar__note--${notice.tone}`}>{notice.text}</span>
        </div>
      )}
      <FieldsPanel
        key={`${t.kind}:${t.id}`}
        p={p}
        kind={t.kind}
        id={t.id}
        domPrefix={`record:${t.kind}:${t.id}:`}
        fieldsOf={(kind, id) => resolveFields(p.registry, kind, id)}
        shared={p.registry[t.kind]?.shared}
        focus={ref.field}
        lookHref={null}
        onClose={onClose}
        say={say}
      />
    </div>
  );
}
