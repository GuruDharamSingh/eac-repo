"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import type { CssVarDef, SaveResult } from "./types";

interface Props {
  cssVars: CssVarDef[];
  initialOverrides: Record<string, string>;
  onSave: (overrides: Record<string, string>) => Promise<SaveResult>;
  onClose: () => void;
}

/** Generic CSS custom property editor. Previews live via injected <style> tag. */
export function CssPanel({ cssVars, initialOverrides, onSave, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cssVars.map((v) => [v.name, initialOverrides[v.name] ?? v.default]))
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inject live preview <style> tag
  useEffect(() => {
    let tag = document.getElementById("lve-theme-preview") as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "lve-theme-preview";
      document.head.appendChild(tag);
    }
    styleRef.current = tag;
  }, []);

  useEffect(() => {
    if (!styleRef.current) return;
    const css = Object.entries(values).map(([k, v]) => `  ${k}: ${v};`).join("\n");
    styleRef.current.textContent = `:root {\n${css}\n}`;
  }, [values]);

  // Outside click → close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await onSave(values);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: 68,
        left: "50%",
        transform: "translateX(-50%)",
        width: 300,
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
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>Page Styles</span>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      {/* Var rows */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {cssVars.map((v) => (
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

      {/* Footer */}
      <div style={panelFooter}>
        {error && <span style={{ fontSize: 11, color: "#f87171", marginRight: "auto" }}>{error}</span>}
        <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{ ...saveBtnStyle, background: saved ? "rgba(34,197,94,0.9)" : "rgba(99,102,241,0.9)" }}
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save styles"}
        </button>
      </div>
    </div>
  );
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
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ width: 36, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: 4 }} />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={textInput} />
        </div>
      ) : (
        <div>
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={def.default} style={textInput} />
          {def.hint && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, lineHeight: 1.4 }}>{def.hint}</div>
          )}
        </div>
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
