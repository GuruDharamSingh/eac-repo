'use client';

import * as React from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools, WidthToggle } from './BlockChrome';

export function PullQuoteView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const width = node.attrs.width === 'wide' ? 'wide' : 'content';
  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__pull is-${width} ${selected ? 'is-selected' : ''}`}>
      <WidthToggle value={width} allow={['content', 'wide']} onChange={(w) => updateAttributes({ width: w })} />
      <BlockTools onRemove={deleteNode} />
      <blockquote className="eac-pull">
        <NodeViewContent as="p" />
        <input
          className="studio-cv__cite"
          value={node.attrs.attribution ?? ''}
          placeholder="Attribution (optional)"
          aria-label="Attribution"
          onChange={(e) => updateAttributes({ attribution: e.target.value })}
        />
      </blockquote>
    </NodeViewWrapper>
  );
}
