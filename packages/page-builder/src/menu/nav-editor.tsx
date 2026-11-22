"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// ============================================================================
// Arranging a site's navigation: titles, order and addresses.
//
// Lifted from danamccool's NavEditor (2026-11-20). Plain up/down buttons
// rather than drag-and-drop: a list of sixteen links is reordered perfectly
// well by keyboard, and every assistive technology understands a button.
// Indenting a link puts it in a submenu under the nearest link above it.
//
// STYLING. A host that has its own sheet (danamccool's `dm-*` rules) passes
// `classNames` (one class per slot); the editor then adds NO inline styles and
// the host's rules apply as before. With no `classNames` it draws itself with
// neutral inline styles and the Puck variables, which is what the Puck rail
// uses.
// ============================================================================

/** Structurally identical to `NavItem` in @elkdonis/services/nav-core (the canonical type). */
export interface MenuItem {
  label: string;
  href: string;
  external?: boolean;
  sub?: boolean;
}

export type MenuSlot =
  | "row"
  | "primary"
  | "muted"
  | "list"
  | "card"
  | "cardSub"
  | "n"
  | "fields"
  | "title"
  | "href"
  | "tools"
  | "icon";

export interface NavEditorProps {
  initial: MenuItem[];
  candidates: MenuItem[];
  onSave: (items: MenuItem[]) => Promise<{ ok: boolean; error?: string }>;
  /** The page being edited, offered first when it is not in the menu yet. */
  current?: MenuItem;
  /** Root element class(es). */
  className?: string;
  /** Per-slot classes. When given, the built-in inline styles are off. */
  classNames?: Partial<Record<MenuSlot, string>>;
  /** Shown under the editor (e.g. a link to the theme screen). */
  footer?: ReactNode;
  /** Called after each successful save, with what was saved. */
  onSaved?: (items: MenuItem[]) => void;
  /** Called whenever the working list changes (for draft memos). */
  onChange?: (items: MenuItem[]) => void;
  savedMessage?: string;
}

const NEUTRAL: Record<MenuSlot | "root", CSSProperties> = {
  root: { display: "grid", gap: 12, padding: 16, fontFamily: "var(--puck-font-family, system-ui)", fontSize: 13 },
  row: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  primary: { fontWeight: 600 },
  muted: { margin: 0, fontSize: 12, color: "var(--puck-color-text-secondary, #404040)" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  card: { display: "flex", gap: 8, alignItems: "center", padding: 8, border: "1px solid var(--puck-color-grey-09, #dcdcdc)", borderRadius: 8 },
  cardSub: { display: "flex", gap: 8, alignItems: "center", padding: 8, marginLeft: 20, border: "1px solid var(--puck-color-grey-09, #dcdcdc)", borderRadius: 8 },
  n: { width: 18, textAlign: "center", color: "#5a5a5a" },
  fields: { flex: 1, display: "grid", gap: 4, minWidth: 0 },
  title: { width: "100%", font: "inherit", fontWeight: 600 },
  href: { width: "100%", font: "inherit", fontSize: 12 },
  tools: { display: "flex", gap: 4 },
  icon: { minWidth: 26 },
};

export function NavEditor({
  initial,
  candidates,
  onSave,
  current,
  className,
  classNames,
  footer,
  onSaved,
  onChange,
  savedMessage = "Saved. The menu shows it on every page now.",
}: NavEditorProps) {
  const [saved, setSaved] = useState<MenuItem[]>(initial);
  const [items, setItemsState] = useState<MenuItem[]>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fresh, setFresh] = useState({ label: "", href: "" });

  const themed = Boolean(classNames);
  const cls = (slot: MenuSlot) => classNames?.[slot];
  const sty = (slot: MenuSlot | "root"): CSSProperties | undefined => (themed ? undefined : NEUTRAL[slot]);

  const setItems = (next: MenuItem[] | ((l: MenuItem[]) => MenuItem[])) => {
    const v = typeof next === "function" ? next(items) : next;
    setItemsState(v);
    onChange?.(v);
  };

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
  const edit = (i: number, patch: Partial<MenuItem>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await onSave(items);
    setSaving(false);
    if (res.ok) {
      setSaved(items);
      onSaved?.(items);
    }
    setStatus(res.ok ? savedMessage : (res.error ?? "Could not save."));
  }

  return (
    <div className={className} style={sty("root")}>
      {current && !present.has(current.href) ? (
        <div className={cls("row")} style={sty("row")}>
          <button type="button" className={cls("primary")} style={sty("primary")} onClick={() => setItems((l) => [...l, current])}>
            + Add this page to the menu
          </button>
          <span className={cls("muted")} style={sty("muted")}>{current.href}</span>
        </div>
      ) : null}

      <ol className={cls("list")} style={sty("list")}>
        {items.map((item, i) => (
          <li key={`${item.href}-${i}`} className={item.sub ? cls("cardSub") : cls("card")} style={sty(item.sub ? "cardSub" : "card")}>
            <span className={cls("n")} style={sty("n")} aria-hidden="true">
              {i + 1}
            </span>
            <div className={cls("fields")} style={sty("fields")}>
              <input
                type="text"
                value={item.label}
                onChange={(e) => edit(i, { label: e.target.value })}
                aria-label={`Title of menu link ${i + 1}`}
                className={cls("title")}
                style={sty("title")}
              />
              <input
                type="text"
                value={item.href}
                onChange={(e) => edit(i, { href: e.target.value })}
                spellCheck={false}
                aria-label={`Address for ${item.label}`}
                className={cls("href")}
                style={sty("href")}
              />
            </div>
            <div className={cls("tools")} style={sty("tools")}>
              <button type="button" className={cls("icon")} style={sty("icon")} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${item.label} up`}>
                ↑
              </button>
              <button
                type="button"
                className={cls("icon")}
                style={sty("icon")}
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`Move ${item.label} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className={cls("icon")}
                style={sty("icon")}
                onClick={() => edit(i, { sub: item.sub ? undefined : true })}
                disabled={i === 0 && !item.sub}
                aria-pressed={Boolean(item.sub)}
                aria-label={item.sub ? `Move ${item.label} back to the main menu` : `Put ${item.label} under the link above`}
                title={item.sub ? "Back to the main menu" : "Put under the link above"}
              >
                {item.sub ? "⇤" : "⇥"}
              </button>
              <button type="button" className={cls("icon")} style={sty("icon")} onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${item.label}`}>
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>

      {unused.length > 0 ? (
        <div>
          <h3>Pages not in the menu</h3>
          <p className={cls("muted")} style={sty("muted")}>
            Publishing a page does not add it here on its own — a link to something half-finished is worse than none.
          </p>
          <div className={cls("row")} style={sty("row")}>
            {unused.map((c) => (
              <button key={c.href} type="button" onClick={() => setItems((l) => [...l, c])} title={c.href}>
                + {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className={cls("row")}
        style={sty("row")}
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

      <div className={cls("row")} style={sty("row")}>
        <button type="button" className={cls("primary")} style={sty("primary")} onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save menu" : "Saved"}
        </button>
        <button type="button" onClick={() => setItems(saved)} disabled={!dirty}>
          Undo changes
        </button>
      </div>
      {status ? (
        <p className={cls("muted")} style={sty("muted")} role="status">
          {status}
        </p>
      ) : null}
      {footer}
    </div>
  );
}
