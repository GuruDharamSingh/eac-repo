"use client";

import { useState } from "react";
import { CssPanel } from "@elkdonis/live-editor";
import type { CssVarDef } from "@elkdonis/live-editor";
import type { ThemeVars } from "@elkdonis/services";

/**
 * Owner-facing "Appearance" control.
 *
 * The scope picker is the point: the same panel edits the site default or one
 * page's overrides, because the storage is (org_id, page_key) and the merge
 * happens server-side. Switching scope reloads that scope's own overrides —
 * unmerged — so an owner editing the hub sees what the hub itself sets, not
 * what it inherits.
 */
export function AppearancePanel({
  orgId,
  vars,
  pages,
  overridesByPage,
  onSave,
}: {
  orgId: string;
  vars: CssVarDef[];
  pages: Array<{ key: string; label: string }>;
  /** Each scope's own overrides, keyed by page key. */
  overridesByPage: Record<string, ThemeVars>;
  onSave: (orgId: string, pageKey: string, vars: ThemeVars) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pageKey, setPageKey] = useState(pages[0]?.key ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm hover:bg-accent"
      >
        Appearance
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Editing</span>
        <select
          value={pageKey}
          onChange={(e) => setPageKey(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {pages.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <CssPanel
        // Remount on scope change so the panel reloads that scope's values
        // instead of carrying the previous scope's edits across.
        key={pageKey}
        cssVars={vars}
        initialOverrides={overridesByPage[pageKey] ?? {}}
        onSave={(overrides) => onSave(orgId, pageKey, overrides)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
