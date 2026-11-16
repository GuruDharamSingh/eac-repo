// Track nexus types (2026-11-16, lane rails; Justin's "nexus of tracks"). Structure only: no course content,
// no tutorial wording. Data lives here like the atlas areas; scripts/check-rails.mts checks it against the atlas.
//
// Track: a short, reusable segment toward one outcome. A course (packages/lms) becomes an ordered pick of tracks.
// Gate: a named readiness check on one person's state (read-only). A track `requires` gates and may `provide` one.
// Nexus: the graph of tracks. Edges: leads_to (explicit) and requires -> the track that provides that gate (implicit).

/** One step: an atlas capability id, or a gap (the thing a person must do that has no capability yet). */
export type Step = string | { gap: string };

export type TrackArea = 'profile' | 'publishing' | 'business' | 'site' | 'production' | 'artwork' | 'email' | 'organisation';

export interface Track {
  id: string; // kebab-case, stable
  area: TrackArea;
  label: string; // dry, internal; not shown to people
  steps: Step[]; // capability ids (the registry entry, where one exists, comes from the capability's `entry`)
  requires: string[]; // gate ids that must be met before the track makes sense
  provides?: string[]; // gate ids the track's completion meets (lets `requires` imply an edge)
  leads_to: string[]; // track ids that usually come next
  status: 'candidate'; // candidate until a course uses it and Justin approves
  note?: string;
}

/** A candidate course: an ordered pick of tracks, general to specific. `area` and `builds_on` match the course tags. */
export interface CandidateCourse {
  id: string; // becomes the course slug
  area: TrackArea;
  label: string;
  tracks: string[]; // in order
  /** Course ids this one builds on. Must be consistent with the tracks: see check-rails (derived builds_on). */
  builds_on: string[];
}

/**
 * Gate resolver forms:
 *   'todo'                   not implemented yet
 *   'gates:<fn>'             exported function in packages/actions/src/server/gates.ts
 *   'services:<fn>'          exported function in packages/services/src
 *   'status:<entry id>'      the registry check in packages/actions/src/server/status.ts (CHECKS[id])
 */
export interface Gate {
  id: string;
  label: string;
  resolver: string;
  /** Name of the parameter, when the gate is about something else than the person (is_org_member(org)). */
  param?: string;
}
