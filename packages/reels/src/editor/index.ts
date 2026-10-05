import * as React from 'react';
import type { StudioExtension } from '@elkdonis/studio/frame';
import { VideoKind } from './VideoKind';
import type { VideoKindProps } from './types';

export { VideoKind };
export type * from './types';

/** The Video kind, for a host's StudioShell `extensions`. */
export function videoExtension(props: VideoKindProps): StudioExtension {
  return { id: 'video', label: 'Video', listLabel: 'Reels', render: () => React.createElement(VideoKind, props) };
}
