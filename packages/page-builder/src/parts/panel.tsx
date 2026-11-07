"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createUsePuck, useGetPuck } from "@puckeditor/core";
import { drawnParts, partsOf, ROOT_PART } from "./find";
import { canvasDocument, endSpell, hoverPart, revertSpell, selectPart, spellPending, usePartSelection, writeLive, writeStep } from "./store";
import type { PartLook, PartPanelContext, PartPanelHandle, PartPanelMount, PartsPluginOptions } from "./types";

// ============================================================================
// Panel side of the parts plugin (2026-11-06), mounted from Puck's `fields`
// override. While a part of the selected block is selected, it replaces the
// block's fields: "← Block settings", the part's name, the block's parts as
// chips, and the part's look. Otherwise Puck's own fields are shown.
//
// Every value shown is the stored one; a field with nothing stored shows what
// the page draws now (getComputedStyle on the part) as its placeholder.
// Typed fields write as they are typed and become one undo step when the
// spell ends (store.ts); selects, chips and switches are one step each.
// ============================================================================

const usePuck = createUsePuck();
type Selected = { type: string; props: Record<string, unknown> & { id: string } } | null;
type Key = keyof PartLook;
type Quad = [number, number, number, number];

const WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
const WEIGHT_NAMES: Record<string, string> = { "100": "Thin", "200": "Extra light", "300": "Light", "400": "Regular", "500": "Medium", "600": "Semibold", "700": "Bold", "800": "Extra bold", "900": "Black" };
const LINES = ["none", "solid", "dashed", "dotted", "double"];
const LINE_NAMES: Record<string, string> = { none: "None", solid: "Solid", dashed: "Dashed", dotted: "Dotted", double: "Double" };
const CASES: Array<[string | undefined, string]> = [[undefined, "As designed"], ["none", "As typed"], ["upper", "CAPS"], ["smallcaps", "Small caps"]];
const HEX = /^#[0-9a-f]{3,8}$/i;

function rgbHex(v: string | undefined): string | undefined {
  const m = v ? /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/.exec(v) : null;
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return undefined;
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}
const px = (v: string | undefined) => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "";
};

/** What the page draws now, as the panel's placeholders. */
function computedOf(el: HTMLElement | undefined): Partial<Record<Key, string>> {
  const view = el?.ownerDocument.defaultView;
  if (!el || !view) return {};
  const cs = view.getComputedStyle(el);
  const size = parseFloat(cs.fontSize) || 16;
  const ls = parseFloat(cs.letterSpacing);
  return {
    fill: rgbHex(cs.backgroundColor) ?? "none",
    color: rgbHex(cs.color),
    size: px(cs.fontSize),
    weight: String(Number(cs.fontWeight) || 400),
    tracking: Number.isFinite(ls) ? String(Math.round((ls / size) * 1000) / 1000) : "0",
    padding: px(cs.paddingTop),
    radius: px(cs.borderTopLeftRadius),
    bcolor: rgbHex(cs.borderTopColor),
    bwidth: px(cs.borderTopWidth),
    opacity: String(Math.round((parseFloat(cs.opacity) || 1) * 100) / 100),
  };
}

const shown = (v: unknown) => (Array.isArray(v) ? v.join(" ") : v === undefined || v === null ? "" : String(v));

/** A typed number (or four, for sides and corners); "" removes the value; null is not a value yet. */
function parseNumber(text: string, quad: boolean): number | Quad | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(/[\s,]+/).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return parts[0]!;
  return quad && parts.length === 4 ? (parts as Quad) : null;
}

export function PartFields({ options, children }: { options: PartsPluginOptions; children: ReactNode }) {
  const getPuck = useGetPuck();
  const selected = usePuck((s) => s.selectedItem) as Selected;
  const config = usePuck((s) => s.config);
  const sel = usePartSelection();
  // Closing the panel ends a spell, whichever way it closes.
  useEffect(() => () => endSpell(), []);

  if (!selected || !sel || sel.id !== selected.props.id || !partsOf(options.contract, selected.type)) return <>{children}</>;

  const { look: helpers, contract, rootLabel = "Whole block" } = options;
  const doc = canvasDocument();
  const drawn = doc ? drawnParts(doc, sel.id, selected.type, contract, rootLabel) : [];
  const declared = partsOf(contract, selected.type) ?? {};
  const label = drawn.find((p) => p.part === sel.part)?.label ?? (sel.part === ROOT_PART ? rootLabel : declared[sel.part]?.label ?? sel.part);
  const blockLabel = (config.components[selected.type] as { label?: string } | undefined)?.label ?? selected.type;
  const look = helpers.partLookOf(selected.props, sel.part);
  const computed = computedOf(drawn.find((p) => p.part === sel.part)?.els[0]);
  const { id, part } = sel;

  if (options.panel) {
    const ctx: PartPanelContext = {
      id,
      type: selected.type,
      part,
      block: options.contract[selected.type] ?? {},
      blockLabel,
      props: selected.props,
      parts: drawn,
      developer: !!options.developer,
      live: (edit) => writeLive(getPuck, id, edit),
      commit: (edit) => {
        writeLive(getPuck, id, edit);
        endSpell();
      },
      endSpell,
      revert: revertSpell,
      select: (name) => {
        endSpell();
        selectPart(name ? { id, part: name } : null);
        if (name) drawn.find((p) => p.part === name)?.els[0]?.scrollIntoView({ block: "nearest" });
      },
      hover: hoverPart,
    };
    return (
      <div className="eac-parts-host">
        <div className="eac-parts-bar eac-parts-bar-pad">
          <button type="button" className="eac-parts-back" data-eac-part-back="" onClick={() => (endSpell(), selectPart(null))} title="Back to this block's settings (Esc from the outermost part)">
            ← Block settings
          </button>
        </div>
        <InjectedPanel mount={options.panel} ctx={ctx} />
      </div>
    );
  }

  const edit = (key: Key, value: unknown) => (props: Record<string, unknown>) => {
    const next = { ...helpers.partLookOf(props, part) } as Record<string, unknown>;
    if (value === undefined || value === "" || value === false) delete next[key];
    else next[key] = value;
    helpers.setPartLook(props, part, next as PartLook);
  };
  const live = (key: Key, value: unknown) => writeLive(getPuck, id, edit(key, value));
  const step = (key: Key, value: unknown) => writeStep(getPuck, id, edit(key, value));
  const pick = (name: string) => {
    endSpell();
    selectPart({ id, part: name });
    drawn.find((p) => p.part === name)?.els[0]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="eac-parts" data-eac-part-panel="">
      <div className="eac-parts-bar">
        <button type="button" className="eac-parts-back" data-eac-part-back="" onClick={() => (endSpell(), selectPart(null))} title="Back to this block's settings (Esc)">
          ← Block settings
        </button>
      </div>
      <div className="eac-parts-head">
        <p className="eac-parts-title">{label}</p>
        <p className="eac-parts-sub">Part of {blockLabel}. This page only.</p>
      </div>
      <div className="eac-parts-chips" role="group" aria-label="Parts of this block">
        {drawn.map((p) => (
          <button key={p.part} type="button" className="eac-parts-chip" data-eac-part-chip={p.part} aria-pressed={p.part === part} onClick={() => pick(p.part)}>
            {p.label}
            {p.els.length > 1 ? <span className="eac-parts-count"> ×{p.els.length}</span> : null}
          </button>
        ))}
      </div>

      <Section title="Text">
        <ColorRow label="Colour" k="color" look={look} computed={computed} live={live} />
        <TextRow label="Size" k="size" unit="px" look={look} computed={computed} live={live} />
        <SelectRow label="Weight" k="weight" look={look} computed={computed} step={step} options={WEIGHTS} names={WEIGHT_NAMES} numeric />
        <ChipsRow label="Capitals" k="case" look={look} step={step} options={CASES} />
        <TextRow label="Letter spacing" k="tracking" unit="em" look={look} computed={computed} live={live} />
      </Section>
      <Section title="Box">
        <ColorRow label="Fill" k="fill" look={look} computed={computed} live={live} />
        <TextRow label="Space inside" k="padding" unit="px" quad look={look} computed={computed} live={live} />
        <TextRow label="Corners" k="radius" unit="px" quad look={look} computed={computed} live={live} />
        <TextRow label="Opacity" k="opacity" unit="0–1" look={look} computed={computed} live={live} />
        <label className="eac-parts-row eac-parts-switch">
          <span className="eac-parts-label">Hide on the page</span>
          <input type="checkbox" data-eac-part-ctl="hide" checked={!!look.hide} onChange={(e) => step("hide", e.target.checked)} />
        </label>
      </Section>
      <Section title="Line">
        <SelectRow label="Style" k="bstyle" look={look} computed={computed} step={step} options={LINES} names={LINE_NAMES} />
        <ColorRow label="Colour" k="bcolor" look={look} computed={computed} live={live} />
        <TextRow label="Width" k="bwidth" unit="px" look={look} computed={computed} live={live} />
      </Section>
      {options.developer ? (
        <Section title="CSS">
          <CssBox look={look} live={live} kept={helpers.partSafeDecls} />
        </Section>
      ) : null}

      <div className="eac-parts-foot">
        <button type="button" className="eac-parts-reset" data-eac-part-reset="" disabled={!Object.keys(look).length} onClick={() => writeStep(getPuck, id, (props) => helpers.setPartLook(props, part, {}))}>
          Reset this part
        </button>
      </div>
    </div>
  );
}

/** A panel from another package, mounted once and given the selection on every render. */
function InjectedPanel({ mount, ctx }: { mount: PartPanelMount; ctx: PartPanelContext }) {
  const el = useRef<HTMLDivElement>(null);
  const handle = useRef<PartPanelHandle | null>(null);
  useEffect(() => {
    handle.current = el.current ? mount(el.current) : null;
    return () => {
      handle.current?.destroy();
      handle.current = null;
      hoverPart(null);
    };
  }, [mount]);
  // After every render, so the panel reads the canvas as just drawn.
  useEffect(() => {
    handle.current?.render(ctx);
  });
  return <div ref={el} className="eac-look-panel" data-eac-look-panel="" />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="eac-parts-section">
      <h3 className="eac-parts-section-title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A typed field's text while it has focus: kept locally so a redraw does not
 * move the caret, dropped when the stored value changes from outside (Puck's
 * undo) and no spell is open.
 */
function useDraft(stored: string) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (draft !== null && !spellPending()) setDraft(null);
    // Only a change of the stored value can make the draft stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);
  const keys = (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "z" && spellPending()) {
      // Undo inside a field while typing puts the spell back; Puck's undo would skip it.
      e.preventDefault();
      e.stopPropagation();
      revertSpell();
      setDraft(null);
    } else if (e.key === "Enter" && e.currentTarget.tagName === "INPUT") {
      endSpell();
      setDraft(null);
    }
  };
  return { value: draft ?? stored, set: setDraft, end: () => (endSpell(), setDraft(null)), keys };
}

function TextRow({ label, k, unit, quad = false, look, computed, live }: { label: string; k: Key; unit?: string; quad?: boolean; look: PartLook; computed: Partial<Record<Key, string>>; live: (k: Key, v: unknown) => void }) {
  const d = useDraft(shown(look[k]));
  return (
    <label className="eac-parts-row">
      <span className="eac-parts-label">{label}</span>
      <span className="eac-parts-input">
        <input
          type="text"
          inputMode="decimal"
          data-eac-part-ctl={k}
          value={d.value}
          placeholder={computed[k] ?? ""}
          onChange={(e) => {
            d.set(e.target.value);
            const v = parseNumber(e.target.value, quad);
            if (v !== null) live(k, v);
          }}
          onBlur={d.end}
          onKeyDown={d.keys}
        />
        {unit ? <span className="eac-parts-unit">{unit}</span> : null}
      </span>
    </label>
  );
}

function ColorRow({ label, k, look, computed, live }: { label: string; k: Key; look: PartLook; computed: Partial<Record<Key, string>>; live: (k: Key, v: unknown) => void }) {
  const stored = shown(look[k]);
  const d = useDraft(stored);
  const swatch = HEX.test(stored) && stored.length === 7 ? stored : computed[k] && HEX.test(computed[k]!) ? computed[k]! : "#000000";
  return (
    <label className="eac-parts-row">
      <span className="eac-parts-label">{label}</span>
      <span className="eac-parts-input eac-parts-color">
        <input
          type="color"
          aria-label={`${label}: pick`}
          data-eac-part-swatch={k}
          value={swatch}
          onChange={(e) => live(k, e.target.value)}
          onBlur={() => endSpell()}
        />
        <input
          type="text"
          data-eac-part-ctl={k}
          value={d.value}
          placeholder={computed[k] ?? "#rrggbb"}
          spellCheck={false}
          onChange={(e) => {
            d.set(e.target.value);
            const v = e.target.value.trim();
            if (!v || HEX.test(v)) live(k, v || undefined);
          }}
          onBlur={d.end}
          onKeyDown={d.keys}
        />
      </span>
    </label>
  );
}

function SelectRow({ label, k, look, computed, step, options, names, numeric = false }: { label: string; k: Key; look: PartLook; computed: Partial<Record<Key, string>>; step: (k: Key, v: unknown) => void; options: string[]; names: Record<string, string>; numeric?: boolean }) {
  const fallback = computed[k] && names[computed[k]!] ? ` (${names[computed[k]!]})` : "";
  return (
    <label className="eac-parts-row">
      <span className="eac-parts-label">{label}</span>
      <span className="eac-parts-input">
        <select data-eac-part-ctl={k} value={shown(look[k])} onChange={(e) => step(k, e.target.value === "" ? undefined : numeric ? Number(e.target.value) : e.target.value)}>
          <option value="">As designed{fallback}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {names[o] ?? o}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function ChipsRow({ label, k, look, step, options }: { label: string; k: Key; look: PartLook; step: (k: Key, v: unknown) => void; options: Array<[string | undefined, string]> }) {
  return (
    <div className="eac-parts-row">
      <span className="eac-parts-label">{label}</span>
      <span className="eac-parts-choices" role="group" aria-label={label}>
        {options.map(([value, name]) => (
          <button key={name} type="button" data-eac-part-choice={`${k}:${value ?? ""}`} aria-pressed={look[k] === value} onClick={() => step(k, value)}>
            {name}
          </button>
        ))}
      </span>
    </div>
  );
}

/** Declarations typed for this part, and which of them the stylesheet keeps. */
function CssBox({ look, live, kept }: { look: PartLook; live: (k: Key, v: unknown) => void; kept: (css: string | undefined) => Array<[string, string]> }) {
  const d = useDraft(look.css ?? "");
  const text = d.value;
  const keep = kept(text);
  const keepSet = new Set(keep.map(([p, v]) => `${p}:${v}`));
  const refused = text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((line) => {
      const i = line.indexOf(":");
      return i < 0 || !keepSet.has(`${line.slice(0, i).trim().toLowerCase()}:${line.slice(i + 1).trim()}`);
    });
  return (
    <div className="eac-parts-css">
      <textarea
        data-eac-part-ctl="css"
        rows={4}
        spellCheck={false}
        placeholder="letter-spacing: .02em; text-decoration: underline"
        value={text}
        onChange={(e) => {
          d.set(e.target.value);
          live("css", e.target.value.trim() ? e.target.value : undefined);
        }}
        onBlur={d.end}
        onKeyDown={d.keys}
      />
      {keep.length ? (
        <p className="eac-parts-kept" data-eac-part-kept="">
          Kept: {keep.map(([p, v]) => `${p}: ${v}`).join("; ")}
        </p>
      ) : null}
      {refused.length ? (
        <p className="eac-parts-refused" data-eac-part-refused="">
          Not kept: {refused.join("; ")}
        </p>
      ) : null}
    </div>
  );
}
