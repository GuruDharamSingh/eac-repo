import type { FieldDef, CssVarDef } from "@elkdonis/live-editor";
import { fieldRegistry, themeVarRegistry } from "./field-registry";
import type { WorkshopPageData } from "./types";

/**
 * Convert WorkshopPageData + the workshop field registry into a FieldDef array
 * for @elkdonis/live-editor. This is the bridge between the data model and the
 * generic editor UI — it runs on the server (no "use client").
 *
 * Called once per page render; the result is passed as a prop to the client
 * component that wraps <LiveEditor>.
 */
export function workshopFieldDefs(data: WorkshopPageData): FieldDef[] {
  const d = data as Record<string, unknown>;
  const seen = new Set<string>();
  const defs: FieldDef[] = [];

  for (const [trait, meta] of Object.entries(fieldRegistry)) {
    if (meta.input === "readonly") continue;

    // Deduplicate: e.g. spotsText and spotsRemaining map to the same field.
    // We keep the first occurrence.
    const dedupKey =
      meta.input === "compound"
        ? `compound:${meta.compound?.map((f) => f.col).join(",")}`
        : `${meta.table}:${meta.col}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    if (meta.input === "compound" && meta.compound) {
      defs.push({
        trait,
        label: meta.label,
        input: "compound",
        hint: meta.hint,
        compound: meta.compound.map((f) => ({
          key: f.col,
          label: f.label,
          input: f.input,
          initialValue: stringify(d[f.col]),
        })),
      });
    } else {
      const dataKey = meta.dataKey ?? meta.col;
      defs.push({
        trait,
        label: meta.label,
        input: meta.input,
        hint: meta.hint,
        initialValue: stringify(d[dataKey]),
        options: meta.options,
      });
    }
  }

  return defs;
}

/**
 * Convert the workshop theme var registry to the generic CssVarDef format.
 * Safe to import on the server — no DOM access.
 */
export function workshopCssVarDefs(): CssVarDef[] {
  return themeVarRegistry.map((v) => ({
    name: v.name,
    label: v.label,
    type: v.type,
    default: v.default,
    hint: v.hint,
  }));
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
