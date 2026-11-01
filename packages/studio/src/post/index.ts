import * as React from 'react';
import type { StudioExtension } from '../frame';
import { PostKind } from './PostKind';
import type { PostKindProps } from './types';

export { PostKind };
export type * from './types';

/** The Post kind, for a host's StudioShell `extensions`. */
export function postExtension(props: PostKindProps): StudioExtension {
  return { id: 'post', label: 'Posts', listLabel: 'Posts', render: () => React.createElement(PostKind, props) };
}
