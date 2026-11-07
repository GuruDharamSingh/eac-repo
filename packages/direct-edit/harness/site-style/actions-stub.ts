// Stands in for apps/elktours/src/lib/site-style-actions.ts: cleans as the server does and keeps the result,
// so a reload of the harness page draws it the way the layout would.
import { cleanSiteStyle } from "/app/packages/direct-edit/src/site/style";
import { SITE_STYLE } from "/app/apps/elktours/src/lib/site-style-schema";

export async function saveSiteStyleAction(style: unknown): Promise<{ ok: boolean; error?: string }> {
  const clean = cleanSiteStyle(style, SITE_STYLE);
  (globalThis as any).__saved = clean;
  localStorage.setItem("stored", JSON.stringify(clean));
  return { ok: true };
}
