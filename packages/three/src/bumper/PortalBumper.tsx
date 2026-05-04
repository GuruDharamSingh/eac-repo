import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, PlaneGeometry } from 'three';

const DURATION = 2.5;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  varying vec2 vUv;

  // Simplex-like noise helpers
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865, 0.366025404, -0.577350269, 0.024390244);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291 - 0.85373473 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x   + h.x  * x0.y;
    g.yz = a0.yz * x12.xz  + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    // Whirlpool warp
    float swirl = uProgress * 6.0;
    float warpedAngle = angle + dist * swirl + uTime * (1.0 - uProgress) * 2.0;
    vec2 warped = vec2(cos(warpedAngle), sin(warpedAngle)) * dist + 0.5;

    // Layered noise on warped coords
    float n  = snoise(warped * 4.0 + uTime * 0.5) * 0.5 + 0.5;
         n += snoise(warped * 8.0 - uTime * 0.3) * 0.25;
         n += snoise(warped * 16.0 + uTime * 0.1) * 0.125;
    n = clamp(n, 0.0, 1.0);

    // Posterize for low-res sprite feel
    n = floor(n * 5.0) / 5.0;

    // Radial collapse: dissolve toward center as progress increases
    float collapse = 1.0 - smoothstep(uProgress * 0.8, uProgress, dist);
    n *= collapse;

    // Purple/indigo/cyan portal palette
    vec3 col1 = vec3(0.05, 0.0, 0.15);  // deep void
    vec3 col2 = vec3(0.4, 0.0, 0.8);   // purple
    vec3 col3 = vec3(0.0, 0.6, 1.0);   // cyan
    vec3 color = mix(col1, mix(col2, col3, n), n);

    // Rim glow
    float rim = smoothstep(0.48, 0.5, dist) * (1.0 - uProgress);
    color += rim * vec3(0.5, 0.2, 1.0);

    // Fade out at end
    float alpha = 1.0 - smoothstep(0.85, 1.0, uProgress);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

interface PortalBumperProps {
  onComplete: () => void;
}

export function PortalBumper({ onComplete }: PortalBumperProps) {
  const matRef = useRef<ShaderMaterial>(null!);
  const elapsed = useRef(0);
  const done = useRef(false);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uTime: { value: 0 },
  }), []);

  useFrame((_state, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const progress = Math.min(elapsed.current / DURATION, 1);
    matRef.current.uniforms.uProgress.value = progress;
    matRef.current.uniforms.uTime.value = elapsed.current;
    if (progress >= 1) {
      done.current = true;
      onComplete();
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
