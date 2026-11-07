// ============================================================================
// The scene document stored with an installation (`art_installation.scene`):
// lighting (lighting.ts), the view a visitor opens on, and an optional free
// spot that visitors fill with a work of their choosing (the Collect Art
// landing loft). Plain data: no React or three, so server code can import it
// through `@elkdonis/three/hallway/model`.
// ============================================================================

import { normalizeLighting, type SceneLighting } from './lighting';

/** How the hall first appears to a visitor. Mirrors `ViewMode` in store.ts. */
export type SceneViewMode = 'overview' | 'wall' | 'walk';

/**
 * The opening view: a mode and, for the cutaway, which side of the route is
 * looked at and how far along it (metres from the route's start).
 */
export interface SceneView {
  mode: SceneViewMode;
  side: 'L' | 'R';
  s: number;
}

/** Where the visitors' free spot hangs: a placement without a work. */
export interface OpenSpot {
  wallId: string;
  x: number;
  y: number;
  scale: number;
}

/** Scene-wide settings as stored; every key optional on the way in. */
export interface SceneSettings {
  lighting?: Partial<SceneLighting> | null;
  view?: SceneView | null;
  openSpot?: OpenSpot | null;
}

/** A scene after `normalizeScene`: every key present and bounded. */
export interface Scene {
  lighting: SceneLighting;
  view: SceneView | null;
  openSpot: OpenSpot | null;
}

/** The id the free spot's placeholder piece and placement carry. */
export const OPEN_SPOT_ID = 'open-spot';

const MODES: SceneViewMode[] = ['overview', 'wall', 'walk'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function normalizeView(raw: unknown): SceneView | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!MODES.includes(r.mode as SceneViewMode)) return null;
  return {
    mode: r.mode as SceneViewMode,
    side: r.side === 'R' ? 'R' : 'L',
    s: finite(r.s) ? Math.round(clamp(r.s, 0, 500) * 100) / 100 : 0,
  };
}

export function normalizeOpenSpot(raw: unknown): OpenSpot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.wallId !== 'string' || !r.wallId || !finite(r.x) || !finite(r.y)) return null;
  return {
    wallId: r.wallId.slice(0, 16),
    x: clamp(r.x, -500, 500),
    y: clamp(r.y, 0, 20),
    scale: finite(r.scale) ? clamp(r.scale, 0.25, 4) : 1,
  };
}

/** A scene document as stored: only the keys this version knows, bounded. */
export function normalizeScene(raw: unknown): Scene {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    lighting: normalizeLighting(r.lighting),
    view: normalizeView(r.view),
    openSpot: normalizeOpenSpot(r.openSpot),
  };
}
