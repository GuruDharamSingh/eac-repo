"use client";

import { useState } from "react";
import type { NavItem } from "@/lib/navigation";

/**
 * Arranging the site's navigation — its titles, order and addresses.
 *
 * Plain up/down buttons rather than drag-and-drop, and that is a choice: a
 * list of sixteen links is reordered perfectly well by keyboard, and every
 * assistive technology understands a button.
 *
 * One card per link rather than a table, so the same editor fits the full
 * /studio/navigation page and the page editor's narrow Menu tab. How the menu
 * LOOKS (colours, font, size) is the theme's — see /studio/theme.
 */
export function NavEditor({
  initial,
  candidates,
  onSave,
  current,
}: {
  initial: NavItem[];
  candidates: NavItem[];
  onSave: (items: NavItem[]) => Promise<{ ok: boolean; error?: string }>;
  /** The page being edited, offered first when it is not in the menu yet. */
  current?: NavItem;
}) {
  const [saved, setSaved] = useState<NavItem[]>(initial);
  const [items, setItems] = useState<NavItem[]>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fresh, setFresh] = useState({ label: "", href: "" });

  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const present = new Set(items.map((i) => i.href));
  const unused = candidates.filter((c) => !present.has(c.href) && c.href !== current?.href);

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
  }
  const edit = (i: number, patch: Partial<NavItem>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await onSave(items);
    setSaving(false);
    if (res.ok) setSaved(items);
    setStatus(res.ok ? "Saved. The menu shows it on every page now." : (res.error ?? "Could not save."));
  }

  return (
    <div className="dm-hud dm-hud-stack dm-nav-editor">
      {current && !present.has(current.href) ? (
        <div className="dm-hud-row">
          <button type="button" className="dm-hud-primary" onClick={() => setItems((l) => [...l, current])}>
            + Add this page to the menu
          </button>
          <span className="dm-hud-muted">{current.href}</span>
        </div>
      ) : null}

      <ol className="dm-nav-list">
        {items.map((item, i) => (
          <li key={`${item.href}-${i}`} className="dm-nav-card">
            <span className="dm-nav-n" aria-hidden="true">
              {i + 1}
            </span>
            <div className="dm-nav-fields">
              <input
                type="text"
                value={item.label}
                onChange={(e) => edit(i, { label: e.target.value })}
                aria-label={`Title of menu link ${i + 1}`}
                className="dm-nav-title"
              />
              <input
                type="text"
                value={item.href}
                onChange={(e) => edit(i, { href: e.target.value })}
                spellCheck={false}
                aria-label={`Address for ${item.label}`}
                className="dm-nav-href"
              />
            </div>
            <div className="dm-nav-tools">
              <button type="button" className="dm-hud-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${item.label} up`}>
                ↑
              </button>
              <button
                type="button"
                className="dm-hud-icon"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`Move ${item.label} down`}
              >
                ↓
              </button>
              <button type="button" className="dm-hud-icon" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${item.label}`}>
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>

      {unused.length > 0 ? (
        <div>
          <h3>Pages not in the menu</h3>
          <p className="dm-hud-muted">
            Publishing a page does not add it here on its own — a link to something half-finished is worse than none.
          </p>
          <div className="dm-hud-row">
            {unused.map((c) => (
              <button key={c.href} type="button" onClick={() => setItems((l) => [...l, c])} title={c.href}>
                + {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className="dm-hud-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fresh.label.trim() || !fresh.href.trim()) return;
          setItems((l) => [...l, { label: fresh.label.trim(), href: fresh.href.trim() }]);
          setFresh({ label: "", href: "" });
        }}
      >
        <input
          type="text"
          placeholder="Title"
          value={fresh.label}
          onChange={(e) => setFresh((f) => ({ ...f, label: e.target.value }))}
          aria-label="New link title"
          style={{ flex: "1 1 8rem", width: "auto" }}
        />
        <input
          type="text"
          placeholder="/address or https://…"
          value={fresh.href}
          onChange={(e) => setFresh((f) => ({ ...f, href: e.target.value }))}
          aria-label="New link address"
          spellCheck={false}
          style={{ flex: "1 1 8rem", width: "auto" }}
        />
        <button type="submit" disabled={!fresh.label.trim() || !fresh.href.trim()}>
          Add link
        </button>
      </form>

      <div className="dm-hud-row">
        <button type="button" className="dm-hud-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save menu" : "Saved"}
        </button>
        <button type="button" onClick={() => setItems(saved)} disabled={!dirty}>
          Undo changes
        </button>
      </div>
      {status ? (
        <p className="dm-hud-muted" role="status">
          {status}
        </p>
      ) : null}
      <p className="dm-hud-muted">
        How the menu looks — its colours, font and size — is in <a href="/studio/theme">Theme</a>.
      </p>
    </div>
  );
}
