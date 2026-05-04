import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Vector3 } from 'three';
import type { Mesh } from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uBlowStrength;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Wave motion — fixed top edge (y near 1.5), free bottom
    float factor = (pos.y + 1.5) / 3.0; // 0 at bottom, 1 at top
    float pinned = 1.0 - factor;
    pos.z += sin(pos.x * 2.0 + uTime * 2.0) * 0.08 * pinned * uBlowStrength;
    pos.x += cos(pos.y * 1.5 + uTime * 1.5) * 0.04 * pinned * uBlowStrength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    // Fabric weave-ish vignette
    float edge = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);
    edge *= smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.98, vUv.y);
    gl_FragColor = vec4(uColor, uOpacity * edge);
  }
`;

interface DrapePros {
  color: string;
  blowStrength?: number;
}

export function Drape({ color, blowStrength = 1.0 }: DrapePros) {
  const meshRef = useRef<Mesh>(null!);
  const { camera } = useThree();

  const parsedColor = useMemo(() => {
    const c = new Color(color);
    return new Vector3(c.r, c.g, c.b);
  }, [color]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBlowStrength: { value: blowStrength },
    uColor: { value: parsedColor },
    uOpacity: { value: 0.85 },
  }), [blowStrength, parsedColor]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    const worldPos = meshRef.current.getWorldPosition(new Vector3());
    const dist = worldPos.distanceTo(camera.position);
    uniforms.uBlowStrength.value = blowStrength + Math.max(0, (3 - dist) * 0.5);
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1.8, 3.0, 12, 20]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={2}
        depthWrite={false}
      />
    </mesh>
  );
}
