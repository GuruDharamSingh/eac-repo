import React, { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';

const ZODIAC_COLORS = [
  '#ff4444', '#cc8844', '#ffee44', '#44ee44',
  '#44aaff', '#8844ff', '#ff44aa', '#ff8844',
  '#44ffee', '#8888ff', '#ffaaee', '#aaffaa',
];

const STAR_RADIUS = 4.8;
const CEILING_Y = 5.5;

function ConstellationPoints({ sectorIndex }: { sectorIndex: number }) {
  const geometry = useMemo(() => {
    const angle0 = (sectorIndex / 12) * Math.PI * 2;
    const angle1 = ((sectorIndex + 1) / 12) * Math.PI * 2;
    const positions: number[] = [];
    // Seed deterministically by sector so it's stable across renders
    const seed = sectorIndex * 137.5;
    const count = 5 + (sectorIndex % 4) + 3;
    for (let i = 0; i < count; i++) {
      const t = (Math.sin(seed + i * 31.7) * 0.5 + 0.5);
      const a = angle0 + t * (angle1 - angle0);
      const r = 1.2 + (Math.sin(seed + i * 17.3) * 0.5 + 0.5) * 2.8;
      positions.push(Math.cos(a) * r, CEILING_Y - 0.05, Math.sin(a) * r);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [sectorIndex]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color={ZODIAC_COLORS[sectorIndex]} size={0.08} sizeAttenuation />
    </points>
  );
}

export function ZodiacCeiling() {
  return (
    <group>
      {/* Dark ceiling disc */}
      <mesh position={[0, CEILING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STAR_RADIUS + 0.5, 12]} />
        <meshStandardMaterial color="#050508" roughness={1} />
      </mesh>

      {Array.from({ length: 12 }, (_, i) => {
        const midAngle = ((i + 0.5) / 12) * Math.PI * 2;
        const divAngle = (i / 12) * Math.PI * 2;

        return (
          <group key={i}>
            <ConstellationPoints sectorIndex={i} />

            {/* Sector divider — thin radial bar */}
            <mesh
              position={[
                Math.cos(divAngle) * (STAR_RADIUS / 2),
                CEILING_Y - 0.04,
                Math.sin(divAngle) * (STAR_RADIUS / 2),
              ]}
              rotation={[-Math.PI / 2, 0, -divAngle]}
            >
              <planeGeometry args={[0.015, STAR_RADIUS]} />
              <meshBasicMaterial color="#2a2050" />
            </mesh>

            {/* Sector marker — tiny glowing sphere at outer rim */}
            <mesh
              position={[
                Math.cos(midAngle) * (STAR_RADIUS - 0.3),
                CEILING_Y - 0.1,
                Math.sin(midAngle) * (STAR_RADIUS - 0.3),
              ]}
            >
              <sphereGeometry args={[0.07, 6, 6]} />
              <meshStandardMaterial
                color={ZODIAC_COLORS[i]}
                emissive={ZODIAC_COLORS[i]}
                emissiveIntensity={1.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
