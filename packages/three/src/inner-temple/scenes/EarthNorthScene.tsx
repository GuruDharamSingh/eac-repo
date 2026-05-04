import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, Sparkles } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Color, FogExp2, ShaderMaterial } from 'three';

const mountainVert = /* glsl */ `
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i); float b = hash(i+vec2(1,0));
    float c = hash(i+vec2(0,1)); float d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    float h  = noise(pos.xz * 0.3 + uSeed) * 4.0;
         h += noise(pos.xz * 0.7 + uSeed * 1.3) * 2.0;
         h += noise(pos.xz * 1.5 + uSeed * 0.7) * 0.8;
    pos.y += h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const mountainFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec3 rock = vec3(0.12, 0.12, 0.16);
    vec3 snow = vec3(0.85, 0.88, 0.95);
    vec3 col = mix(rock, snow, smoothstep(0.4, 0.7, vUv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Mountains() {
  const matRef = useRef<ShaderMaterial>(null!);
  const uniforms = useMemo(() => ({ uSeed: { value: 42.7 } }), []);

  return (
    <mesh position={[0, -1, -20]}>
      <planeGeometry args={[60, 20, 40, 20]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={mountainVert}
        fragmentShader={mountainFrag}
        uniforms={uniforms}
        side={2}
      />
    </mesh>
  );
}

export function EarthNorthScene() {
  const { scene } = useThree();
  React.useEffect(() => {
    const prevBg = scene.background;
    scene.background = new Color('#020408');
    scene.fog = new FogExp2('#020408', 0.025);
    return () => {
      scene.background = prevBg;
      scene.fog = null;
    };
  }, [scene]);

  return (
    <>
      <Stars radius={80} depth={50} count={2000} factor={4} saturation={0} fade speed={0.3} />
      <ambientLight intensity={0.08} color="#8090c0" />
      {/* Moon */}
      <mesh position={[-8, 10, -25]}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial emissive="#d0d8e8" emissiveIntensity={1.5} color="#c0c8d8" />
      </mesh>
      <pointLight position={[-8, 10, -25]} intensity={3} color="#c0d0ff" distance={80} />

      {/* Snow ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#d0d8e8" roughness={0.9} />
      </mesh>

      <Mountains />

      {/* Snowfall */}
      <Sparkles
        count={200}
        scale={[20, 10, 20]}
        size={1.5}
        speed={0.05}
        opacity={0.7}
        color="#e0eaf8"
        noise={0.2}
      />
    </>
  );
}
