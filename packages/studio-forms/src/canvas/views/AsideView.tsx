'use client';

import * as React from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools } from './BlockChrome';

/** A margin note. In the canvas it sits in the flow with a label; on the page it goes to the margin at a wide viewport. */
export function AsideView({ deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__aside ${selected ? 'is-selected' : ''}`}>
      <BlockTools onRemove={deleteNode} />
      <aside className="eac-aside">
        <span className="studio-cv__label" contentEditable={false}>
          Aside · in the margin on a wide screen
        </span>
        <NodeViewContent as="p" />
      </aside>
    </NodeViewWrapper>
  );
}
