// Remotion entry for generated word art: one still per job. Its own bundle (not
// root.tsx), so the reel templates and this cannot break each other. Bundled by
// render/wordart.mjs with apps/arts-collective/public/fonts/wordart as the
// public folder; not imported by any app.

import React from 'react';
import { AbsoluteFill, Composition, cancelRender, continueRender, delayRender, registerRoot, staticFile } from 'remotion';
import { renderGenerated, type GeneratedDesign } from '@elkdonis/studio/wordart/generated';

type Props = { design: GeneratedDesign };

const Still: React.FC<Props> = ({ design }) => {
  const host = React.useRef<HTMLDivElement>(null);
  const [handle] = React.useState(() => delayRender('word art'));
  React.useEffect(() => {
    (async () => {
      const { canvas, doc } = await renderGenerated(design, async (file) => {
        const res = await fetch(staticFile(file));
        if (!res.ok) throw new Error(`Font ${file} did not load (${res.status}).`);
        return res.arrayBuffer();
      });
      host.current!.replaceChildren(canvas);
      // The worker reads this line and keeps the design beside the picture (a Studio word-art document).
      console.debug(`WORDART_DOC ${JSON.stringify(doc)}`);
      continueRender(handle);
    })().catch(cancelRender);
  }, [design, handle]);
  return <AbsoluteFill ref={host} />;
};

const EMPTY: GeneratedDesign = {
  text: 'Word art',
  frame: '16:9',
  width: 1920,
  height: 1080,
  fonts: [{ id: 'alfa-slab', label: 'Alfa Slab One', file: 'AlfaSlabOne-Regular.ttf' }],
  look: { id: 'spectrum-ink', fill: { preset: 'spectrum' }, background: { colors: ['#14121A', '#2A2533'], angle: 150 } },
};

registerRoot(() => (
  <Composition
    id="wordart"
    component={Still as unknown as React.FC<Record<string, unknown>>}
    width={EMPTY.width}
    height={EMPTY.height}
    fps={30}
    durationInFrames={1}
    defaultProps={{ design: EMPTY }}
    calculateMetadata={({ props }) => {
      const { design } = props as unknown as Props;
      return { width: design.width, height: design.height };
    }}
  />
));
