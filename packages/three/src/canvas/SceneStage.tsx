'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SceneCanvas, type SceneCanvasProps } from './SceneCanvas';
import { useWebGLFallback } from '../hooks/useWebGLFallback';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface SceneStageProps extends Omit<SceneCanvasProps, 'children' | 'frameloop'> {
  children: React.ReactNode;
  /** Height of the stage. Number is treated as pixels. */
  height?: number | string;
  className?: string;
  containerStyle?: React.CSSProperties;
  /** Drawn above the canvas — score readouts, start buttons, captions. */
  overlay?: React.ReactNode;
  /** Replaces the canvas entirely when WebGL is unavailable. */
  webglFallback?: React.ReactNode;
  /** Replaces the canvas when the visitor asked for reduced motion. */
  reducedMotionFallback?: React.ReactNode;
  /** Keep the frame loop running while scrolled out of view. */
  renderOffscreen?: boolean;
}

/**
 * The standard host for a 3D piece embedded in an ordinary content page.
 *
 * A page may carry several of these, so each one creates its WebGL context
 * only once it has been scrolled to, and parks its frame loop whenever it
 * leaves the viewport — otherwise every stage on the page renders forever and
 * they compete for the GPU (and for the browser's context limit) all at once.
 */
export function SceneStage({
  children,
  height = 420,
  className,
  containerStyle,
  overlay,
  webglFallback = null,
  reducedMotionFallback,
  renderOffscreen = false,
  ...canvasProps
}: SceneStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [everSeen, setEverSeen] = useState(false);
  const noWebGL = useWebGLFallback();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        setInView(visible);
        if (visible) setEverSeen(true);
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showCanvas =
    !noWebGL && !(reducedMotion && reducedMotionFallback !== undefined) && everSeen;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        overflow: 'hidden',
        ...containerStyle,
      }}
    >
      {noWebGL
        ? webglFallback
        : reducedMotion && reducedMotionFallback !== undefined
          ? reducedMotionFallback
          : showCanvas && (
              <SceneCanvas frameloop={inView || renderOffscreen ? 'always' : 'never'} {...canvasProps}>
                {children}
              </SceneCanvas>
            )}
      {overlay}
    </div>
  );
}
