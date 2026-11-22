// Shot data for the phone "shot director". Shapes follow the build map
// ("Channel presets build map for maker agents", sections 1 and 3).
// Plain data and types: nothing here touches the DOM.

export type ShotBy = 'machine' | 'aid' | 'human';

export type FrameShape = 'centre-box' | 'thirds' | 'hands-line' | 'face-line' | 'close-up' | 'horizon' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br';

export type Aid =
  | { kind: 'frame'; shape: FrameShape }
  | { kind: 'beat'; bpm: number; count: number }
  | { kind: 'mark'; name: string }
  | { kind: 'timer'; seconds: number }
  | { kind: 'prompt'; text: string }
  | { kind: 'ghost' }
  | { kind: 'shotcard'; text: string; n?: number; of?: number; auto?: boolean };

export interface ShotCamera {
  lens?: string;
  height?: string;
  move?: string;
  light?: string;
}

export interface Shot {
  id: string;
  say: string;
  by: ShotBy;
  /** Machine shots only: which engine makes it (remotion, whisper, ffmpeg, overlay). */
  engine?: string;
  seconds?: number;
  aid?: Aid[];
  /** The name of the tap point in this shot (the MARK button's label). */
  mark?: string;
  camera?: ShotCamera;
}

export interface CapturePreset {
  id: string;
  name: string;
  /** First effect of the preset (tease, reveal, ...), for the colour dot. */
  effect: string;
  shots: Shot[];
}

/** A tap on the MARK button: seconds since the recording started. */
export interface Mark {
  name: string;
  t: number;
}

/** One take of one shot, in seconds since the recording started. */
export interface TakeRecord {
  shot: string;
  say: string;
  from: number;
  to: number;
  marks: Mark[];
  kept: boolean;
}

/** Same shape as ReelOverlayItem (packages/reels/src/types.ts) for kind 'sound'. */
export interface SoundOverlay {
  id: string;
  kind: 'sound';
  /** Seconds into the edited (segments joined) timeline. */
  at: number;
  seconds: number;
  sound: null;
  volume: number;
  note: string;
}

/** The edit JSON the phone stores beside the recording (<name>.edit.json). */
export interface TakeEdit {
  preset: string;
  shots: { shot: string; say: string; from: number; to: number; marks: Mark[] }[];
  /** `segments` are ReelClipRef.segments (source seconds). `path` is filled in by the server. */
  clip: { path: string; segments: { from: number; to: number }[] };
  overlays: SoundOverlay[];
  machine: { shot: string; say: string; engine?: string }[];
}
