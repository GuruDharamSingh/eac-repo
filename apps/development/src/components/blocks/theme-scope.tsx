"use client";

import type { ReactNode } from "react";
import { LOCAL_APPS } from "@/registry/local";
import { themeStyle, useScopeApp, useTheme } from "@/lib/theme-store";

/**
 * Applies the chosen app theme (its custom properties and fonts) to what is inside. Used by the
 * tiles and, as Puck's root wrapper, inside the editing sheet's preview iframe: the store is
 * module-level, so both see the same choice.
 *
 * Real app-local blocks (registry/local) also get data-mock-app="<app>", so the app's scoped sheet
 * (palette and rules, written under that attribute) applies to them as it does to the mocks. A tile
 * passes its app; the editing sheet's root wrapper reads it from the store (set when a tile is opened).
 */
export function ThemeScope({ children, className, app }: { settings?: Record<string, unknown>; children?: ReactNode; className?: string; app?: string }) {
  const theme = useTheme();
  const stored = useScopeApp();
  const scope = app ?? stored;
  return (
    <div className={className} data-dev-theme={theme?.id ?? ""} data-mock-app={scope && LOCAL_APPS.has(scope) ? scope : undefined} style={themeStyle(theme)}>
      {children}
    </div>
  );
}
