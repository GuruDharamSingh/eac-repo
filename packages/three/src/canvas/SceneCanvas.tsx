import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

interface SceneCanvasProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function SceneCanvas({ children, style, className }: SceneCanvasProps) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      dpr={[1, 2]}
      gl={{
        antialias: false,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 1000 }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
