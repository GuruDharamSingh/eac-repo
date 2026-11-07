import * as React from 'react';
import type { StudioExtension } from '../frame';
import { RecordingKind } from './RecordingKind';
import type { RecordingKindProps } from './types';

export { RecordingKind };
export type * from './types';

/** The Recordings kind, for a host's StudioShell `extensions`. */
export function recordingExtension(props: RecordingKindProps): StudioExtension {
  return { id: 'recording', label: 'Recordings', listLabel: 'Recordings', render: () => React.createElement(RecordingKind, props) };
}
