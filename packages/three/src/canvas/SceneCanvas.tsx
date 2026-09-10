import React, { Suspense } from 'react';
import { Canvas, type CanvasProps } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace, type WebGLRendererParameters } from 'three';

/**
 * R3F's own `camera` prop is a union that also accepts a constructed camera
 * instance, which cannot be merged with defaults — this is the plain-props
 * half of it.
 */
export interface SceneCameraProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;
}

export interface SceneCanvasProps
  extends Omit<CanvasProps, 'children' | 'gl' | 'camera'> {
  children: React.ReactNode;
  gl?: WebGLRendererParameters;
  camera?: SceneCameraProps;
  /** Shown while suspended children (textures, lazy geometry) load. */
  fallback?: React.ReactNode;
}

export function SceneCanvas({
  children,
  fallback = null,
  style,
  gl,
  camera,
  ...canvasProps
}: SceneCanvasProps) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%', ...style }}
      dpr={[1, 2]}
      gl={{
        antialias: false,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
        ...gl,
      }}
      camera={{ position: [0, 0, 5], fov: 60, near: 0.1, far: 1000, ...camera }}
      {...canvasProps}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </Canvas>
  );
}
