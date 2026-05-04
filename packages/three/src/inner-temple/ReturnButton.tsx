import React from 'react';
import { Html } from '@react-three/drei';
import { useSceneStore, type Direction } from '../store/sceneStore';

export function ReturnButton() {
  const phase = useSceneStore((s) => s.phase);
  const returnToRoom = useSceneStore((s) => s.returnToRoom);

  const isInScene = phase.startsWith('scene:');
  if (!isInScene) return null;

  const dir = phase.split(':')[1] as Direction;
  const labels: Record<Direction, string> = {
    east: 'Air · East',
    south: 'Fire · South',
    west: 'Water · West',
    north: 'Earth · North',
  };

  return (
    <Html fullscreen>
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'all',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
          {labels[dir]}
        </span>
        <button
          onClick={returnToRoom}
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff',
            padding: '0.5rem 1.25rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(8px)',
          }}
        >
          ← Return to Temple
        </button>
      </div>
    </Html>
  );
}
