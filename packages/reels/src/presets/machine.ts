// Machine-shot recipes per capture preset id: what the renderer adds after the
// phone's marks have placed the cuts. Data only; fromCapture.ts reads it.
// Offsets are relative to a named mark (edited-clip time), or to the start.

export interface MachineStep {
  kind: 'title' | 'caption' | 'sound' | 'subtitles' | 'music';
  /** Mark the step hangs off; absent = start of the edit. */
  mark?: string;
  /** Seconds after the mark. */
  offset?: number;
  seconds?: number;
  place?: 'top' | 'bottom';
  /** sound / music: key into opts.sounds / opts.music. */
  sound?: string;
  volume?: number;
}

export interface MachineRecipe {
  steps: MachineStep[];
  /** The roll carries speech: music ducks under it and subtitles make sense. */
  voice: boolean;
  /** Things the caller must supply or queue before the render is complete. */
  needs?: Array<'sound:felt_hit' | 'music:warm_pad' | 'transcript'>;
}

const DEFAULT: MachineRecipe = { voice: true, steps: [{ kind: 'title', offset: 0.3, seconds: 3.2 }] };

export const MACHINE_RECIPES: Record<string, MachineRecipe> = {
  // Title lands just after the cloth lifts; felt hit on the lift; quiet pad bed.
  V27: {
    voice: false,
    needs: ['sound:felt_hit', 'music:warm_pad'],
    steps: [
      { kind: 'title', mark: 'lift', offset: 0.35, seconds: 2.8 },
      { kind: 'sound', mark: 'lift', offset: 0, seconds: 2.2, sound: 'felt_hit', volume: 0.6 },
      { kind: 'music', sound: 'warm_pad', volume: 0.12 },
    ],
  },
  // A caption sits on the mistake.
  V18: { voice: true, steps: [{ kind: 'caption', mark: 'mistake', offset: 0, seconds: 2.6, place: 'bottom' }] },
  // Subtitles: an empty item now; fill cues from the whisper transcript
  // (queueReelTranscript in services/reels.ts -> cuesFromWords in templates/subtitles.ts).
  V43: { voice: true, needs: ['transcript'], steps: [{ kind: 'subtitles', seconds: 0, place: 'bottom' }] },
  V49: { voice: true, needs: ['transcript'], steps: [{ kind: 'subtitles', seconds: 0, place: 'bottom' }] },
};

export const machineRecipe = (preset: string): MachineRecipe => MACHINE_RECIPES[preset] ?? DEFAULT;
