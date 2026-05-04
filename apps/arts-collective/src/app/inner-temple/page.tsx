'use client';

import dynamic from 'next/dynamic';
import { useWebGLFallback } from '@elkdonis/three';

const TempleExperience = dynamic(
  () => import('@elkdonis/three').then((m) => ({ default: m.TempleExperience })),
  { ssr: false },
);

function NoWebGL() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#a08060',
        fontFamily: 'serif',
        textAlign: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <div style={{ fontSize: '3rem' }}>☽ ♁ ☽</div>
      <h1 style={{ fontWeight: 'normal', letterSpacing: '0.2em' }}>Inner Temple</h1>
      <p style={{ opacity: 0.6, maxWidth: 360 }}>
        Your browser does not support WebGL. The temple requires a modern browser with hardware acceleration enabled.
      </p>
    </div>
  );
}

export default function InnerTemplePage() {
  const noWebGL = useWebGLFallback();
  if (noWebGL) return <NoWebGL />;
  return <TempleExperience />;
}
