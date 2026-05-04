"use client";

import { useRef, useEffect, useState, useTransition } from "react";
import type { FieldDef, SaveFieldPayload, SaveResult } from "./types";

interface Props {
  def: FieldDef;
  rect: DOMRect;
  onSave: (payload: SaveFieldPayload) => Promise<SaveResult>;
  onClose: () => void;
}

const WIDTH = 320;
const MARGIN = 12;

export function FieldPopover({ def, rect, onSave, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // For compound fields, initialise from each sub-field's initialValue
  const initValues = (): Record<string, string> => {
    if (def.input === "compound" && def.compound) {
      return Object.fromEntries(
        def.compound.map((f) => [f.key, f.initialValue ?? ""])
      );
    }
    return { [def.trait]: def.initialValue ?? "" };
  };

  const [values, setValues] = useState<Record<string, string>>(initValues);

  // Position below element, clamped to viewport right edge
  const x = Math.min(
    rect.left + window.scrollX,
    window.innerWidth + window.scrollX - WIDTH - MARGIN
  );
  const y = rect.top + window.scrollY + rect.height + 8;

  // Outside click → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSave() {
    setError(null);
    setSaved(false);

    const payload: SaveFieldPayload =
      def.input === "compound"
        ? { trait: def.trait, value: values }
        : { trait: def.trait, value: values[def.trait] ?? "" };

    startTransition(async () => {
      const result = await onSave(payload);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => onClose(), 700);
      }
    });
  }

  // Build input rows — compound has multiple, simple has one
  const rows =
    def.input === "compound" && def.compound
      ? def.compound.map((f) => ({
          key: f.key,
          label: f.label,
          input: f.input as FieldDef["input"],
          options: undefined as FieldDef["options"],
        }))
      : [
          {
            key: def.trait,
            label: def.label,
            input: def.input,
            options: def.options,
          },
        ];

  const showLabel = rows.length > 1;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: y,
        left: x,
        width: WIDTH,
        background: "rgba(15,23,42,0.98)",
        border: "0.5px solid rgba(255,255,255,0.14)",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        zIndex: 9999,
        fontFamily: "system-ui, sans-serif",
        color: "rgba(255,255,255,0.9)",
        padding: "14px 16px 12px",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{def.label}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            data-trait="{def.trait}"
          </div>
        </div>
        <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
      </div>

      {/* Inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ key, label, input, options }) => (
          <div key={key}>
            {showLabel && (
              <label htmlFor={`lve-${key}`} style={labelStyle}>{label}</label>
            )}
            <FieldInput
              id={`lve-${key}`}
              inputType={input}
              value={values[key] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
              options={options}
            />
          </div>
        ))}
      </div>

      {/* Hint */}
      {def.hint && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 8, lineHeight: 1.45 }}>
          {def.hint}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: "#f87171", marginTop: 8 }}>{error}</div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{ ...saveBtnStyle, background: saved ? "rgba(34,197,94,0.9)" : "rgba(99,102,241,0.9)" }}
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Generic field input ──────────────────────────────────────────────────────

function FieldInput({
  id,
  inputType,
  value,
  onChange,
  options,
}: {
  id: string;
  inputType: FieldDef["input"];
  value: string;
  onChange: (v: string) => void;
  options?: FieldDef["options"];
}) {
  if (inputType === "select" && options) {
    return (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ ...inputBase, appearance: "auto" as React.CSSProperties["appearance"] }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (inputType === "textarea") {
    return (
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)}
        rows={4} style={{ ...inputBase, resize: "vertical", minHeight: 80 }} />
    );
  }
  if (inputType === "image") {
    return (
      <div>
        <input id={id} type="url" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://..." style={inputBase} />
        {value && (
          <img src={value} alt="preview"
            style={{ marginTop: 6, width: 72, height: 72, objectFit: "cover", borderRadius: 4, border: "0.5px solid rgba(255,255,255,0.1)" }} />
        )}
      </div>
    );
  }
  if (inputType === "number") {
    return <input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} style={inputBase} />;
  }
  if (inputType === "datetime") {
    return <input id={id} type="datetime-local" value={value ? value.slice(0, 16) : ""} onChange={(e) => onChange(e.target.value)} style={inputBase} />;
  }
  if (inputType === "date") {
    return <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} style={inputBase} />;
  }
  return (
    <input id={id} type={inputType === "url" ? "url" : "text"} value={value}
      onChange={(e) => onChange(e.target.value)} style={inputBase} />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "0.5px solid rgba(255,255,255,0.18)",
  borderRadius: 6,
  color: "rgba(255,255,255,0.9)",
  fontSize: 13,
  padding: "7px 10px",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 4,
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
