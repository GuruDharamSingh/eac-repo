"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Edit in place: click, type, Enter or blur saves, Esc cancels.
 * When `editable` is false it is plain text. The dashed underline is the cue.
 */
export function Field({
  value, onSave, editable, placeholder = "Click to write", multiline = false, className = "", as: Tag = "span", label,
}: {
  value: string | undefined; onSave: (v: string) => void; editable: boolean; placeholder?: string;
  multiline?: boolean; className?: string; as?: "span" | "div" | "h1" | "h2" | "p"; label?: string;
}) {
  const [on, setOn] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cancelled = useRef(false);

  useEffect(() => { if (!on) setDraft(value ?? ""); }, [value, on]);
  useEffect(() => { if (on) ref.current?.focus(); }, [on]);

  if (!editable) {
    return <Tag className={className}>{value || ""}</Tag>;
  }
  if (!on) {
    return (
      <Tag
        className={`${className} ws-field`} role="button" tabIndex={0} aria-label={label ? `Edit ${label}` : "Edit"}
        onClick={() => { cancelled.current = false; setOn(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cancelled.current = false; setOn(true); } }}
      >
        {value ? value : <span className="ws-placeholder">{placeholder}</span>}
      </Tag>
    );
  }
  const finish = () => {
    if (!cancelled.current && draft !== (value ?? "")) onSave(draft);
    setOn(false);
  };
  const common = {
    ref, value: draft, className: `${className} ws-input`, "aria-label": label,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: finish,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { cancelled.current = true; setDraft(value ?? ""); (e.target as HTMLElement).blur(); }
      else if (e.key === "Enter" && !(multiline && e.shiftKey)) { e.preventDefault(); (e.target as HTMLElement).blur(); }
    },
  };
  return multiline ? <textarea {...common} rows={4} /> : <input {...common} type="text" />;
}

/** Text colour (white or near black) that reads best on a hex background, with its contrast ratio. */
export function readable(hex: string): { ink: string; ratio: number } {
  const lum = (h: string) => {
    const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const L = lum(hex);
  const white = 1.05 / (L + 0.05);
  const dark = (L + 0.05) / (lum("#111111") + 0.05);
  return white >= dark ? { ink: "#ffffff", ratio: white } : { ink: "#111111", ratio: dark };
}
