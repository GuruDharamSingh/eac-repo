"use client";

import { useState } from "react";
import { CssPanel } from "@elkdonis/live-editor";
import type { CssVarDef } from "@elkdonis/live-editor";
import type { ThemeVars } from "@elkdonis/services";

/**
 * A person's own profile palette.
 *
 * Deliberately separate from AppearancePanel rather than the same component
 * with a mode flag: they answer to different authorities. An org's look is
 * owner/guide territory; this is the artist's own identity and follows them
 * to every org that publishes them, which is the rule profiles.ts already
 * enforces for bio and photo.
 */
export function MyAppearancePanel({
  vars,
  overrides,
  onSave,
}: {
  vars: CssVarDef[];
  overrides: ThemeVars;
  onSave: (vars: ThemeVars) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 text-sm hover:bg-accent"
      >
        My page appearance
      </button>
    );
  }

  return (
    <CssPanel
      cssVars={vars}
      initialOverrides={overrides}
      onSave={onSave}
      onClose={() => setOpen(false)}
    />
  );
}
