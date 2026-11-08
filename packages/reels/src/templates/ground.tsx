// ============================================================================
// A reel's gradient ground (@elkdonis/gradients, 2026-11-07).
//
// Drawn behind a template's content (the parent sets isolation: isolate, the
// ground sits at z-index -1), driven by Remotion's frame so a render is
// deterministic. Our own shaders draw synchronously per frame; Paper Shaders
// load lazily, which a frame-by-frame render can't wait for, so a Paper preset
// shows its CSS version here.
// ============================================================================
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { isPaperShader, type GradientSpec } from '@elkdonis/gradients';
import { GradientBackground } from '@elkdonis/gradients/react';

export function ReelGround({ gradient }: { gradient?: GradientSpec }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!gradient) return null;
  const spec: GradientSpec = { ...gradient, paper: 0, shader: isPaperShader(gradient.shader) ? 'none' : gradient.shader };
  return <GradientBackground value={spec} frame={(frame / fps) * 1000} style={{ position: 'absolute', inset: 0, zIndex: -1 }} />;
}
