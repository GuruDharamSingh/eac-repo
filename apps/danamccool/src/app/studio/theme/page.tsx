import { requireOrgEditor } from "@/lib/auth";
import { loadFonts, loadPalette } from "@/lib/theme-store";
import { saveThemeAction } from "@/lib/theme-actions";
import { editorPages, loadNav } from "@/lib/navigation-store";
import { ThemeStudio } from "@/components/studio/theme-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Theme" };

/**
 * The site's colours and fonts, one part of the site at a time.
 *
 * Gated here so nobody without the role loads the editor, and again in the
 * action — a client component is not an authorisation boundary.
 */
export default async function ThemePage() {
  await requireOrgEditor("/studio/theme");
  const [palette, fonts, nav, built] = await Promise.all([loadPalette(), loadFonts(), loadNav(), editorPages()]);

  // Pages the Live tab can show: the landing first, then the menu's order,
  // then anything built but not in the menu.
  const pages: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();
  for (const p of [{ label: "Home (landing)", href: "/" }, ...nav.filter((n) => !n.external), ...built]) {
    if (seen.has(p.href)) continue;
    seen.add(p.href);
    pages.push({ label: p.label, href: p.href });
  }

  return (
    <article className="content-page content-page--wide" style={{ maxWidth: 1280 }}>
      <h1 className="page-title">Theme</h1>
      <p>
        The site&rsquo;s colours and fonts, one part at a time — the menu, the pages, the captions. Each preview is drawn by the
        site&rsquo;s own styles, and <strong>Live page</strong> shows a real page wearing your changes before you save. The same
        controls are in the page editor, under the Theme tab.
      </p>
      <div style={{ marginTop: "1.5rem" }}>
        <ThemeStudio initialPalette={palette} initialFonts={fonts} nav={nav} pages={pages} onSave={saveThemeAction} />
      </div>
    </article>
  );
}
