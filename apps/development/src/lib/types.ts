// Shapes the app reads. Data files are normalised into these (src/lib/data.ts),
// so a differently-shaped file from the catalogue workers degrades, not breaks.

export interface CatalogEntry {
  /** app:id, unique across apps. */
  key: string;
  id: string;
  label: string;
  /** "shared" or an app name. */
  app: string;
  pkg?: string;
  source?: string;
  category?: string;
  description?: string;
  dataDriven?: boolean;
  interactive?: boolean;
  propCount?: number;
  parts?: string[];
  /** "yes" when this app can render it, "app-only" when it cannot be imported cleanly. */
  importable?: string;
  blocker?: string;
  /** The block's prop declarations (blocks.json), for the read-only props table on mock tiles. */
  props?: { name: string; kind?: string; label?: string; default?: unknown }[];
}

export interface ThemeApp {
  id: string;
  label: string;
  source?: string;
  vars: Record<string, string>;
  fonts: Record<string, string>;
  families: string[];
  counts: Record<string, number>;
  editedBy?: string;
  swatches: { name: string; value: string }[];
}

export interface DesignSystem {
  title: string;
  summary: string;
  vocabulary: { token: string; meaning: string; kind?: string; layer?: string; light?: string; dark?: string }[];
  layers: { id: string; label: string; summary: string }[];
  principle?: string;
  aliases: { from: string; to: string; apps: string[] }[];
  notes: string[];
}
