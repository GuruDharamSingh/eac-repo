import { resolveTheme, renderThemeCss } from "@elkdonis/services";

/**
 * Injects the resolved theme as a :root rule.
 *
 * Imported as `@elkdonis/live-editor/theme`, NOT from the package index. The
 * index is reached from client components (via @elkdonis/ui), and this module
 * pulls in @elkdonis/services → @elkdonis/db → postgres. Exporting it from the
 * barrel drags a Postgres driver into the browser bundle and every client
 * consumer fails to build.
 *
 * A server component, rendered in a layout: the variables must be in the HTML
 * before first paint or the page flashes its default palette and then swaps.
 * Renders nothing at all when a scope has no overrides, so an unthemed site
 * carries no empty <style> tag.
 *
 * The values are sanitized in renderThemeCss, not here — the same guard runs
 * whether CSS is produced for a page or for the editor's live preview.
 */
export async function ThemeStyle({
  orgId,
  pageKey,
  userId,
  precedence,
}: {
  orgId?: string | null;
  /** Omit for the site default; pass a key to layer one page's overrides. */
  pageKey?: string;
  userId?: string | null;
  /**
   * 'org' (default) — the org's look wins, so a member cannot repaint a site
   * they are merely published on. 'user' — the person's own home, where their
   * palette should win. See resolveTheme.
   */
  precedence?: "org" | "user";
}) {
  const css = renderThemeCss(await resolveTheme({ orgId, pageKey, userId, precedence }));
  if (!css) return null;
  return <style id="eac-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
