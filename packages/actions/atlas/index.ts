// The atlas index (2026-11-16): collects every curated area file, no registration line needed.
//
// Convention: each `areas/<app>.<area>.ts` exports an `Area` as its default export, or as a named
// export `AREA` or `area` (the first export holding a `capabilities` array is used). The key in
// AREAS is the file name without extension. Files starting with `_` are skipped.
//
// Node-only (reads the directory, uses top-level await). Used by scripts/check-atlas.mts and
// scripts/atlas-reports.mts; never import it from an app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Area } from './types';

const AREAS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'areas');

export async function loadAreas(): Promise<Record<string, Area>> {
  const out: Record<string, Area> = {};
  if (!fs.existsSync(AREAS_DIR)) return out;
  const files = fs.readdirSync(AREAS_DIR).filter((f) => /\.(ts|mts)$/.test(f) && !f.startsWith('_') && !f.endsWith('.d.ts')).sort();
  for (const f of files) {
    const mod: Record<string, unknown> = await import(pathToFileURL(path.join(AREAS_DIR, f)).href);
    const candidates = [mod.default, mod.AREA, mod.area, ...Object.values(mod)];
    const area = candidates.find((c): c is Area => !!c && typeof c === 'object' && Array.isArray((c as Area).capabilities));
    if (!area) throw new Error(`atlas/areas/${f}: no Area export (default, AREA or area with a capabilities array)`);
    out[f.replace(/\.(ts|mts)$/, '')] = { capabilities: area.capabilities, ignored: area.ignored ?? [] };
  }
  return out;
}

export const AREAS: Record<string, Area> = await loadAreas();
