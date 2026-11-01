import { keyDirection, tintRoom, type SceneLighting } from './lighting';
import type { V3, Venue } from './venue';

/** How far out a compass key light stands; a directional light only uses the direction. */
const KEY_DISTANCE = 12;

/**
 * The room's background and lights: the venue's rig (`Venue.lights`) with an
 * installation's `SceneLighting` applied. At the default settings this draws
 * exactly what each shell used to draw itself.
 *
 * The number and kind of lights never change with the settings, only their
 * values, so a slider never recompiles a shader.
 */
export function SceneLights({ venue, lighting }: { venue: Venue; lighting: SceneLighting }) {
  const rig = venue.lights;
  const { brightness, warmth, keyStrength } = lighting;
  const keyPosition: V3 | null = rig.key
    ? lighting.keyFrom === 'venue'
      ? rig.key.position
      : (keyDirection(lighting.keyFrom, lighting.keyHeight).map((v) => v * KEY_DISTANCE) as V3)
    : null;

  return (
    <>
      <color attach="background" args={[lighting.background ?? rig.background]} />
      {rig.hemisphere && (
        <hemisphereLight
          color={tintRoom(rig.hemisphere.sky, warmth)}
          groundColor={tintRoom(rig.hemisphere.ground, warmth)}
          intensity={rig.hemisphere.intensity * brightness}
        />
      )}
      {rig.ambient && <ambientLight color={tintRoom(rig.ambient.color, warmth)} intensity={rig.ambient.intensity * brightness} />}
      {rig.key && keyPosition && (
        <directionalLight
          position={keyPosition}
          color={tintRoom(rig.key.color, warmth)}
          intensity={rig.key.intensity * brightness * keyStrength}
        />
      )}
    </>
  );
}
