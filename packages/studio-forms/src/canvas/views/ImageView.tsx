'use client';

import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { BlockTools, WidthToggle } from './BlockChrome';
import type { EssayImageAttrs } from '../schema/image';

/**
 * The image block in place: the picture at its width, a caption line under
 * it in the UI face, an alt field (red until filled: rule 4), and a focal
 * point dragged on the picture. All of it is attributes; nothing is child
 * content, so the figure drags as one thing.
 */
export function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as EssayImageAttrs;
  const box = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);

  // Natural size arrives once the picture loads; the renderer emits it as
  // width/height so the page reserves the space.
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!a.naturalWidth && img.naturalWidth) {
      updateAttributes({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    }
  };

  const focal = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    updateAttributes({ focalX: Number(x.toFixed(3)), focalY: Number(y.toFixed(3)) });
  };

  return (
    <NodeViewWrapper className={`studio-cv__block studio-cv__image is-${a.width} ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <WidthToggle value={a.width} onChange={(width) => updateAttributes({ width })} />
      <BlockTools onRemove={deleteNode} />
      <figure>
        <div
          ref={box}
          className="studio-cv__pic"
          style={{ aspectRatio: a.naturalWidth && a.naturalHeight ? `${a.naturalWidth} / ${a.naturalHeight}` : undefined }}
        >
          {a.src ? (
            <img
              src={a.src}
              alt={a.alt}
              onLoad={onLoad}
              draggable={false}
              style={a.focalX != null && a.focalY != null ? { objectPosition: `${a.focalX * 100}% ${a.focalY * 100}%` } : undefined}
            />
          ) : (
            <span className="studio-hint">No picture</span>
          )}
          {a.src && (
            <button
              type="button"
              className="studio-cv__focal"
              title="Focal point: what stays in view when the picture is cropped"
              style={{ left: `${(a.focalX ?? 0.5) * 100}%`, top: `${(a.focalY ?? 0.5) * 100}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                setDragging(true);
              }}
              onPointerMove={(e) => dragging && focal(e)}
              onPointerUp={(e) => {
                setDragging(false);
                focal(e);
              }}
            />
          )}
        </div>
        <input
          className="studio-cv__caption"
          value={a.caption}
          placeholder="Caption"
          aria-label="Caption"
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
        <label className="studio-cv__alt">
          <span>Alt</span>
          <input
            value={a.alt}
            placeholder="Describe the picture for someone who cannot see it (required to publish)"
            aria-invalid={!a.alt.trim()}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
          />
        </label>
      </figure>
    </NodeViewWrapper>
  );
}
