import type { CenterKey, ModeKey } from "./content";
import type { Feel, Timbre } from "@/lib/sound/engine";
import type { Melody, Rhythm } from "@/lib/sound/rhythm";
import type { TuningKey } from "@/lib/sound/tuning";

// ============================================================================
// The figure's sound config (plain module: the server block, the client hook
// and the reading all read it; a "use client" file could not share values).
//
// Centres set the timbre (defaults after the research report 6.3: gut a felt
// drum, heart a voice, head a bell). Lenses set the feel: tempo, brightness,
// space. Both are interpretive, and the page says so.
// ============================================================================

export type WebOverlay = "off" | "notes" | "ring";

export interface FigureSound {
  /** "site" follows Manage, Music (site_config he-audio). */
  tuning: TuningKey | "site";
  /** What the sound bar offers first. */
  melody: Melody;
  rotation: number;
  rhythm: Rhythm;
  timbres: Record<CenterKey, Timbre>;
  web: WebOverlay;
  mic: boolean;
}

export const DEFAULT_TIMBRES: Record<CenterKey, Timbre> = { gut: "felt", heart: "voice", head: "bell" };

/** Interpretive: how each lens feels. */
export const LENS_FEEL: Record<ModeKey, Feel> = {
  centers: { bpm: 66, bright: 1, space: 0.25 },
  object: { bpm: 60, bright: 0.8, space: 0.36 },
  energy: { bpm: 80, bright: 1.25, space: 0.16 },
  attitude: { bpm: 70, bright: 1, space: 0.28 },
};

export const DEFAULT_SOUND: FigureSound = {
  tuning: "site",
  melody: "hexad",
  rotation: 1,
  rhythm: "steady",
  timbres: DEFAULT_TIMBRES,
  web: "off",
  mic: true,
};
