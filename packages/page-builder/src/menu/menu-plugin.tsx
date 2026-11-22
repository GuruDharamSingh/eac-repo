"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Plugin } from "@puckeditor/core";
import { NavEditor, type MenuItem, type NavEditorProps } from "./nav-editor";

// ============================================================================
// A "Menu" tab for the editor's left rail (lifted from danamccool's MenuTab).
//
// The host injects what only it can do: `load` (a gated server action that
// returns the saved menu and the pages that could join it) and `save` (a gated
// action; it revalidates the layout). The tab keeps the working list in a
// per-key module memo, so switching tabs, which unmounts the panel, does not
// lose an unsaved draft. After a successful save the memo is the saved list.
// ============================================================================

export type MenuLoad = () => Promise<{ ok: true; nav: MenuItem[]; candidates: MenuItem[] } | { ok: false; error: string }>;
export type MenuSave = (items: MenuItem[]) => Promise<{ ok: boolean; error?: string }>;

export interface MenuPluginOptions {
  load: MenuLoad;
  save: MenuSave;
  /** Tab label. */
  label?: string;
  /** Distinguishes drafts when a host mounts more than one menu. */
  memoKey?: string;
  /** The page being edited, offered first when it is not in the menu yet. */
  current?: MenuItem;
  /** Passed to the shared NavEditor (host styling, footer). */
  editor?: Pick<NavEditorProps, "className" | "classNames" | "footer" | "savedMessage">;
  heading?: ReactNode;
  /** Host markup for the loading and error states (neutral text when absent). */
  loading?: ReactNode;
  renderError?: (message: string) => ReactNode;
}

interface Memo {
  nav: MenuItem[];
  candidates: MenuItem[];
  draft: MenuItem[];
}
const MEMO = new Map<string, Memo>();

export function MenuPanel({ load, save, memoKey: key = "menu", current, editor, heading, loading, renderError }: MenuPluginOptions) {
  const [state, setState] = useState<Memo | null>(MEMO.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (MEMO.has(key)) return;
    let live = true;
    load().then((res) => {
      if (!live) return;
      if ("error" in res) return setError(res.error);
      const m = { nav: res.nav, candidates: res.candidates, draft: res.nav };
      MEMO.set(key, m);
      setState(m);
    });
    return () => {
      live = false;
    };
  }, [key, load]);

  if (error) return renderError ? <>{renderError(error)}</> : <p style={{ padding: 16, color: "#a40000" }}>{error}</p>;
  if (!state) return loading ? <>{loading}</> : <p style={{ padding: 16 }}>Loading…</p>;
  return (
    <div>
      {heading ?? (
        <div style={{ padding: "16px 16px 0" }}>
          <strong>Menu</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#404040" }}>
            The links in the site header: titles, order, addresses.
          </p>
        </div>
      )}
      <NavEditor
        {...editor}
        initial={state.draft}
        candidates={state.candidates}
        current={current}
        onChange={(items) => {
          const m = MEMO.get(key);
          if (m) MEMO.set(key, { ...m, draft: items });
        }}
        onSave={async (items) => {
          const res = await save(items);
          if (res.ok) {
            const m = MEMO.get(key);
            if (m) MEMO.set(key, { ...m, nav: items, draft: items });
          }
          return res;
        }}
      />
    </div>
  );
}

const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

/** The Menu tab, for `PuckEditor`'s `plugins`. Create it once (module scope or useMemo). */
export function menuPlugin(opts: MenuPluginOptions): Plugin {
  return {
    name: `eac-menu${opts.memoKey ? `-${opts.memoKey}` : ""}`,
    label: opts.label ?? "Menu",
    icon: ICON,
    render: () => <MenuPanel {...opts} />,
  };
}
