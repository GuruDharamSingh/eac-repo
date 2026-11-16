// Track loader (2026-11-16, lane rails): collects every `tracks/<area>.ts` file (a named export `tracks`), plus
// `courses.ts` (candidate courses) and `gates.ts` (GATES). Node-only; used by scripts/check-rails.mts. Not imported by apps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CandidateCourse, Gate, Track } from './types';
import { GATES } from './gates';
import { courses } from './courses';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['index', 'types', 'gates', 'courses']);

export async function loadTracks(): Promise<Track[]> {
  const out: Track[] = [];
  const files = fs.readdirSync(DIR).filter((f) => /\.(ts|mts)$/.test(f) && !f.endsWith('.d.ts') && !f.startsWith('_') && !SKIP.has(f.replace(/\.(ts|mts)$/, ''))).sort();
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(DIR, f)).href)) as { tracks?: Track[] };
    if (!Array.isArray(mod.tracks)) throw new Error(`atlas/tracks/${f}: no \`tracks\` export`);
    out.push(...mod.tracks);
  }
  return out;
}

export async function loadNexus(): Promise<{ tracks: Track[]; gates: Gate[]; courses: CandidateCourse[] }> {
  return { tracks: await loadTracks(), gates: GATES, courses };
}
