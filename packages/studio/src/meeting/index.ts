import * as React from 'react';
import type { StudioExtension } from '../frame';
import { MeetingKind } from './MeetingKind';
import type { MeetingKindProps } from './types';

export { MeetingKind };
export type * from './types';

/** The Meetings kind, for a host's StudioShell `extensions`. */
export function meetingExtension(props: MeetingKindProps): StudioExtension {
  return { id: 'meeting', label: 'Meetings', listLabel: 'Meetings', render: () => React.createElement(MeetingKind, props) };
}
