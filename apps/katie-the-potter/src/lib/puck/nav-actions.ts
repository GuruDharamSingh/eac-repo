"use server";

import { revalidatePath } from "next/cache";
import { saveSiteNav, type NavItem } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiEditor } from "@/lib/auth";
import { listPages } from "./store";
import { TEMPLATE_SLUGS } from "./store";
import { loadNav } from "@/lib/nav";

/** The menu and the pages that could join it, for the editor's Menu tab. The role check is HERE. */
export async function loadNavForEditor(): Promise<
  { ok: true; nav: NavItem[]; candidates: NavItem[] } | { ok: false; error: string }
> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only the site's editors can change the menu." };
  const [nav, pages] = await Promise.all([loadNav(), listPages()]);
  const candidates = pages
    .filter((p) => !TEMPLATE_SLUGS.has(p.slug))
    .map((p) => (p.slug === "home" ? { label: "Home", href: "/" } : { label: p.slug.split("/").pop()!.replace(/-/g, " "), href: `/${p.slug}` }));
  return { ok: true, nav, candidates };
}

/** Save the menu. The menu is in the root layout, so every route is revalidated. */
export async function saveNavAction(items: NavItem[]): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only the site's editors can change the menu." };
  const result = await saveSiteNav(siteConfig.orgId, items);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
