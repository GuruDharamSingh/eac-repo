"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import type { CssVarDef, SaveResult } from "./types";
import { setPreviewVars } from "./preview";

interface Props {
  cssVars: CssVarDef[];
  /** The scope's saved overrides, unmerged — ALL of them, even when `only` narrows the panel. */
  initialOverrides: Record<string, string>;
  onSave: (overrides: Record<string, string>) => Promise<SaveResult>;
  onClose: () => void;
  /**
   * Show just these variables (a section's pin). The save still writes the
   * whole override set: the narrowed variables merged over `initialOverrides`,
   * so a pin on the gallery never erases a colour saved from the sidebar.
   */
  only?: string[];
  title?: string;
  /** Page coordinates to anchor near (a pin). Omitted → fixed at the bottom centre. */
  anchor?: { x: number; y: number };
  /** Fired after a successful save with the full override set now in force. */
  onApplied?: (overrides: Record<string, string>) => void;
}

const WIDTH = 300;
const MARGIN = 12;

/**
 * Generic CSS custom property editor. Previews live through the shared
 * preview tag (see preview.ts); saves only the variables that differ from
 * the app default, so an untouched variable keeps inheriting — if the site
 * palette changes later, this scope follows it instead of being pinned to
 * today's colours.
 */
export function CssPanel({ cssVars, initialOverrides, onSave, onClose, only, title, anchor, onApplied }: Props) {
  const visible = useMemo(
    () => (only ? cssVars.filter((v) => only.includes(v.name)) : cssVars),
    [cssVars, only]
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(visible.map((v) => [v.name, initialOverrides[v.name] ?? v.default]))
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // What the page should show if this panel is dismissed without saving.
  const committedRef = useRef<Record<string, string>>(
    Object.fromEntries(visible.map((v) => [v.name, initialOverrides[v.name] ?? v.default]))
  );

  useEffect(() => {
    setPreviewVars(values);
  }, [values]);

  // Unmount without save → put back whatever was last committed.
  useEffect(() => {
    return () => {
      setPreviewVars(committedRef.current);
    };
  }, []);

  // Outside click → close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  /** The full set to persist: everything saved before, with this panel's variables merged over it. */
  function merged(next: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = { ...initialOverrides };
    for (const v of visible) {
      const val = next[v.name];
      if (val === undefined || val === v.default) delete out[v.name];
      else out[v.name] = val;
    }
    return out;
  }

  function persist(next: Record<string, string>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const full = merged(next);
      const result = await onSave(full);
      if (!result.ok) {
        setError(result.error ?? "Could not save");
        return;
      }
      committedRef.current = { ...next };
      onApplied?.(full);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  /**
   * Back to how it looks with no override at all for these variables.
   *
   * Removes them from the saved set rather than saving each at its default
   * value. Those look identical today but are not the same thing: a removed
   * key genuinely inherits, so if the site palette changes later this scope
   * follows it instead of being pinned to today's colours.
   */
  function handleResetAll() {
    const defaults = Object.fromEntries(visible.map((v) => [v.name, v.default]));
    setValues(defaults);
    persist(defaults);
  }

  const isDirtyOverall = visible.some((v) => values[v.name] !== v.default);

  const groups = useMemo(() => {
    const out: Array<{ group: string | undefined; vars: CssVarDef[] }> = [];
    for (const v of visible) {
      const last = out[out.length - 1];
      if (last && last.group === v.group) last.vars.push(v);
      else out.push({ group: v.group, vars: [v] });
    }
    return out;
  }, [visible]);

  const position: React.CSSProperties = anchor
    ? {
        position: "absolute",
        top: anchor.y,
        left: Math.max(MARGIN, Math.min(anchor.x, window.innerWidth + window.scrollX - WIDTH - MARGIN)),
      }
    : { position: "fixed", bottom: 68, left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      ref={panelRef}
      style={{
        ...position,
        width: WIDTH,
        background: "rgba(15,23,42,0.98)",
        border: "0.5px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        zIndex: 9999,
        fontFamily: "system-ui, sans-serif",
        color: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={panelHeader}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>{title ?? "Page Styles"}</span>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      {/* Var rows */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto" }}>
        {visible.length === 0 && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Nothing here can be styled.</div>
        )}
        {groups.map((g, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {g.group && groups.length > 1 && <div style={groupHeading}>{g.group}</div>}
            {g.vars.map((v) => (
              <VarRow
                key={v.name}
                def={v}
                value={values[v.name] ?? v.default}
                onChange={(val) => setValues((prev) => ({ ...prev, [v.name]: val }))}
                onReset={() => setValues((prev) => ({ ...prev, [v.name]: v.default }))}
                isDirty={values[v.name] !== v.default}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={panelFooter}>
        {error && <span style={{ fontSize: 11, color: "#f87171", marginRight: "auto" }}>{error}</span>}
        <button
          type="button"
          onClick={handleResetAll}
          disabled={isPending || !isDirtyOverall}
          title="Clear these overrides and go back to the default look"
          style={{
            ...cancelBtnStyle,
            marginRight: "auto",
            opacity: isDirtyOverall ? 1 : 0.4,
            cursor: isDirtyOverall ? "pointer" : "default",
          }}
        >
          Reset
        </button>
        <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
        <button
          type="button"
          onClick={() => persist(values)}
          disabled={isPending}
          style={{ ...saveBtnStyle, background: saved ? "rgba(34,197,94,0.9)" : "rgba(99,102,241,0.9)" }}
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

/** "2px" → 2; anything unparsable → the def's min or 0. */
function lengthNumber(value: string, def: CssVarDef): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : def.min ?? 0;
}

function VarRow({
  def,
  value,
  onChange,
  onReset,
  isDirty,
}: {
  def: CssVarDef;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  isDirty: boolean;
}) {
  const unit = def.unit ?? "px";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{def.label}</label>
        {isDirty && (
          <button type="button" onClick={onReset}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 10, cursor: "pointer", padding: "1px 4px" }}>
            reset
          </button>
        )}
      </div>

      {def.type === "color" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)}
            style={{ width: 36, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: 4 }} />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={textInput} />
        </div>
      ) : def.type === "length" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="range"
            min={def.min ?? 0}
            max={def.max ?? 20}
            step={def.step ?? 1}
            value={lengthNumber(value, def)}
            onChange={(e) => onChange(`${e.target.value}${unit}`)}
            style={{ flex: 1, accentColor: "rgb(99,102,241)" }}
          />
          <input
            type="number"
            min={def.min ?? 0}
            max={def.max ?? 20}
            step={def.step ?? 1}
            value={lengthNumber(value, def)}
            onChange={(e) => onChange(`${e.target.value}${unit}`)}
            style={{ ...textInput, width: 64 }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", minWidth: 18 }}>{unit}</span>
        </div>
      ) : def.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...textInput, fontFamily: "inherit" }}>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value} style={{ color: "#111" }}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={def.default} style={textInput} />
      )}
      {def.hint && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, lineHeight: 1.4 }}>{def.hint}</div>
      )}
    </div>
  );
}

const textInput: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "0.5px solid rgba(255,255,255,0.18)",
  borderRadius: 6,
  color: "rgba(255,255,255,0.9)",
  fontSize: 12,
  padding: "6px 9px",
  outline: "none",
  fontFamily: "monospace",
  boxSizing: "border-box",
};

const groupHeading: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  borderBottom: "0.5px solid rgba(255,255,255,0.1)",
  paddingBottom: 4,
};

const panelHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "11px 14px 10px",
  borderBottom: "0.5px solid rgba(255,255,255,0.1)",
};

const panelFooter: React.CSSProperties = {
  padding: "10px 14px 12px",
  borderTop: "0.5px solid rgba(255,255,255,0.1)",
  display: "flex", gap: 8, justifyContent: "flex-end",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "rgba(255,255,255,0.4)",
  cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1,
};

const cancelBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 12,
  padding: "5px 12px", cursor: "pointer", fontFamily: "inherit",
};

const saveBtnStyle: React.CSSProperties = {
  border: "none", borderRadius: 6, color: "#fff", fontSize: 12,
  fontWeight: 600, padding: "5px 14px", cursor: "pointer",
  fontFamily: "inherit", transition: "background 0.2s",
};
