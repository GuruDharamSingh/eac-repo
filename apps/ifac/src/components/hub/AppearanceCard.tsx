"use client";

import { useState } from "react";
import { CssPanel } from "@elkdonis/live-editor";
import type { CssVarDef } from "@elkdonis/live-editor";
import type { ThemeVars } from "@elkdonis/services";

/**
 * Appearance controls for the hub.
 *
 * The scope select and the "my profile" toggle sit above one CssPanel rather
 * than being three panels: they all edit the same kind of thing, and the panel
 * is remounted on scope change so it loads that scope's own values instead of
 * carrying the previous scope's edits across.
 */
export function AppearanceCard({
  vars,
  pages,
  overridesByPage,
  onSaveSite,
}: {
  vars: CssVarDef[];
  pages: Array<{ key: string; label: string }>;
  overridesByPage: Record<string, ThemeVars>;
  onSaveSite: (pageKey: string, vars: ThemeVars) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  // "" and "hub" are site scopes; "@me" is this person's own profile pages.
  const [scope, setScope] = useState<string>(pages[0]?.key ?? "");

  const overrides = overridesByPage[scope] ?? {};

  return (
    <div className="hub-appearance">
      <div className="hub-panel-head">
        <h2>Appearance</h2>
        <span className="hub-tag">Colours</span>
      </div>

      <p className="hub-appearance-note">
        These set the colour variables the whole site reads, so a change here
        restyles pages and live components together.
      </p>

      <div className="hub-appearance-controls">
        <label>
          <span>Editing</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {pages.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            {/* "My profile pages" deliberately absent: colours you can't see
                while choosing them are guesswork. That editor lives on the
                profile page itself, under "Page colours". */}
          </select>
        </label>

        {!open && (
          <button type="button" onClick={() => setOpen(true)}>
            Open editor
          </button>
        )}
      </div>

      {open && (
        <CssPanel
          key={scope}
          cssVars={vars}
          initialOverrides={overrides}
          onSave={(next) => onSaveSite(scope, next)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
