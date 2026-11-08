import * as React from 'react';
import type { StudioExtension } from '../frame';
import { WordArtKind, type WordArtFont, type WordArtKindProps } from './WordArtKind';

export { WordArtKind };
export type { WordArtFont, WordArtKindProps };
export type { WordArtDoc, MarkSource } from './doc';

/** The Word art kind, for a host's StudioShell `extensions`. */
export function wordartExtension(props: WordArtKindProps): StudioExtension {
  return { id: 'wordart', label: 'Word art', listLabel: 'Designs', render: () => React.createElement(WordArtKind, props) };
}
