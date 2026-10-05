// Remotion entry: registers every template as a composition. Bundled by the
// reel-render container (render/render.mjs); not imported by any app.

import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { REEL_TEMPLATES } from './templates';
import type { ReelInput } from './types';

const Root: React.FC = () => (
  <>
    {Object.values(REEL_TEMPLATES).map((t) => (
      <Composition
        key={t.id}
        id={t.id}
        // Composition is typed over Record<string, unknown> props; the
        // templates take ReelInput.
        component={t.component as unknown as React.FC<Record<string, unknown>>}
        fps={t.fps}
        width={t.width}
        height={t.height}
        durationInFrames={1}
        defaultProps={{ edit: { template: t.id }, urls: {} } satisfies ReelInput}
        calculateMetadata={({ props }) => ({ durationInFrames: t.durationInFrames(props as unknown as ReelInput) })}
      />
    ))}
  </>
);

registerRoot(Root);
