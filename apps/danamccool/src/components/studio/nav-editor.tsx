"use client";

import { useState } from "react";
import type { NavItem } from "@/lib/navigation";

/**
 * Arranging the site's navigation.
 *
 * Plain up/down buttons rather than drag-and-drop, and that is a choice: a
 * list of eleven links is reordered perfectly well by keyboard, every assistive
 * technology understands a button, and the one place on this site that needed
 * real dragging — moving a picture through text — already has it.
 */
export function NavEditor({
  initial,
  candidates,
  onSave,
}: {
  initial: NavItem[];
  candidates: NavItem[];
  onSave: (items: NavItem[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [items, setItems] = useState<NavItem[]>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const present = new Set(items.map((i) => i.href));
  const unused = candidates.filter((c) => !present.has(c.href));

  function move(index: number, by: number) {
    const next = [...items];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await onSave(items);
    setSaving(false);
    setStatus(res.ok ? "Saved. The sidebar shows it now." : res.error ?? "Could not save.");
  }

  const cell: React.CSSProperties = { padding: ".35rem .4rem" };
  const btn: React.CSSProperties = {
    font: "inherit",
    cursor: "pointer",
    border: "1px solid currentColor",
    background: "transparent",
    padding: ".15rem .5rem",
    lineHeight: 1.4,
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
        <thead>
          <tr style={{ textAlign: "left", fontSize: ".8rem" }}>
            <th style={cell}>Label</th>
            <th style={cell}>Goes to</th>
            <th style={cell} />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={`${item.href}-${i}`} style={{ borderTop: "1px solid currentColor" }}>
              <td style={cell}>
                <input
                  value={item.label}
                  onChange={(e) =>
                    setItems((list) =>
                      list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                    )
                  }
                  style={{ font: "inherit", width: "100%", padding: ".2rem .3rem" }}
                  aria-label={`Label for ${item.href}`}
                />
              </td>
              <td style={cell}>
                <input
                  value={item.href}
                  onChange={(e) =>
                    setItems((list) =>
                      list.map((x, j) => (j === i ? { ...x, href: e.target.value } : x))
                    )
                  }
                  spellCheck={false}
                  style={{ font: "inherit", fontFamily: "monospace", width: "100%", padding: ".2rem .3rem" }}
                  aria-label={`Address for ${item.label}`}
                />
              </td>
              <td style={{ ...cell, whiteSpace: "nowrap", textAlign: "right" }}>
                <button type="button" style={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${item.label} up`}>↑</button>{" "}
                <button type="button" style={btn} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${item.label} down`}>↓</button>{" "}
                <button type="button" style={btn} onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${item.label}`}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {unused.length > 0 ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 .5rem" }}>Pages not in the navigation</h2>
          <p style={{ fontSize: ".85rem", margin: "0 0 .6rem" }}>
            Pages you have published in the editor. Publishing one does not add
            it here on its own — a link to something half-finished is worse than
            no link.
          </p>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {unused.map((c) => (
              <button
                key={c.href}
                type="button"
                style={btn}
                onClick={() => setItems((l) => [...l, c])}
              >
                + {c.label} <span style={{ opacity: 0.7, fontFamily: "monospace" }}>{c.href}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" style={{ ...btn, fontWeight: 600, padding: ".55rem 1.2rem" }} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save navigation"}
      </button>
      {status ? <p style={{ marginTop: ".6rem", fontSize: ".85rem" }}>{status}</p> : null}
    </div>
  );
}
