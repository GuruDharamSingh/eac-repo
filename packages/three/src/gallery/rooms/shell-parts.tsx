import React from 'react';
import { DoubleSide } from 'three';
import type { RoomDimensions } from '../designs';

export const WALL_COLOUR = '#eeeae4';
export const FLOOR_COLOUR = '#c9c3b9';
export const SKIRTING_COLOUR = '#3a3733';

/**
 * The four walls, each an inward-facing plane.
 *
 * Deliberately NOT a back-faced box. A box spanning the room's full height has
 * its bottom face exactly coplanar with the floor and its top face coplanar
 * with the ceiling; the depth buffer cannot separate two surfaces at the same
 * depth, so which one wins varies per pixel and per camera position. That is
 * seen as a shimmer crawling over the floor as the visitor walks — which is
 * exactly the bug this shape fixes.
 */
export function Walls({ room, exclude = [] }: { room: RoomDimensions; exclude?: string[] }) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const midY = room.height / 2;

  const walls = [
    { id: 'north', position: [0, midY, -halfD] as const, rotationY: 0, width: room.width },
    { id: 'south', position: [0, midY, halfD] as const, rotationY: Math.PI, width: room.width },
    { id: 'west', position: [-halfW, midY, 0] as const, rotationY: Math.PI / 2, width: room.depth },
    { id: 'east', position: [halfW, midY, 0] as const, rotationY: -Math.PI / 2, width: room.depth },
  ].filter((w) => !exclude.includes(w.id));

  return (
    <>
      {walls.map((wall) => (
        <mesh key={wall.id} position={wall.position} rotation={[0, wall.rotationY, 0]}>
          <planeGeometry args={[wall.width, room.height]} />
          <meshStandardMaterial color={WALL_COLOUR} roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

/** Skirting. Most of what stops a room reading as an empty box. */
export function Skirting({ room, exclude = [] }: { room: RoomDimensions; exclude?: string[] }) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;

  const edges = [
    { id: 'north', position: [0, 0.06, -halfD + 0.02] as const, rotationY: 0, length: room.width },
    { id: 'south', position: [0, 0.06, halfD - 0.02] as const, rotationY: Math.PI, length: room.width },
    { id: 'west', position: [-halfW + 0.02, 0.06, 0] as const, rotationY: Math.PI / 2, length: room.depth },
    { id: 'east', position: [halfW - 0.02, 0.06, 0] as const, rotationY: -Math.PI / 2, length: room.depth },
  ].filter((e) => !exclude.includes(e.id));

  return (
    <>
      {edges.map((edge) => (
        <mesh key={edge.id} position={edge.position} rotation={[0, edge.rotationY, 0]}>
          <planeGeometry args={[edge.length, 0.12]} />
          <meshStandardMaterial color={SKIRTING_COLOUR} roughness={0.8} side={DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/**
 * The floor.
 *
 * Rough and barely metallic on purpose: a smoother floor gives every light in
 * the room a specular highlight, and those highlights crawl and sparkle as the
 * camera moves. A gallery floor should be quiet underfoot.
 */
export function Floor({ room, colour = FLOOR_COLOUR }: { room: RoomDimensions; colour?: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial color={colour} roughness={0.96} metalness={0} />
    </mesh>
  );
}

export function Ceiling({ room, colour = '#f6f3ee' }: { room: RoomDimensions; colour?: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, room.height, 0]}>
      <planeGeometry args={[room.width, room.depth]} />
      <meshStandardMaterial color={colour} roughness={1} />
    </mesh>
  );
}

/** A free-standing wall running along X at z = 0, with skirting on both faces. */
export function CentreWall({
  length,
  height,
  thickness,
}: {
  length: number;
  height: number;
  thickness: number;
}) {
  return (
    <>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[length, height, thickness]} />
        <meshStandardMaterial color={WALL_COLOUR} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0.06, side * (thickness / 2 + 0.01)]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        >
          <planeGeometry args={[length, 0.12]} />
          <meshStandardMaterial color={SKIRTING_COLOUR} roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}
