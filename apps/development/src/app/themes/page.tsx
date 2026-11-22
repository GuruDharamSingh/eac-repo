import type { Metadata } from "next";
import { ThemeStudio } from "@/components/themes/ThemeStudio";
import { loadCatalog, loadThemes } from "@/lib/data";
import { loadRoleDefs, loadThemeSites } from "@/lib/site-theme-data";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Themes" };
export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  await requireNetworkAdmin("/themes");
  return <ThemeStudio sites={loadThemeSites()} catalog={loadCatalog()} themes={loadThemes()} roleDefs={loadRoleDefs()} />;
}
