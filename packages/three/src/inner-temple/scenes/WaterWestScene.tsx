import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Sparkles } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { FogExp2, ShaderMaterial } from 'three';

const waterVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 0.8 + uTime * 0.8) * 0.12
           + sin(pos.z * 0.6 + uTime * 0.6) * 0.08;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float wave = sin(uv.x * 12.0 + uTime * 1.2) * 0.5 + 0.5;
    wave *= sin(uv.y * 8.0 - uTime * 0.8) * 0.5 + 0.5;
    vec3 deep = vec3(0.05, 0.15, 0.35);
    vec3 shallow = vec3(0.2, 0.45, 0.6);
    vec3 col = mix(deep, shallow, wave * 0.6);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Ocean() {
  const matRef = useRef<ShaderMaterial>(null!);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
      <planeGeometry args={[60, 60, 30, 30]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={waterVert}
        fragmentShader={waterFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function WaterWestScene() {
  const { scene } = useThree();
  React.useEffect(() => {
    scene.fog = new FogExp2('#c08060', 0.02);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[-1, 0.15, 0]}
        inclination={0.52}
        azimuth={0.75}
        turbidity={8}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <ambientLight intensity={0.6} color="#e08040" />
      <directionalLight position={[-5, 3, 0]} intensity={1.5} color="#ff9050" />

      <Ocean />

      {/* Shore sand strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 8]}>
        <planeGeometry args={[30, 6]} />
        <meshStandardMaterial color="#c0a070" roughness={1} />
      </mesh>

      {/* Gull silhouette particles */}
      <Sparkles
        count={15}
        scale={[20, 5, 10]}
        size={4}
        speed={0.15}
        opacity={0.4}
        color="#1a1a2a"
      />
    </>
  );
}
