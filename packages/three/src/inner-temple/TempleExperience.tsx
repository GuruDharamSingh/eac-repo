import React from 'react';
import { SceneCanvas } from '../canvas/SceneCanvas';
import { useSceneStore } from '../store/sceneStore';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { PortalBumper } from '../bumper/PortalBumper';
import { TempleDoor } from './TempleDoor';
import { TempleRoom } from './TempleRoom';
import { TurnControls } from './TurnControls';
import { ReturnButton } from './ReturnButton';

export function TempleExperience() {
  const phase = useSceneStore((s) => s.phase);
  const setPhase = useSceneStore((s) => s.setPhase);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reduced && phase === 'bumper') setPhase('templeDoor');
  }, [reduced, phase, setPhase]);

  return (
    // 100% of the host's fixed box, not 100vh: on phones 100vh includes the
    // area under the browser toolbar and pushes the controls off-screen.
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      {/* touch-action none: swipes turn the room instead of scrolling or zooming. */}
      <SceneCanvas style={{ touchAction: 'none' }}>
        {phase === 'bumper' && <PortalBumper onComplete={() => setPhase('templeDoor')} />}
        {phase === 'templeDoor' && <TempleDoor />}
        {(phase === 'templeRoom' ||
          phase.startsWith('walkingTo:') ||
          phase.startsWith('scene:')) && <TempleRoom />}
      </SceneCanvas>
      <TurnControls />
      <ReturnButton />
    </div>
  );
}
