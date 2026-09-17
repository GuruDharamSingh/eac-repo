import { useEffect, useMemo, useState } from 'react';
import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Texture } from 'three';
import { fitPiece, getSurface, HANG_CENTRE_Y, viewpointForSlot } from './room';
import { HALL, type RoomDesign } from './designs';
import { useGalleryStore } from './store';
import type { WallSlot } from './types';

const FRAME_BORDER = 0.055;
const FRAME_DEPTH = 0.06;
const FRAME_COLOUR = '#2b2723';
const MOUNT_COLOUR = '#faf7f2';

/**
 * A drag that ends over a piece should look at the room, not open the piece.
 * Generous enough for a thumb, which never taps as still as a mouse clicks.
 */
const CLICK_TRAVEL_LIMIT = 10;

export interface HangingPieceProps {
  slot: WallSlot;
  texture: Texture | null;
  design?: RoomDesign;
}

/**
 * One framed work on a wall.
 *
 * The image itself is drawn unlit. In a room full of lights an artist's colour
 * would come out as whatever the lighting rig did to it, which for a shop
 * selling the actual object is the wrong trade — so the frame and mount take
 * the light and the work is shown as the file is.
 */
export function HangingPiece({ slot, texture, design = HALL }: HangingPieceProps) {
  const [hovered, setHovered] = useState(false);
  const approach = useGalleryStore((s) => s.approach);
  const setHoveredId = useGalleryStore((s) => s.setHoveredId);
  const selectedId = useGalleryStore((s) => s.selected?.id ?? null);
  useCursor(hovered);

  const surface = getSurface(slot.surfaceId, design);

  const fitted = useMemo(() => {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    return fitPiece(slot.piece, aspect, slot.maxWidth, slot.maxHeight);
  }, [texture, slot]);
  const { width, height } = fitted;

  // Crop the photograph to the piece's recorded shape through the texture's own
  // UV transform, rather than by stretching the plane it is drawn on. Each
  // piece owns its texture (one image, one URL, one wall slot), so writing to
  // it here cannot disturb anything else in the room.
  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(fitted.repeat[0], fitted.repeat[1]);
    texture.offset.set(fitted.offset[0], fitted.offset[1]);
    texture.needsUpdate = true;
  }, [texture, fitted]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TRAVEL_LIMIT) return;
    event.stopPropagation();
    approach(slot.piece, viewpointForSlot(slot, design));
  };

  const onOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    setHoveredId(slot.piece.id);
  };

  const onOut = () => {
    setHovered(false);
    setHoveredId(null);
  };

  const lit = hovered || selectedId === slot.piece.id;

  return (
    <group
      position={surface.origin}
      rotation={[0, surface.rotationY, 0]}
    >
      <group
        // The surface's origin sits on the gallery hang line, so a piece that
        // had to be raised to clear the floor is offset from it here.
        position={[slot.localX, slot.centreY - HANG_CENTRE_Y, 0]}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      >
        {/* Frame */}
        <mesh position={[0, 0, FRAME_DEPTH / 2]} castShadow>
          <boxGeometry args={[width + FRAME_BORDER * 2, height + FRAME_BORDER * 2, FRAME_DEPTH]} />
          <meshStandardMaterial
            color={FRAME_COLOUR}
            roughness={0.55}
            metalness={0.1}
            emissive={FRAME_COLOUR}
            emissiveIntensity={lit ? 0.45 : 0}
          />
        </mesh>

        {/* A sliver of mount board between frame and image. */}
        <mesh position={[0, 0, FRAME_DEPTH + 0.001]}>
          <planeGeometry args={[width + FRAME_BORDER, height + FRAME_BORDER]} />
          <meshBasicMaterial color={MOUNT_COLOUR} />
        </mesh>

        {/* The work.

            `key` is load-bearing. R3F assigns `material.map` as a plain prop
            and never sets `needsUpdate`, so a material first built while the
            texture was still loading has already compiled its shader without
            USE_MAP and will ignore the map forever. Re-keying on the texture
            builds a fresh material, which compiles with the map in place.

            `color` is explicit for the same family of reason: a basic material
            multiplies map by color, so leaving it to be diffed away between
            two different material shapes tints the picture — to black, as it
            turned out. One shape, always, with both props named. */}
        <mesh position={[0, 0, FRAME_DEPTH + 0.003]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            key={texture ? texture.uuid : 'unloaded'}
            map={texture ?? null}
            color={texture ? '#ffffff' : '#e4ded4'}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
