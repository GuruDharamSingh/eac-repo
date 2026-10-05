import React from 'react';
import { useSceneStore } from '../store/sceneStore';

const LABELS = { east: 'East', south: 'South', west: 'West', north: 'North' } as const;

const buttonStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: '#fff',
  width: '2.75rem',
  height: '2.75rem',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: '1.1rem',
  backdropFilter: 'blur(8px)',
};

/**
 * Quarter-turn controls for the temple room. Plain DOM beside the canvas, not
 * drei <Html>, so the overlay never sits over the doors and swallows clicks.
 * Keyboard turning lives in CameraDirector.
 */
export function TurnControls() {
  const phase = useSceneStore((s) => s.phase);
  const facing = useSceneStore((s) => s.facing);
  const turn = useSceneStore((s) => s.turn);
  if (phase !== 'templeRoom') return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <button type="button" aria-label="Turn left" onClick={() => turn(-1)} style={buttonStyle}>
        ←
      </button>
      <span
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          minWidth: '4rem',
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        {LABELS[facing]}
      </span>
      <button type="button" aria-label="Turn right" onClick={() => turn(1)} style={buttonStyle}>
        →
      </button>
    </div>
  );
}
