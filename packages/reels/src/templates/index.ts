// Template registry. A template is a Remotion component taking `ReelInput`
// plus a pure duration function, so the player and the renderer agree on
// length without rendering anything.

import type React from 'react';
import type { ReelInput, ReelTemplateId } from '../types';
import {
  ArtworkReel,
  ArtworkReelComposition,
  artworkReelDuration,
  planArtworkReel,
  FPS,
  WIDTH,
  HEIGHT,
} from './artwork-reel';
import { ClipReelComposition, clipReelDuration, clipReelSize, FPS as CLIP_FPS } from './clip';

export interface ReelTemplate {
  id: ReelTemplateId;
  label: string;
  description: string;
  component: React.FC<ReelInput>;
  fps: number;
  width: number;
  height: number;
  durationInFrames(input: ReelInput): number;
  /** Per-edit frame size (the clip template's format); width/height otherwise. */
  dimensions?(input: ReelInput): { width: number; height: number };
}

export const REEL_TEMPLATES: Record<ReelTemplateId, ReelTemplate> = {
  'artwork-reel': {
    id: 'artwork-reel',
    label: 'Artwork reel',
    description: 'Logo, the artwork with a slow pan, your clips, an end card. 9:16, 20–45 s.',
    component: ArtworkReelComposition,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    durationInFrames: artworkReelDuration,
  },
  clip: {
    id: 'clip',
    label: 'Clip with overlays',
    description: 'One recording, trimmed, with a title, a lower third, a corner label and an end card. 16:9, 9:16 or 1:1.',
    component: ClipReelComposition,
    fps: CLIP_FPS,
    width: 1920,
    height: 1080,
    durationInFrames: clipReelDuration,
    dimensions: clipReelSize,
  },
};

/** The frame size an edit renders at. */
export const templateSize = (t: ReelTemplate, input: ReelInput) => t.dimensions?.(input) ?? { width: t.width, height: t.height };

export { ArtworkReel, planArtworkReel };
