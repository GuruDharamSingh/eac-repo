'use client';

import * as React from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools } from './BlockChrome';
import { useUpload } from './upload';

/** A picture beside text. Side and share are attributes; the text is the node's content. */
export function FigureTextView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as { src: string | null; alt: string; caption: string; side: 'left' | 'right'; share: number; naturalWidth: number | null };
  const { pick, uploading } = useUpload((src) => updateAttributes({ src }));
  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__figtext ${selected ? 'is-selected' : ''}`}>
      <BlockTools onRemove={deleteNode}>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ side: a.side === 'left' ? 'right' : 'left' })}>
          Picture {a.side === 'left' ? 'right' : 'left'}
        </button>
        {[40, 50, 60].map((s) => (
          <button key={s} type="button" aria-pressed={a.share === s} onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ share: s })}>
            {s}%
          </button>
        ))}
      </BlockTools>
      <figure className={`eac-figtext eac-figtext--${a.side}`} style={{ ['--share' as string]: `${a.share}%` }}>
        <div className="studio-cv__pic studio-cv__figtext-pic" contentEditable={false}>
          {a.src ? (
            <img
              src={a.src}
              alt={a.alt}
              draggable={false}
              onLoad={(e) => !a.naturalWidth && updateAttributes({ naturalWidth: e.currentTarget.naturalWidth, naturalHeight: e.currentTarget.naturalHeight })}
            />
          ) : (
            <button type="button" className="studio-cv__pickbtn" onClick={pick} disabled={uploading}>
              {uploading ? 'Uploading…' : '▣ Choose a picture'}
            </button>
          )}
        </div>
        <div className="eac-figtext__text">
          <NodeViewContent as="p" />
        </div>
        <div contentEditable={false}>
          <input className="studio-cv__caption" value={a.caption} placeholder="Caption" aria-label="Caption" onChange={(e) => updateAttributes({ caption: e.target.value })} />
          <label className="studio-cv__alt">
            <span>Alt</span>
            <input value={a.alt} aria-invalid={!a.alt.trim()} placeholder="Describe the picture (required to publish)" onChange={(e) => updateAttributes({ alt: e.target.value })} />
          </label>
        </div>
      </figure>
    </NodeViewWrapper>
  );
}
