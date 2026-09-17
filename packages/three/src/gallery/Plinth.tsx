import { useMemo, useState } from 'react';
import { Billboard, useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Texture } from 'three';
import { PLINTH, viewpointForPlinth } from './room';
import { HALL, type RoomDesign } from './designs';
import { SplatObject } from './SplatObject';
import { useGalleryStore } from './store';
import type { PlinthSlot } from './types';

const BASE_COLOUR = '#f4f1ec';
const BASE_EDGE = '#d9d3c9';
const CLICK_TRAVEL_LIMIT = 10;

/** Longest edge of the object shown inside the case. */
const OBJECT_SIZE = 0.3;

export interface PlinthProps {
  slot: PlinthSlot;
  texture: Texture | null;
  design?: RoomDesign;
}

/**
 * A plinth under a glass case, for work that is not wall-hung — jewellery,
 * small sculpture, anything held rather than framed. Hanging a necklace flat
 * on a wall reads as a mistake; standing it in a vitrine is what a gallery
 * would actually do, and it gives the two bays something to walk around.
 *
 * The piece is a photograph, so it is billboarded to face the visitor: a flat
 * plane on a turntable spends half its time edge-on and invisible.
 */
export function Plinth({ slot, texture, design = HALL }: PlinthProps) {
  const [hovered, setHovered] = useState(false);
  const approach = useGalleryStore((s) => s.approach);
  const setHoveredId = useGalleryStore((s) => s.setHoveredId);
  const selectedId = useGalleryStore((s) => s.selected?.id ?? null);
  useCursor(hovered);

  const { width, height } = useMemo(() => {
    const image = texture?.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    return aspect >= 1
      ? { width: OBJECT_SIZE, height: OBJECT_SIZE / aspect }
      : { width: OBJECT_SIZE * aspect, height: OBJECT_SIZE };
  }, [texture]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TRAVEL_LIMIT) return;
    event.stopPropagation();
    approach(slot.piece, viewpointForPlinth(slot, design));
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
  const caseY = PLINTH.baseHeight + PLINTH.caseHeight / 2;

  return (
    <group position={slot.position} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      {/* Base */}
      <mesh position={[0, PLINTH.baseHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[PLINTH.baseWidth, PLINTH.baseHeight, PLINTH.baseWidth]} />
        <meshStandardMaterial color={BASE_COLOUR} roughness={0.7} />
      </mesh>

      {/* A darker lip where the case meets the base, so the two read apart. */}
      <mesh position={[0, PLINTH.baseHeight - 0.015, 0]}>
        <boxGeometry args={[PLINTH.baseWidth + 0.02, 0.03, PLINTH.baseWidth + 0.02]} />
        <meshStandardMaterial color={BASE_EDGE} roughness={0.6} />
      </mesh>

      {/* Vitrine. Drawn last-ish and never receiving clicks itself, so the
          object inside stays the thing you are pointing at. */}
      <mesh position={[0, caseY, 0]} raycast={() => null}>
        <boxGeometry args={[PLINTH.baseWidth - 0.04, PLINTH.caseHeight, PLINTH.baseWidth - 0.04]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.92}
          thickness={0.02}
          roughness={0.05}
          ior={1.45}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      {/* A small downlight in the case lid. */}
      <pointLight
        position={[0, PLINTH.baseHeight + PLINTH.caseHeight - 0.06, 0]}
        intensity={lit ? 1.6 : 0.7}
        distance={1.2}
        color="#fff4e2"
      />

      {slot.piece.splatUrl ? (
        // A real capture of the object, which needs no billboarding: it has
        // actual sides to walk around, which is the entire reason to have one.
        <SplatObject
          src={slot.piece.splatUrl}
          position={[0, PLINTH.displayY, 0]}
          size={OBJECT_SIZE * 1.6}
        />
      ) : (
        <Billboard follow lockX lockZ position={[0, PLINTH.displayY, 0]}>
          <mesh>
            <planeGeometry args={[width, height]} />
            {/* Re-keyed and explicitly coloured for the reason spelled out in
                HangingPiece: R3F never flags a material for recompilation, so a
                map assigned after first render is silently ignored. */}
            <meshBasicMaterial
              key={texture ? texture.uuid : 'unloaded'}
              map={texture ?? null}
              color={texture ? '#ffffff' : '#e4ded4'}
              toneMapped={false}
              transparent
            />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}
