import * as React from 'react';
import type { StudioExtension } from '../frame';
import { CreateKind, PipelineNav } from './CreateKind';
import type { CreateKindProps } from './types';

export { CreateKind, PipelineNav };
export type * from './types';

/**
 * Create (canvas A, 2026-11-14), for a host's StudioShell `extensions`: New, Bring in, the
 * Library with Make into, Products and the brand kit. Opened at `/studio?kind=create`.
 */
export function createExtension(props: CreateKindProps): StudioExtension {
  return { id: 'create', label: 'Create', listLabel: 'Create', render: () => React.createElement(CreateKind, props) };
}
