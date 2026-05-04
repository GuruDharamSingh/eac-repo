import React from 'react';
import { SceneCanvas } from '../canvas/SceneCanvas';
import { useSceneStore } from '../store/sceneStore';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { PortalBumper } from '../bumper/PortalBumper';
import { TempleDoor } from './TempleDoor';
import { TempleRoom } from './TempleRoom';

export function TempleExperience() {
  const phase = useSceneStore((s) => s.phase);
  const setPhase = useSceneStore((s) => s.setPhase);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reduced && phase === 'bumper') setPhase('templeDoor');
  }, [reduced, phase, setPhase]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <SceneCanvas>
        {phase === 'bumper' && <PortalBumper onComplete={() => setPhase('templeDoor')} />}
        {phase === 'templeDoor' && <TempleDoor />}
        {(phase === 'templeRoom' ||
          phase.startsWith('walkingTo:') ||
          phase.startsWith('scene:')) && <TempleRoom />}
      </SceneCanvas>
    </div>
  );
}
