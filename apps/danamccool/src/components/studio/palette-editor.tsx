"use client";

import { useMemo, useState } from "react";
import { PALETTE_ROLES, type Palette } from "@/lib/theme";

// ============================================================================
// Choosing the site's colours — with the measurements in front of you.
//
// The reason this exists rather than a colour picker: every palette decision
// on this network has been a contrast decision in disguise, and the mistake is
// always the same shape — a colour chosen as a background, then used as text
// on itself. So the pairs the harvested sections actually put together are
// measured live, and a failing pair says so while it is still a choice.
//
// The thresholds are WCAG's: 4.5:1 for body text, 3:1 for large text and for
// the boundary of a control. They are not opinions and they are not rounded in
// our favour.
// ============================================================================

function channel(v: number) {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi! + 0.05) / (lo! + 0.05)) * 100) / 100;
}

/** The pairs the kits actually render, and what each one has to clear. */
const CHECKS: { label: string; fg: string; bg: string; min: number; note: string }[] = [
  { label: "Heading on the page", fg: "ink", bg: "page", min: 3, note: "large text" },
  { label: "Body text on the page", fg: "body", bg: "page", min: 4.5, note: "" },
  { label: "Body text on the soft ground", fg: "body", bg: "soft", min: 4.5, note: "" },
  { label: "The emphasised word", fg: "accent", bg: "page", min: 4.5, note: "accent used as text" },
  { label: "Button label on the accent", fg: "page", bg: "accent", min: 4.5, note: "the kit puts white here" },
  { label: "Card edges on the page", fg: "line", bg: "page", min: 3, note: "a boundary, not text" },
];

export function PaletteEditor({
  initial,
  onSave,
}: {
  initial: Palette;
  onSave: (palette: Palette) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [palette, setPalette] = useState<Palette>(() => {
    const seeded: Palette = {};
    for (const role of PALETTE_ROLES) seeded[role.key] = initial[role.key] ?? role.fallback;
    return seeded;
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The same variables the server writes, applied to the preview only — so
  // what is on screen here is what the page will do, without saving first.
  const previewVars = useMemo(() => {
    const style: Record<string, string> = {};
    for (const role of PALETTE_ROLES) {
      for (const name of role.vars) style[name] = palette[role.key] ?? role.fallback;
    }
    return style as React.CSSProperties;
  }, [palette]);

  const results = CHECKS.map((c) => {
    const ratio = contrast(palette[c.fg] ?? "#000000", palette[c.bg] ?? "#ffffff");
    return { ...c, ratio, passes: ratio >= c.min };
  });
  const failing = results.filter((r) => !r.passes).length;

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await onSave(palette);
    setSaving(false);
    setStatus(res.ok ? "Saved. Every page uses it now." : res.error ?? "Could not save.");
  }

  return (
    <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "minmax(260px, 20rem) 1fr", alignItems: "start" }}>
      <div>
        <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>Colours</h2>
        {PALETTE_ROLES.map((role) => (
          <label key={role.key} style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: ".9rem" }}>{role.label}</span>
            <span style={{ display: "block", fontSize: ".78rem", opacity: 0.8, marginBottom: ".3rem" }}>
              {role.hint}
            </span>
            <span style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
              <input
                type="color"
                value={palette[role.key] ?? role.fallback}
                onChange={(e) => setPalette((p) => ({ ...p, [role.key]: e.target.value }))}
                style={{ width: 44, height: 32, padding: 0, border: "1px solid currentColor", background: "none" }}
                aria-label={role.label}
              />
              {/* Typed as well as picked: a brand colour arrives as a hex code,
                  and a colour well cannot be pasted into. */}
              <input
                type="text"
                value={palette[role.key] ?? role.fallback}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPalette((p) => ({ ...p, [role.key]: v }));
                }}
                spellCheck={false}
                style={{ width: "6.5rem", font: "inherit", fontFamily: "monospace", padding: ".25rem .4rem" }}
                aria-label={`${role.label}, hex code`}
              />
            </span>
            <span style={{ display: "block", fontSize: ".7rem", opacity: 0.6, marginTop: ".2rem", fontFamily: "monospace" }}>
              {role.vars.join("  ")}
            </span>
          </label>
        ))}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ font: "inherit", fontWeight: 600, padding: ".55rem 1.2rem", cursor: "pointer", border: "1px solid currentColor", background: "transparent" }}
        >
          {saving ? "Saving…" : "Save palette"}
        </button>
        {status ? <p style={{ marginTop: ".6rem", fontSize: ".85rem" }}>{status}</p> : null}
      </div>

      <div>
        <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>
          Contrast{failing ? ` — ${failing} to fix` : " — all clear"}
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem", marginBottom: "2rem" }}>
          <tbody>
            {results.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid currentColor" }}>
                <td style={{ padding: ".4rem .5rem .4rem 0" }}>
                  {r.label}
                  {r.note ? <span style={{ opacity: 0.7 }}> — {r.note}</span> : null}
                </td>
                <td style={{ padding: ".4rem 0", textAlign: "right", fontFamily: "monospace" }}>
                  {r.ratio.toFixed(2)}:1
                </td>
                <td style={{ padding: ".4rem 0 .4rem .75rem", textAlign: "right", fontWeight: 600 }}>
                  {/* Never colour alone: the word carries the verdict for
                      anyone who cannot tell the two apart. */}
                  {r.passes ? `passes ${r.min}` : `FAILS ${r.min}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>Preview</h2>
        {/* The kits' own class names, so this is the real thing rather than a
            drawing of it. */}
        <div style={previewVars}>
          <section className="bg-white">
            <div className="mx-auto max-w-prose px-6 py-12 text-center">
              <h1 className="text-3xl font-bold text-gray-900">
                A heading with an
                <strong className="text-indigo-600"> emphasised </strong>
                word
              </h1>
              <p className="mt-4 text-pretty text-gray-700">
                Running text under the heading, at the size a paragraph is set.
              </p>
              <div className="mt-5 flex justify-center gap-4">
                <a className="inline-block rounded border border-indigo-600 bg-indigo-600 px-5 py-3 font-medium text-white" href="#">
                  A button
                </a>
                <a className="inline-block rounded border border-gray-200 px-5 py-3 font-medium text-gray-700" href="#">
                  And another
                </a>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 text-left">
                <div className="rounded-lg border border-gray-200 p-5">
                  <div className="inline-flex rounded-lg bg-gray-100 p-3 text-gray-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                    </svg>
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900">A card</h3>
                  <p className="mt-1 text-gray-700">With a line of text in it.</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900">Another</h3>
                  <p className="mt-1 text-gray-700">So the edges can be judged.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
