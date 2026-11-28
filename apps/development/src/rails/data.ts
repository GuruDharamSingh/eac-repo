import raw from "@/data/rails/readiness.json";
import { type Cap, type Readiness, type ReadinessCourse, type ReadinessTrack, type SlimCap, type LevelNo } from "./types";

// Server-side view of the readiness snapshot (src/data/rails/readiness.json, copied by
// scripts/refresh-rails.mjs from packages/actions/atlas/reports/readiness.json).

export const readiness = raw as unknown as Readiness;

export const capById = new Map<string, Cap>(readiness.capabilities.map((c) => [c.id, c]));
export const trackById = new Map<string, ReadinessTrack>(readiness.tracks.map((t) => [t.id, t]));
export const courseById = new Map<string, ReadinessCourse>(readiness.courses.map((c) => [c.id, c]));

/** One step of a course as the atlas has it: in order, with the module (track) it comes from. */
export interface AtlasStep {
  cap?: string;
  gap?: string;
  level: LevelNo;
  trackId: string;
  trackLabel: string;
  /** Position within the whole course, from 0. */
  index: number;
}

export function courseSteps(courseId: string): AtlasStep[] {
  const c = courseById.get(courseId);
  if (!c) return [];
  const out: AtlasStep[] = [];
  for (const tid of c.tracks) {
    const t = trackById.get(tid);
    if (!t) continue;
    for (const s of t.steps) {
      const level = (s.cap ? (capById.get(s.cap)?.level ?? s.level) : 0) as LevelNo;
      out.push({ cap: s.cap, gap: s.gap, level, trackId: t.id, trackLabel: t.label, index: out.length });
    }
  }
  return out;
}

export function countLevels(levels: number[]): Record<LevelNo, number> {
  const out: Record<LevelNo, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const l of levels) out[Math.max(0, Math.min(4, l)) as LevelNo]++;
  return out;
}

/** Courses that name this course in builds_on. */
export function leadsTo(courseId: string): ReadinessCourse[] {
  return readiness.courses.filter((c) => c.builds_on.includes(courseId));
}

export const slim = (c: Cap): SlimCap => ({ id: c.id, label: c.label, level: c.level, area: c.area, does: c.does.slice(0, 140), why: c.why.slice(0, 120), ...(c.where ? { where: c.where } : {}) });
