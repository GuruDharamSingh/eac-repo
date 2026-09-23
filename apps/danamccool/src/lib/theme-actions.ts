"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { loadFonts, loadPalette, saveFonts, savePalette } from "./theme-store";
import { loadNav } from "./navigation-store";
import type { NavItem } from "./navigation";
import type { SiteFonts } from "./fonts";
import type { Palette } from "./theme";

/**
 * Write the site's palette.
 *
 * The role check is here rather than in the editor component, because a client
 * component is not an authorisation boundary — someone who can open dev tools
 * can call this directly.
 */
export async function savePaletteAction(palette: Palette): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site owner can change the colours." };

  const result = await savePalette(palette);
  // The palette is read in the root layout, so every route's cached render is
  // now wrong — not just one page.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Write the site's fonts. Same gate as the palette. */
export async function saveFontsAction(fonts: SiteFonts): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site's editors can change the fonts." };
  const result = await saveFonts(fonts);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Colours and fonts together — the theme editor saves both with one button. */
export async function saveThemeAction(
  palette: Palette,
  fonts: SiteFonts
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site's editors can change the theme." };
  const [p, f] = await Promise.all([savePalette(palette), saveFonts(fonts)]);
  if (p.ok || f.ok) revalidatePath("/", "layout");
  if (!p.ok) return p;
  if (!f.ok) return f;
  return { ok: true };
}

/**
 * Everything the theme editor needs, for the editor's Theme tab — which is a
 * client panel inside Puck and has no server page to load it for it.
 */
export async function loadThemeForEditor(): Promise<
  | { ok: true; palette: Palette; fonts: SiteFonts; nav: NavItem[] }
  | { ok: false; error: string }
> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Sign in as someone who can edit this site." };
  const [palette, fonts, nav] = await Promise.all([loadPalette(), loadFonts(), loadNav()]);
  return { ok: true, palette, fonts, nav };
}
