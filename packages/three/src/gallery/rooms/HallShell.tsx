import React from 'react';
import { CentreWall, Ceiling, Floor, Skirting, Walls } from './shell-parts';
import { HALL } from '../designs';

const LIGHT_ROWS = [-HALL.room.depth / 4, HALL.room.depth / 4];

/**
 * The enclosed hall: four walls, a ceiling of light panels, and the
 * free-standing wall down the middle.
 */
export function HallShell() {
  const { room, centreWall } = HALL;

  return (
    <>
      {/* Even, directionless fill is what a gallery actually feels like, and it
          keeps every wall legible no matter where the visitor is standing. */}
      <ambientLight intensity={0.85} color="#fffaf2" />
      <hemisphereLight args={['#ffffff', '#b8ae9f', 0.55]} />

      {LIGHT_ROWS.map((z) => (
        <React.Fragment key={z}>
          <spotLight
            position={[-room.width / 4, room.height - 0.3, z]}
            angle={0.9}
            penumbra={0.8}
            intensity={28}
            distance={16}
            color="#fff6e8"
          />
          <spotLight
            position={[room.width / 4, room.height - 0.3, z]}
            angle={0.9}
            penumbra={0.8}
            intensity={28}
            distance={16}
            color="#fff6e8"
          />
          {/* The fittings themselves, so the ceiling is not a blank slab. */}
          <mesh position={[0, room.height - 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[room.width - 4, 0.5]} />
            <meshBasicMaterial color="#fffdf8" />
          </mesh>
        </React.Fragment>
      ))}

      <Floor room={room} />
      <Ceiling room={room} />
      <Walls room={room} />
      <Skirting room={room} />

      {centreWall && <CentreWall {...centreWall} />}
    </>
  );
}
