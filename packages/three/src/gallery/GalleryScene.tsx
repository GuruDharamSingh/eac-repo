import React, { useMemo } from 'react';
import type { Texture } from 'three';
import { GalleryRoom } from './GalleryRoom';
import { HangingPiece } from './HangingPiece';
import { Plinth } from './Plinth';
import { GalleryControls } from './controls/GalleryControls';
import { layoutGallery } from './room';
import { HALL, type RoomDesign } from './designs';
import { useMediaTextures } from '../hooks/useMediaTextures';
import type { GalleryLayout, GalleryPiece } from './types';

/**
 * Longest edge each image is downscaled to before it reaches the GPU. A wall
 * piece is at most a couple of metres across and is usually seen from further
 * off than that, so beyond this the extra pixels buy nothing and cost VRAM on
 * every picture in the room at once.
 */
const TEXTURE_MAX_SIZE = 1280;

export interface GallerySceneProps {
  pieces: readonly GalleryPiece[];
  design?: RoomDesign;
  onLayout?: (layout: GalleryLayout) => void;
}

/** Everything inside the canvas. Mounted by `GalleryExperience`. */
export function GalleryScene({ pieces, design = HALL, onLayout }: GallerySceneProps) {
  const layout = useMemo(() => layoutGallery(pieces, design), [pieces, design]);

  React.useEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // A piece shown as a 3D capture needs no photo texture.
  const urls = useMemo(
    () => [
      ...layout.walls.map((slot) => slot.piece.imageUrl),
      ...layout.plinths.filter((slot) => !slot.piece.splatUrl).map((slot) => slot.piece.imageUrl),
    ],
    [layout],
  );

  const textures = useMediaTextures(urls, { maxSize: TEXTURE_MAX_SIZE });

  // `useMediaTextures` drops images that failed to load, so the result is not
  // index-aligned with the request. Each texture carries the URL it came from
  // for exactly this reason.
  const byUrl = useMemo(() => {
    const map = new Map<string, Texture>();
    for (const texture of textures) {
      const src = texture.userData.src as string | undefined;
      if (src) map.set(src, texture);
    }
    return map;
  }, [textures]);

  return (
    <>
      <GalleryControls design={design} />
      <GalleryRoom design={design} />

      {layout.walls.map((slot) => (
        <HangingPiece
          key={slot.piece.id}
          slot={slot}
          design={design}
          texture={byUrl.get(slot.piece.imageUrl) ?? null}
        />
      ))}

      {layout.plinths.map((slot) => (
        <Plinth
          key={slot.piece.id}
          slot={slot}
          design={design}
          texture={byUrl.get(slot.piece.imageUrl) ?? null}
        />
      ))}
    </>
  );
}
