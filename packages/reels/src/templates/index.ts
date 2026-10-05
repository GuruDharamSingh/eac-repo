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

export interface ReelTemplate {
  id: ReelTemplateId;
  label: string;
  description: string;
  component: React.FC<ReelInput>;
  fps: number;
  width: number;
  height: number;
  durationInFrames(input: ReelInput): number;
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
};

export { ArtworkReel, planArtworkReel };
