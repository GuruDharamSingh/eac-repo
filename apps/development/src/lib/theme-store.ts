"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import type { ThemeApp } from "./types";

// One module-level store: the tiles, the editing sheet and Puck's preview
// iframe all run in this same JS context, so they share the chosen theme
// without props crossing Puck's boundary.

let themes: ThemeApp[] = [];
/** The default preview theme: the neutral Test theme (src/theme/test-theme.ts). null = no override (the block's own look). */
export const DEFAULT_THEME_ID = "test";
let current: string | null = DEFAULT_THEME_ID;
// The app whose scoped sheet the editing sheet's preview wears (set when a tile is opened; tiles pass their own app).
let scopeApp: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function setThemes(list: ThemeApp[]) {
  themes = list;
  emit();
}
export function setTheme(id: string | null) {
  current = id;
  emit();
}
export function setScopeApp(app: string | null) {
  scopeApp = app;
  emit();
}
export const getScopeApp = () => scopeApp;
export const themeList = () => themes;
export const themeId = () => current;

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export function useThemeId(): string | null {
  return useSyncExternalStore(subscribe, themeId, () => DEFAULT_THEME_ID);
}

/** Inline style for a wrapper: the theme's custom properties, plus its fonts when it names them. */
export function themeStyle(theme: ThemeApp | undefined): CSSProperties {
  if (!theme) return {};
  const style: Record<string, string> = { ...theme.vars };
  const body = theme.fonts.body ?? theme.fonts["font 1"];
  const heading = theme.fonts.heading ?? theme.fonts.display;
  if (body) {
    style["--blk-font-body"] = body;
    style.fontFamily = body;
  }
  if (heading) style["--blk-font-title"] = heading;
  return style as CSSProperties;
}

export function useScopeApp(): string | null {
  return useSyncExternalStore(subscribe, getScopeApp, () => null);
}

export function useTheme(): ThemeApp | undefined {
  const id = useThemeId();
  return id ? themes.find((t) => t.id === id) : undefined;
}
