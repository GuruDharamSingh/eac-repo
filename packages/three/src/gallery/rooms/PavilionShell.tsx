import React from 'react';
import { DoubleSide } from 'three';
import { CentreWall, Ceiling, Floor, Skirting, Walls } from './shell-parts';
import { PAVILION } from '../designs';

const GLASS = '#dfe9ea';
const MULLION = '#2e2c29';
const GROUND = '#8d9c72';
const SKY_TOP = '#6f9dc4';
const SKY_BASE = '#cfdce6';

/** Bays of glazing across the open elevation; the middle two are the doors. */
const BAYS = 7;

/**
 * The pavilion: a tall daylit hall whose south elevation is glass and doors
 * onto open ground.
 *
 * The light is the difference, not just the ceiling height. A sealed room has
 * to be lit by fittings aimed at the work; here a low sun comes through the
 * glazing and falls across it, which is why the same painting reads warmer and
 * more three-dimensional in this room than in the hall.
 */
export function PavilionShell() {
  const { room, centreWall } = PAVILION;
  const halfW = room.width / 2;
  const halfD = room.depth / 2;

  const bayWidth = room.width / BAYS;
  const doorBays = [Math.floor(BAYS / 2) - 1, Math.floor(BAYS / 2), Math.floor(BAYS / 2) + 1];

  return (
    <>
      {/* Sky as the scene's own background, not geometry. Two hemispheres of
          different colours would meet in a visible seam; a background cannot.
          The fog then does the gradient honestly, fading the ground into the
          same colour at the horizon — it starts well beyond the far wall, so
          nothing inside the room is touched by it. */}
      <color attach="background" args={[SKY_BASE]} />
      <fog attach="fog" args={[SKY_BASE, 45, 210]} />

      {/* The grounds, reaching past the glazing to the horizon. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>

      {/* Daylight: a low sun through the glazing, plus sky fill. Warmer and
          far more directional than the hall's downlights. */}
      <hemisphereLight args={[SKY_TOP, GROUND, 1.1]} />
      <ambientLight intensity={0.34} color="#eaf1ff" />
      <directionalLight
        position={[6, 9, 26]}
        intensity={2.4}
        color="#fff2dc"
      />
      {/* A dimmer bounce from deep in the room so the far wall is not a hole. */}
      <directionalLight position={[-4, 6, -18]} intensity={0.5} color="#e8eef6" />

      <Floor room={room} colour="#cfc9bd" />
      <Ceiling room={room} colour="#f2efe9" />
      {/* South is glass; it gets no wall and no skirting. */}
      <Walls room={room} exclude={['south']} />
      <Skirting room={room} exclude={['south']} />

      {/* The glazed elevation. */}
      <group position={[0, 0, halfD]}>
        {Array.from({ length: BAYS }, (_, i) => {
          const x = -halfW + bayWidth * (i + 0.5);
          const isDoor = doorBays.includes(i);
          return (
            <React.Fragment key={i}>
              {/* Glass. Doors stand open, so their bays are left clear. */}
              {!isDoor && (
                <mesh position={[x, room.height / 2, 0]}>
                  <planeGeometry args={[bayWidth - 0.12, room.height - 0.2]} />
                  <meshPhysicalMaterial
                    color={GLASS}
                    transmission={0.94}
                    thickness={0.02}
                    roughness={0.06}
                    ior={1.45}
                    transparent
                    opacity={0.24}
                    depthWrite={false}
                    side={DoubleSide}
                  />
                </mesh>
              )}
              {/* Mullion between bays. */}
              <mesh position={[x - bayWidth / 2, room.height / 2, 0]}>
                <boxGeometry args={[0.12, room.height, 0.22]} />
                <meshStandardMaterial color={MULLION} roughness={0.6} />
              </mesh>
            </React.Fragment>
          );
        })}
        {/* Closing mullion and the head beam over the whole opening. */}
        <mesh position={[halfW, room.height / 2, 0]}>
          <boxGeometry args={[0.12, room.height, 0.22]} />
          <meshStandardMaterial color={MULLION} roughness={0.6} />
        </mesh>
        <mesh position={[0, room.height - 0.06, 0]}>
          <boxGeometry args={[room.width, 0.24, 0.3]} />
          <meshStandardMaterial color={MULLION} roughness={0.6} />
        </mesh>
      </group>

      {/* A step and apron outside the doors, so the threshold reads as one. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, halfD + 3]}>
        <planeGeometry args={[room.width, 6]} />
        <meshStandardMaterial color="#b9b3a7" roughness={0.95} />
      </mesh>

      {centreWall && <CentreWall {...centreWall} />}
    </>
  );
}
