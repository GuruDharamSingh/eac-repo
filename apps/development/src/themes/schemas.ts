import type { SiteStyleSchema } from "@elkdonis/direct-edit/site";

// ============================================================================
// Sites that declare a real SITE_STYLE schema (the shared Site style editor's
// input). Imported by relative path, lazily, so the schema file stays the app's
// own and the theme editor shows the controls the site's owner would see.
// A site WITHOUT an entry here still works: its variables come from themes.json.
// To add one: a line below (the file must import only types, as every
// site-style-schema.ts does).
// ============================================================================

export const SCHEMAS: Record<string, () => Promise<SiteStyleSchema>> = {
  innergathering: async () => (await import("../../../innergathering/src/lib/site-style-schema")).SITE_STYLE,
  sunjay: async () => (await import("../../../sunjay/src/lib/site-style-schema")).SITE_STYLE,
  elktours: async () => (await import("../../../elktours/src/lib/site-style-schema")).SITE_STYLE,
};
