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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkValue, isInline, parseFieldRef, recordLabel, resolveFields,
  type FieldRef, type FieldSpec, type FieldsRegistry,
} from "./registry";
import type { FieldsLoadResult, FieldsSaveInput, FieldsSaveResult, PreviousVersion } from "./save";
import { blockSpecs, type BlockFieldMap } from "./blockmap";
import { pageSlugOf, scanBlocks } from "./scan";

// cms-ui's rich editor is heavy: it loads only when a rich field is opened.
const RichTextEditor = lazy(() => import("@elkdonis/cms-ui/editor").then((m) => ({ default: m.RichTextEditor })));

/** Structurally direct-edit's PictureChooser and cms-ui makeChoosePicture's result. */
export type FieldsPictureChooser = (host: HTMLElement, o: { value?: string; onPick(url: string): void }) => () => void;

export interface FieldsLensProps {
  registry: FieldsRegistry;
  load(args: { kind: string; id: string }): Promise<FieldsLoadResult>;
  save(input: FieldsSaveInput): Promise<FieldsSaveResult>;
  /** Put one field back to the earlier version its record kept ("Put back the previous version"). Omit: the button never shows. */
  restore?(input: { kind: string; id: string; field: string }): Promise<FieldsSaveResult>;
  choosePicture?: FieldsPictureChooser;
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
  const [on, setOn] = useState(false);
  const [found, setFound] = useState(0);
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
      return entry ? blockSpecs(entry) : null;
    }
    return resolveFields(propsRef.current.registry, kind, id);
  }, []);

  const editable = useCallback((el: Element): { ref: FieldRef; spec: FieldSpec } | null => {
    if (el.closest(decline)) return null;
    const ref = parseFieldRef(el.getAttribute("data-field"));
    if (!ref) return null;
    const t = targetOf(ref);
    const spec = fieldsFor(t.kind, t.id)?.[ref.field];
    if (!spec) return null;
    // A value with markup inside it (a title with a link in it) is typed in the panel, never in place.
    return { ref, spec: ref.kind === "block" && spec.inline && el.childElementCount > 0 ? { ...spec, inline: false } : spec };
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
        if (editable(el)) { n++; if (el.getAttribute("data-fields-ok") !== "1") el.setAttribute("data-fields-ok", "1"); }
        else if (el.hasAttribute("data-fields-ok")) el.removeAttribute("data-fields-ok");
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
      document.querySelectorAll("[data-fields-ok]").forEach((el) => el.removeAttribute("data-fields-ok"));
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

  // The lens itself: while on, clicks on declared fields are ours.
  useEffect(() => {
    if (!on) return;
    document.body.setAttribute("data-fields-lens", "on");
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest("[data-fields-ui]")) return;
      const el = t.closest("[data-field]");
      if (!(el instanceof HTMLElement)) return;
      if (inline.current && (inline.current.el === el || inline.current.el.contains(el))) return; // moving the caret
      const f = editable(el);
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      if (isInline(f.spec)) startInline(el, f.ref, f.spec);
      else setPanel({ ref: f.ref, focus: f.ref.field });
    };
    const onOver = (e: MouseEvent) => {
      const tag = tagRef.current;
      if (!tag) return;
      const t = e.target;
      const el = t instanceof Element ? t.closest("[data-field]") : null;
      const f = el && editable(el);
      if (!el || !f || inline.current) { tag.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      tag.textContent = `field · ${f.spec.label ?? f.ref.field}${isInline(f.spec) ? "" : " · panel"}${f.ref.kind === "record" ? " · the record itself" : ""}`;
      tag.style.display = "block";
      tag.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - 220))}px`;
      tag.style.top = `${Math.max(4, r.top - 20)}px`;
    };
    const onLeave = () => { if (tagRef.current) tagRef.current.style.display = "none"; };
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      inline.current?.cancel();
      document.body.removeAttribute("data-fields-lens");
      if (tagRef.current) tagRef.current.style.display = "none";
    };
  }, [on, editable, startInline]);

  const look = useMemo(() => {
    if (!p.lookHref) return null;
    if (typeof p.lookHref === "string") return p.lookHref;
    return typeof window === "undefined" ? null : p.lookHref(window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lookHref, panel]);

  if (found === 0 && !on) return null;
  const labels = { edit: p.labels?.edit ?? "Edit page", done: p.labels?.done ?? "Done" };

  return (
    <div data-fields-ui="" data-de-ui="">
      <style>{STYLES}</style>
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
      <div ref={tagRef} className="fl-tag" style={{ display: "none" }} />
      {on && panel && (
        <FieldsPanel
          key={`${panel.ref.kind}:${panel.ref.id}`}
          p={p}
          kind={targetOf(panel.ref).kind}
          id={targetOf(panel.ref).id}
          domPrefix={panel.ref.kind === "record" ? `record:${targetOf(panel.ref).kind}:${targetOf(panel.ref).id}:` : `${panel.ref.kind}:${panel.ref.id}:`}
          fieldsOf={fieldsFor}
          title={panel.ref.kind === "block" ? blockTitle(p.blocks?.map, blockTypes.current.get(panel.ref.id)) : undefined}
          shared={panel.ref.kind === "record" ? p.registry[targetOf(panel.ref).kind]?.shared : undefined}
          focus={panel.focus}
          lookHref={look}
          onLook={p.onLook ? () => { setPanel(null); setOn(false); p.onLook?.(); } : undefined}
          onClose={() => setPanel(null)}
          say={say}
        />
      )}
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
  title?: string;
  /** Said beside the fields of a record that many places draw. */
  shared?: string;
}) {
  const { p, kind, id, focus, onClose, say } = props;
  const fields = props.fieldsOf(kind, id) ?? {};
  const names = Object.keys(fields);
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
    const el = root.current?.querySelector<HTMLElement>(`[data-fl-input="${CSS.escape(focus)}"]`);
    el?.focus();
    el?.closest(".fl-field")?.scrollIntoView({ block: "nearest" });
  }, [stored, focus]);

  const changed = names.filter((n) => stored && (draft[n] ?? "") !== (stored[n] ?? ""));
  const dirty = changed.length > 0;

  const close = () => {
    if (dirty && !window.confirm("Throw away your changes to these fields?")) return;
    onClose();
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
            <div key={n} className={`fl-field${n === focus ? " is-focus" : ""}`}>
              <label className="fl-field__label" htmlFor={`fl-${n}`}>
                {spec.label ?? n}
                {(draft[n] ?? "") !== (stored[n] ?? "") && <span className="fl-dot" title="Changed" />}
              </label>
              {spec.hint && <p className="fl-field__hint">{spec.hint}</p>}
              <FieldInput id={`fl-${n}`} name={n} spec={spec} value={v} onChange={set} locked={locked} choosePicture={p.choosePicture} />
              {spec.readOnly && <p className="fl-field__hint">Read only: {spec.readOnly}</p>}
              {errors[n] && <p className="fl-field__err">{errors[n]}</p>}
              {!locked && spec.optional !== false && v !== "" && (
                <button type="button" className="fl-clear" onClick={() => set("")}>
                  {spec.input === "image" ? "Remove picture" : "Clear"}
                </button>
              )}
              {!locked && v === "" && (stored[n] ?? "") === "" && spec.optional !== false && (
                <p className="fl-field__hint">Empty: the page shows its own wording.</p>
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
  id: string; name: string; spec: FieldSpec; value: string; onChange(v: string): void; locked: boolean; choosePicture?: FieldsPictureChooser;
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
    case "select":
      return (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">(none)</option>
          {(spec.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "boolean":
      return (
        <label className="fl-check">
          <input type="checkbox" id={id} data-fl-input={name} disabled={locked} checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} />
          <span>{value === "true" ? "On" : "Off"}</span>
        </label>
      );
    case "color":
      return <input {...common} type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />;
    case "image":
      return <ImageInput {...props} />;
    case "url":
      return <input {...common} type="url" inputMode="url" placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input {...common} type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
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
