'use client';

import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools } from './BlockChrome';

const STYLES: Array<['ornament' | 'rule' | 'space', string]> = [
  ['ornament', '· · ·'],
  ['rule', 'Rule'],
  ['space', 'Space'],
];

export function DividerView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const style = node.attrs.style ?? 'ornament';
  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__divider ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <BlockTools onRemove={deleteNode}>
        {STYLES.map(([s, label]) => (
          <button key={s} type="button" aria-pressed={style === s} onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ style: s })}>
            {label}
          </button>
        ))}
      </BlockTools>
      <hr className={`eac-divider eac-divider--${style}`} />
    </NodeViewWrapper>
  );
}
