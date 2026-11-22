import { allows, type ViewerLike } from "@/lib/puck/viewer-rank";
import { safeHref } from "./page-buttons-logic";

// ============================================================================
// m-phone-menu (2026-11-21): the sticky footer menu as a block. Pure logic (no imports beyond the rank table and the
// shared link check): the block, its server resolver, the editor action and the checks read it.
// ============================================================================

export type MenuIcon = "none" | "home" | "compass" | "star" | "pin" | "people" | "chat" | "user";
export const MENU_ICONS: readonly MenuIcon[] = ["none", "home", "compass", "star", "pin", "people", "chat", "user"];
export interface MenuItemRow { label?: string; to?: string; icon?: string; who?: string }
export interface ShownItem { label: string; to: string; icon: MenuIcon }

/** What the bar was before it was a block: Discover, Tours, Experiences. */
export const DEFAULT_ITEMS: MenuItemRow[] = [
  { label: "Discover", to: "/", icon: "none", who: "everyone" },
  { label: "Tours", to: "/tours", icon: "none", who: "everyone" },
  { label: "Experiences", to: "/experiences", icon: "none", who: "everyone" },
];
/** The pages the bar showed on. */
export const DEFAULT_SHOW_ON = ["/", "/tours", "/experiences"] as const;

/** The items this viewer may see (a visitor's list holds no label or link they may not see). Two to six items; more are dropped. */
export function itemsFor(rows: unknown, viewer: ViewerLike | null): ShownItem[] {
  const list = Array.isArray(rows) && rows.length > 0 ? (rows as MenuItemRow[]) : DEFAULT_ITEMS;
  const out: ShownItem[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object" || !allows(r.who, viewer)) continue;
    const to = safeHref(r.to);
    const label = String(r.label ?? "").trim();
    if (!to || !label) continue;
    out.push({ label, to, icon: (MENU_ICONS as readonly string[]).includes(String(r.icon)) ? (r.icon as MenuIcon) : "none" });
  }
  return out.slice(0, 6);
}

/** Clean list of paths the bar shows on: "/" plus segments; blank or empty means the standard three. */
export function showOnPaths(v: unknown): string[] {
  const list = Array.isArray(v) ? v.map((s) => String(s).trim()).filter((s) => /^\/[^\s?#]*$/.test(s)) : [];
  return (list.length ? list : [...DEFAULT_SHOW_ON]).map((s) => (s.length > 1 ? s.replace(/\/+$/, "") : s));
}

/** `*` at the end means "and everything under it" (/tours/*). */
export function showsOn(paths: string[], pathname: string | null): boolean {
  if (!pathname) return false;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return paths.some((s) => (s.endsWith("/*") ? p === s.slice(0, -2) || p.startsWith(s.slice(0, -1)) : s === p));
}
